import { Router } from 'express'
import crypto from 'crypto'
import { verificarToken } from '../middleware/auth.js'
import { crearPreferencia } from '../services/mercadoPagoService.js'
import Orden from '../models/Orden.js'
import AuditoriaFinanciera from '../models/AuditoriaFinanciera.js'
import Producto from '../models/Producto.js'
import Tienda from '../models/Tienda.js'
import Usuario from '../models/Usuario.js'
import Notificacion from '../models/Notificacion.js'
import { enviarConfirmacionCompra, enviarNotificacionVenta } from '../services/emailService.js'
import { MercadoPagoConfig, Payment } from 'mercadopago'

const router = Router()

// ===== Verificación de firma de webhook de Mercado Pago =====
function verificarFirmaWebhook(req) {
  const xSignature = req.headers['x-signature']
  const xRequestId = req.headers['x-request-id']

  if (!xSignature || !xRequestId) {
    return false
  }

  const webhookSecret = process.env.MP_WEBHOOK_SECRET
  if (!webhookSecret) {
    // Si no hay secret configurado, validar que el pago exista en MP (fallback)
    console.warn('⚠️ MP_WEBHOOK_SECRET no configurado - usando validación por consulta a MP')
    return true
  }

  // Parsear x-signature: "ts=timestamp,v1=hash"
  const parts = {}
  xSignature.split(',').forEach(part => {
    const [key, value] = part.split('=')
    parts[key.trim()] = value.trim()
  })

  const ts = parts['ts']
  const v1 = parts['v1']

  if (!ts || !v1) return false

  // Construir el string para validar según docs de MP
  const dataId = req.query['data.id'] || req.body?.data?.id || ''
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const hmac = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex')

  return hmac === v1
}

// POST /api/pagos/crear-preferencia - Crear preferencia de MP con Split
router.post('/crear-preferencia', verificarToken, async (req, res) => {
  try {
    const { ordenId } = req.body

    const orden = await Orden.findById(ordenId)
    if (!orden) {
      return res.status(404).json({ error: 'Orden no encontrada' })
    }

    if (orden.compradorId.toString() !== req.usuario.id) {
      return res.status(403).json({ error: 'No autorizado' })
    }

    if (orden.estado !== 'pendiente') {
      return res.status(400).json({ error: 'Esta orden ya fue procesada' })
    }

    const usuario = await Usuario.findById(req.usuario.id)

    const preferencia = await crearPreferencia(orden, usuario.email)

    // Guardar el ID de preferencia en la orden
    orden.mpPreferenceId = preferencia.preferenceId
    orden.usaSplit = preferencia.usaSplit
    await orden.save()

    res.json(preferencia)
  } catch (error) {
    console.error('Error creando preferencia MP:', error?.message || error)
    if (error?.cause) console.error('Causa:', error.cause)

    const mensaje = error?.message?.includes('token')
      ? 'Error de configuración de pagos. Por favor contactá al soporte.'
      : 'No pudimos procesar tu pago. Intentá de nuevo en unos minutos.'
    res.status(500).json({ error: mensaje })
  }
})

