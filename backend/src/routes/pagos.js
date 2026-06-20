import { Router } from 'express'
import crypto from 'crypto'
import { verificarToken } from '../middleware/auth.js'
import { crearPreferencia } from '../services/mercadoPagoService.js'
import { esPagoDePauta, activarPautaDesdePago } from '../services/pautaService.js'
import { registrarCompra, notificarClientesIdeales } from '../services/targetingService.js'
import { emitirComprobantePauta, emitirComprobanteComision } from '../services/facturacionService.js'
import * as configService from '../services/configService.js'
import Orden from '../models/Orden.js'
import AuditoriaFinanciera from '../models/AuditoriaFinanciera.js'
import Producto from '../models/Producto.js'
import Tienda from '../models/Tienda.js'
import Usuario from '../models/Usuario.js'
import Carrito from '../models/Carrito.js'
import Notificacion from '../models/Notificacion.js'
import { obtenerPreapproval } from '../services/mercadoPagoPreapprovalService.js'
import { activarSuscripcionDestacado, cambiarEstadoSuscripcion } from '../services/serviciosService.js'
import { enviarConfirmacionCompra, enviarNotificacionVenta } from '../services/emailService.js'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { emitPagoAprobado, emitVentaConfirmada, emitStockActualizado, emitNotificacion } from '../services/socketService.js'

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

  // Comparación en tiempo constante (evita timing attacks al comparar el hash)
  const hmacBuf = Buffer.from(hmac, 'hex')
  const v1Buf = Buffer.from(v1, 'hex')
  if (hmacBuf.length !== v1Buf.length) return false
  return crypto.timingSafeEqual(hmacBuf, v1Buf)
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

      // ===== Pauta publicitaria =====
      // Si el pago corresponde a una pauta (external_reference "pauta:<id>"),
      // lo manejamos aparte: activamos el destacado y cortamos acá. El dinero
      // ya entró completo a la cuenta de la plataforma (sin split).
      if (esPagoDePauta(pago)) {
        const r = await activarPautaDesdePago(pago)
        if (r.motivo === 'activada' && r.destacado) {
          try {
            const tienda = await Tienda.findById(r.destacado.tiendaId)
            if (tienda) {
              const notif = await new Notificacion({
                usuarioId: tienda.usuarioId,
                tipo: 'pago',
                titulo: '¡Tu campaña ya está activa!',
                mensaje: `Pago de pauta aprobado por $${r.destacado.precioTotal.toLocaleString('es-AR')}. Tu producto ya aparece destacado.`,
                enlace: '/promover'
              }).save()
              emitNotificacion(tienda.usuarioId.toString(), notif)
            }
          } catch (e) {
            console.error('Error notificando pauta activada:', e.message)
          }
          // Pauta inteligente: avisar a los clientes ideales (async, no bloquea)
          notificarClientesIdeales(r.destacado, { motivo: 'nuevo' }).catch(() => {})
          // Factura C de la pauta (plataforma → vendedor). No bloquea el webhook.
          emitirComprobantePauta(r.destacado).catch(e =>
            console.warn('No se pudo emitir comprobante de pauta:', e.message))
        }
        return res.status(200).send('OK')
      }

      // ===== Traslado de comisionista (external_reference "cotizacion:<id>") =====
      // El comprador pagó un traslado cotizado. El dinero va al comisionista vía
      // split; la plataforma retuvo su fee. Solo marcamos el pago y cortamos acá.
      const extRef = pago.external_reference || ''
      if (extRef.startsWith('cotizacion:')) {
        if (pago.status === 'approved') {
          const solicitudId = extRef.slice('cotizacion:'.length)
          const { marcarTrasladoPagado } = await import('../services/comisionistaService.js')
          await marcarTrasladoPagado(solicitudId, pago.id)
        }
        return res.status(200).send('OK')
      }

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
          const prodActualizado = await Producto.findByIdAndUpdate(item.productoId, {
            $inc: { stock: -item.cantidad, totalVentas: item.cantidad }
          }, { new: true })
          // Emitir stock actualizado en tiempo real
          if (prodActualizado) {
            emitStockActualizado(item.productoId.toString(), prodActualizado.stock)
          }
        }

        // Vaciar el carrito del comprador ahora que el pago fue confirmado.
        // Se hace acá (no al crear la orden) para que un checkout abandonado no destruya el carrito.
        try {
          await Carrito.findOneAndUpdate(
            { usuarioId: ordenActualizada.compradorId },
            { $set: { items: [] } }
          )
        } catch (carritoErr) {
          console.error('Error vaciando carrito post-pago:', carritoErr.message)
        }

        // Emitir pago aprobado al comprador via WebSocket
        emitPagoAprobado(ordenActualizada.compradorId.toString(), ordenActualizada)

        // Actualizar stats de la tienda
        const tiendaIds = [...new Set(ordenActualizada.items.map(i => i.tiendaId.toString()))]
        const porcentajeComision = await configService.obtenerPorcentajeComision('venta')
        for (const tiendaId of tiendaIds) {
          const itemsTienda = ordenActualizada.items.filter(i => i.tiendaId.toString() === tiendaId)
          const subtotalTienda = itemsTienda.reduce((sum, i) => sum + i.subtotal, 0)
          const comisionTienda = Math.round(subtotalTienda * porcentajeComision / 100 * 100) / 100
          const gananciaTienda = subtotalTienda - comisionTienda

          await Tienda.findByIdAndUpdate(tiendaId, {
            $inc: { totalVentas: 1, ganancias: gananciaTienda }
          })

          // Factura C de comisión (plataforma → vendedor) por los items de esta
          // tienda. Idempotente y no bloqueante.
          emitirComprobanteComision(ordenActualizada, tiendaId).catch(e =>
            console.warn('No se pudo emitir comprobante de comisión:', e.message))
        }

        // Señal de compra para la pauta inteligente (no bloquea el webhook)
        registrarCompra(
          ordenActualizada.compradorId.toString(),
          ordenActualizada.items
        ).catch(() => {})

        // Oferta Compartida: descontar el aporte de la plataforma del
        // presupuesto y finalizar la oferta si se agotó (no bloquea el webhook).
        import('../services/ofertaCompartidaService.js')
          .then(m => m.registrarVentaConOferta(ordenActualizada))
          .catch(e => console.warn('No se pudo registrar venta con oferta compartida:', e.message))

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
            const notifCompra = await new Notificacion({
              usuarioId: comprador._id,
              tipo: 'compra',
              titulo: 'Pago confirmado',
              mensaje: `Tu pago de $${ordenActualizada.total.toLocaleString('es-AR')} fue aprobado. El vendedor preparará tu pedido.`,
              enlace: '/mis-ordenes'
            }).save()
            // Tiempo real + push (app cerrada) al comprador
            emitNotificacion(comprador._id.toString(), notifCompra)
            // Email de confirmación: fire-and-forget. NO bloqueamos la respuesta
            // del webhook esperando a Resend; si MP no recibe el 200 rápido,
            // reintenta (y la idempotencia ya nos protege de doble proceso).
            enviarConfirmacionCompra(comprador.email, comprador.nombre, ordenActualizada)
              .catch(e => console.error('Error enviando email de confirmación de compra:', e.message))
          }

          for (const tiendaId of tiendaIds) {
            const tienda = await Tienda.findById(tiendaId)
            if (tienda) {
              const itemsTienda = ordenActualizada.items.filter(i => i.tiendaId.toString() === tiendaId)
              const totalTienda = itemsTienda.reduce((sum, i) => sum + i.subtotal, 0)
              const notifVenta = await new Notificacion({
                usuarioId: tienda.usuarioId,
                tipo: 'venta',
                titulo: 'Nueva venta confirmada',
                mensaje: `Venta confirmada por $${totalTienda.toLocaleString('es-AR')}. El pago fue aprobado. Prepará el envío.`,
                enlace: '/pedidos-vendedor'
              }).save()
              // Emitir venta al vendedor via WebSocket
              emitVentaConfirmada(tienda.usuarioId.toString(), { total: totalTienda, cantidadItems: itemsTienda.length })
              emitNotificacion(tienda.usuarioId.toString(), notifVenta)
              const vendedor = await Usuario.findById(tienda.usuarioId)
              if (vendedor) {
                // Email al vendedor: fire-and-forget (no bloquea el 200 del webhook).
                enviarNotificacionVenta(vendedor.email, vendedor.nombre, totalTienda, itemsTienda.length)
                  .catch(e => console.error('Error enviando email de notificación de venta:', e.message))
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

        // Notificar al comprador que su pago falló
        try {
          await new Notificacion({
            usuarioId: orden.compradorId,
            tipo: 'compra',
            titulo: 'Pago rechazado',
            mensaje: `Tu pago de $${orden.total.toLocaleString('es-AR')} fue rechazado. Podés intentar de nuevo desde "Mis Órdenes".`,
            enlace: '/mis-ordenes'
          }).save()

          // Notificar a vendedores que el pago no se concretó
          const tiendaIds = [...new Set(orden.items.map(i => i.tiendaId.toString()))]
          for (const tiendaId of tiendaIds) {
            const tienda = await Tienda.findById(tiendaId)
            if (tienda) {
              await new Notificacion({
                usuarioId: tienda.usuarioId,
                tipo: 'venta',
                titulo: 'Pago rechazado en una orden',
                mensaje: `El pago de la orden #${orden._id.toString().slice(-8)} por $${orden.total.toLocaleString('es-AR')} fue rechazado.`,
                enlace: '/pedidos-vendedor'
              }).save()
            }
          }
        } catch (notifErr) {
          console.error('Error notificando pago rechazado:', notifErr.message)
        }

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

    // Transición atómica: el filtro por estado evita una carrera (ej. un admin
    // revirtiendo la orden justo en este momento) que dejaría un estado inconsistente.
    const ordenActualizada = await Orden.findOneAndUpdate(
      { _id: orden._id, compradorId: req.usuario.id, estado: 'enviada' },
      { $set: { estado: 'completada', fechaConfirmacion: new Date() } },
      { new: true }
    )
    if (!ordenActualizada) {
      return res.status(409).json({ error: 'La orden debe estar en estado "enviada" para confirmar recepción' })
    }

    console.log(`✅ Comprador confirmó recepción: orden ${ordenActualizada._id}`)

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
    let esVendedorAutorizado = false
    if (!esComprador && (req.usuario.tieneVendedor || req.usuario.rol === 'vendedor')) {
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

// ===== PASO 2: Webhooks de Preapproval para Suscripciones =====

// POST /api/pagos/webhook/preapproval - Webhook de cambios en preapproval (MercadoPago)
router.post('/webhook/preapproval', async (req, res) => {
  try {
    // 1. Verificar firma (usando el mismo método que para payments)
    if (!verificarFirmaWebhook(req)) {
      console.warn('🚨 Webhook preapproval rechazado: firma inválida')
      return res.status(401).send('Firma inválida')
    }

    const { type, data } = req.body

    // MP manda 'preapproval' o 'subscription_preapproval' según el evento.
    if ((type === 'preapproval' || type === 'subscription_preapproval') && data?.id) {
      // 1. NO confiar en el body: consultar el preapproval a la API de MP.
      //    De ahí sacamos el status real y el external_reference (= suscripcion._id,
      //    que seteamos al crear el preapproval). Mismo patrón que el webhook de pagos.
      let preapproval
      try {
        preapproval = await obtenerPreapproval(data.id)
      } catch (e) {
        console.error('Webhook preapproval: no se pudo consultar a MP:', e.message)
        // 200 igual: si devolvemos error, MP reintenta en loop. Ya quedó logueado.
        return res.status(200).send('OK')
      }

      const suscripcionId = preapproval?.external_reference
      const status = preapproval?.status // 'authorized' | 'paused' | 'cancelled' | 'pending'

      if (!suscripcionId) {
        console.warn(`⚠️ Webhook preapproval ${data.id} sin external_reference`)
        return res.status(200).send('OK')
      }

      // 2. Aplicar el estado de MP usando los helpers del service. Son la fuente
      //    única de verdad: activan/desactivan el beneficio "destacado" y son
      //    idempotentes (un webhook duplicado no re-notifica ni re-aplica).
      if (status === 'authorized') {
        await activarSuscripcionDestacado(suscripcionId)
      } else if (status === 'paused') {
        await cambiarEstadoSuscripcion(suscripcionId, 'pausada')
      } else if (status === 'cancelled') {
        await cambiarEstadoSuscripcion(suscripcionId, 'cancelada')
      }
    }

    res.status(200).send('OK')
  } catch (error) {
    console.error('Error procesando webhook preapproval:', error.message)
    // Siempre responder 200 para que MP no reintente
    res.status(200).send('OK')
  }
})

export default router