// POST /api/pagos/webhook - Webhook de Mercado Pago (split y normal)
// SEGURIDAD: Verificación de firma + idempotencia + auditoría
router.post('/webhook', async (req, res) => {
  try {
    // 1. Verificar firma del webhook
    if (!verificarFirmaWebhook(req)) {
      console.warn('🚨 Webhook rechazado: firma inválida', {
        ip: req.ip,
        headers: { 'x-signature': req.headers['x-signature'] ? '[presente]' : '[ausente]' }
      })
      return res.status(401).send('Firma inválida')
    }

    const { type, data } = req.body

    if (type === 'payment') {
      const client = new MercadoPagoConfig({
        accessToken: process.env.MP_ACCESS_TOKEN
      })
      const payment = new Payment(client)
      const pago = await payment.get({ id: data.id })

      const ordenId = pago.external_reference
      const orden = await Orden.findById(ordenId)

      if (!orden) {
        console.warn(`⚠️ Webhook: orden ${ordenId} no encontrada`)
        return res.status(200).send('OK')
      }

      // 2. IDEMPOTENCIA: Si la orden ya fue procesada con este paymentId, ignorar
      if (orden.mpPaymentId && orden.mpPaymentId === pago.id.toString()) {
        console.log(`ℹ️ Webhook duplicado ignorado: orden ${ordenId} ya procesada con payment ${pago.id}`)
        return res.status(200).send('OK')
      }

      // 3. Solo procesar si la orden está pendiente (protección contra race conditions)
      if (pago.status === 'approved' && orden.estado === 'pendiente') {
        // Usar findOneAndUpdate atómico para evitar race conditions
        const ordenActualizada = await Orden.findOneAndUpdate(
          { _id: ordenId, estado: 'pendiente' },
          {
            $set: {
              estado: 'pagada',
              mpPaymentId: pago.id.toString(),
              mpStatus: pago.status
            }
          },
          { new: true }
        )

        // Si no se actualizó, otro webhook ya la procesó
        if (!ordenActualizada) {
          console.log(`ℹ️ Race condition evitada: orden ${ordenId} ya procesada por otro webhook`)
          return res.status(200).send('OK')
        }

        if (ordenActualizada.usaSplit) {
          console.log(`💰 Pago SPLIT aprobado: orden ${ordenId} | Total: $${ordenActualizada.total} | Fee: $${ordenActualizada.comision}`)
        } else {
          console.log(`💰 Pago estándar aprobado: orden ${ordenId} | Total: $${ordenActualizada.total}`)
        }

        // Descontar stock (solo cuando el pago se confirma)
        for (const item of ordenActualizada.items) {
          await Producto.findByIdAndUpdate(item.productoId, {
            $inc: { stock: -item.cantidad, totalVentas: item.cantidad }
          })
        }

        // Actualizar stats de la tienda
        const tiendaIds = [...new Set(ordenActualizada.items.map(i => i.tiendaId.toString()))]
        for (const tiendaId of tiendaIds) {
          const itemsTienda = ordenActualizada.items.filter(i => i.tiendaId.toString() === tiendaId)
          const subtotalTienda = itemsTienda.reduce((sum, i) => sum + i.subtotal, 0)
          const comisionTienda = Math.round(subtotalTienda * 0.10 * 100) / 100
          const gananciaTienda = subtotalTienda - comisionTienda

          await Tienda.findByIdAndUpdate(tiendaId, {
            $inc: { totalVentas: 1, ganancias: gananciaTienda }
          })
        }

        // 4. AUDITORÍA: Registrar transacción financiera
        try {
          await new AuditoriaFinanciera({
            tipo: 'pago_aprobado',
            ordenId: ordenActualizada._id,
            mpPaymentId: pago.id.toString(),
            monto: ordenActualizada.total,
            comision: ordenActualizada.comision,
            gananciaVendedor: ordenActualizada.gananciaVendedor,
            usaSplit: ordenActualizada.usaSplit,
            compradorId: ordenActualizada.compradorId,
            tiendaIds,
            metadata: {
              mpStatus: pago.status,
              mpStatusDetail: pago.status_detail,
              paymentMethod: pago.payment_method_id,
              paymentType: pago.payment_type_id
            }
          }).save()
        } catch (auditErr) {
          console.error('Error guardando auditoría:', auditErr.message)
        }

        // Notificar al comprador, vendedor y admin
        try {
          const comprador = await Usuario.findById(ordenActualizada.compradorId)
          if (comprador) {
            await new Notificacion({
              usuarioId: comprador._id,
              tipo: 'compra',
              titulo: 'Pago confirmado',
              mensaje: `Tu pago de $${ordenActualizada.total.toLocaleString('es-AR')} fue aprobado. El vendedor preparará tu pedido.`,
              enlace: '/mis-ordenes'
            }).save()
            await enviarConfirmacionCompra(comprador.email, comprador.nombre, ordenActualizada)
          }

          for (const tiendaId of tiendaIds) {
            const tienda = await Tienda.findById(tiendaId)
            if (tienda) {
              const itemsTienda = ordenActualizada.items.filter(i => i.tiendaId.toString() === tiendaId)
              const totalTienda = itemsTienda.reduce((sum, i) => sum + i.subtotal, 0)
              await new Notificacion({
                usuarioId: tienda.usuarioId,
                tipo: 'venta',
                titulo: 'Nueva venta confirmada',
                mensaje: `Venta confirmada por $${totalTienda.toLocaleString('es-AR')}. El pago fue aprobado. Prepará el envío.`,
                enlace: '/pedidos-vendedor'
              }).save()
              const vendedor = await Usuario.findById(tienda.usuarioId)
              if (vendedor) {
                await enviarNotificacionVenta(vendedor.email, vendedor.nombre, totalTienda, itemsTienda.length)
              }
            }
          }

          const admins = await Usuario.find({ rol: 'admin' }).select('_id')
          for (const admin of admins) {
            await new Notificacion({
              usuarioId: admin._id,
              tipo: 'pago',
              titulo: 'Pago confirmado en la plataforma',
              mensaje: `Pago aprobado: $${ordenActualizada.total.toLocaleString('es-AR')} (comisión: $${ordenActualizada.comision.toLocaleString('es-AR')})`,
              enlace: '/admin'
            }).save()
          }
        } catch (notifErr) {
          console.error('Error enviando notificaciones post-pago:', notifErr.message)
        }

      } else if (pago.status === 'rejected') {
        orden.mpStatus = 'rejected'
        await orden.save()
        console.log(`❌ Pago rechazado: orden ${ordenId}`)

        // Auditoría de rechazo
        try {
          await new AuditoriaFinanciera({
            tipo: 'pago_rechazado',
            ordenId: orden._id,
            mpPaymentId: pago.id.toString(),
            monto: orden.total,
            metadata: { mpStatus: pago.status, mpStatusDetail: pago.status_detail }
          }).save()
        } catch (auditErr) {
          console.error('Error guardando auditoría de rechazo:', auditErr.message)
        }

      } else if (pago.status === 'pending' || pago.status === 'in_process') {
        orden.mpStatus = pago.status
        await orden.save()
        console.log(`⏳ Pago pendiente: orden ${ordenId}`)
      }
    }

    res.status(200).send('OK')
  } catch (error) {
    console.error('Error en webhook MP:', error)
    res.status(200).send('OK')
  }
})

// POST /api/pagos/confirmar-recepcion/:ordenId - Comprador confirma que recibió OK
router.post('/confirmar-recepcion/:ordenId', verificarToken, async (req, res) => {
  try {
    const orden = await Orden.findById(req.params.ordenId)
    if (!orden) {
      return res.status(404).json({ error: 'Orden no encontrada' })
    }

    if (orden.compradorId.toString() !== req.usuario.id) {
      return res.status(403).json({ error: 'No autorizado' })
    }

    if (orden.estado !== 'enviada') {
      return res.status(400).json({ error: 'La orden debe estar en estado "enviada" para confirmar recepción' })
    }

    orden.estado = 'completada'
    orden.fechaConfirmacion = new Date()
    await orden.save()

    console.log(`✅ Comprador confirmó recepción: orden ${orden._id}`)

    res.json({ mensaje: 'Recepción confirmada. ¡Gracias por tu compra!' })
  } catch (error) {
    res.status(500).json({ error: 'Error al confirmar recepción. Intentá de nuevo.' })
  }
})

// GET /api/pagos/estado/:ordenId - Verificar estado de pago
// FIX: Verificar que la orden pertenezca al usuario (IDOR)
router.get('/estado/:ordenId', verificarToken, async (req, res) => {
  try {
    const orden = await Orden.findById(req.params.ordenId)
    if (!orden) {
      return res.status(404).json({ error: 'Orden no encontrada' })
    }

    // Verificar que el usuario sea el comprador, un vendedor de la orden, o admin
    const esComprador = orden.compradorId.toString() === req.usuario.id
    const esVendedorDeOrden = orden.items.some(
      item => item.tiendaId && item.tiendaId.toString()
    )
    let esVendedorAutorizado = false
    if (!esComprador && req.usuario.rol === 'vendedor') {
      const tienda = await Tienda.findOne({ usuarioId: req.usuario.id })
      if (tienda) {
        esVendedorAutorizado = orden.items.some(
          item => item.tiendaId.toString() === tienda._id.toString()
        )
      }
    }
    const esAdmin = req.usuario.rol === 'admin'

    if (!esComprador && !esVendedorAutorizado && !esAdmin) {
      return res.status(403).json({ error: 'No autorizado' })
    }

    res.json({
      estado: orden.estado,
      mpStatus: orden.mpStatus || null,
      total: orden.total,
      usaSplit: orden.usaSplit || false
    })
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar el estado del pago' })
  }
})

export default router
