import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { crearPreferencia } from '../services/mercadoPagoService.js'
import Orden from '../models/Orden.js'
import Producto from '../models/Producto.js'
import Tienda from '../models/Tienda.js'
import Usuario from '../models/Usuario.js'
import { MercadoPagoConfig, Payment } from 'mercadopago'

const router = Router()

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

    const usuario = await Usuario.findById(req.usuario.id)

    const preferencia = await crearPreferencia(orden, usuario.email)

    // Guardar el ID de preferencia en la orden
    orden.mpPreferenceId = preferencia.preferenceId
    orden.usaSplit = preferencia.usaSplit
    await orden.save()

    res.json(preferencia)
  } catch (error) {
    console.error('Error creando preferencia MP:', error)
    res.status(500).json({ error: 'Error al crear pago' })
  }
})

// POST /api/pagos/webhook - Webhook de Mercado Pago (split y normal)
router.post('/webhook', async (req, res) => {
  try {
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

      // Actualizar estado según respuesta de MP
      if (pago.status === 'approved' && orden.estado === 'pendiente') {
        orden.estado = 'pagada'
        orden.mpPaymentId = pago.id.toString()
        orden.mpStatus = pago.status

        // Si usó split, la plata ya fue distribuida por MP
        // Si no usó split, marcamos que hay que pagar al vendedor manualmente
        if (orden.usaSplit) {
          console.log(`💰 Pago SPLIT aprobado: orden ${ordenId} | Total: $${orden.total} | Fee: $${orden.comision}`)
          console.log(`   → Comisión marketplace: $${orden.comision} (directo a tu cuenta)`)
          console.log(`   → Pago vendedor: $${orden.gananciaVendedor} (directo a su MP)`)
        } else {
          console.log(`💰 Pago estándar aprobado: orden ${ordenId} | Total: $${orden.total}`)
          console.log(`   ⚠️ Vendedor sin MP vinculado - pago manual pendiente`)
        }

        // Descontar stock (solo cuando el pago se confirma)
        for (const item of orden.items) {
          await Producto.findByIdAndUpdate(item.productoId, {
            $inc: { stock: -item.cantidad, totalVentas: item.cantidad }
          })
        }

        // Actualizar stats de la tienda
        const tiendaIds = [...new Set(orden.items.map(i => i.tiendaId.toString()))]
        for (const tiendaId of tiendaIds) {
          const itemsTienda = orden.items.filter(i => i.tiendaId.toString() === tiendaId)
          const subtotalTienda = itemsTienda.reduce((sum, i) => sum + i.subtotal, 0)
          const comisionTienda = Math.round(subtotalTienda * 0.10 * 100) / 100
          const gananciaTienda = subtotalTienda - comisionTienda

          await Tienda.findByIdAndUpdate(tiendaId, {
            $inc: { totalVentas: 1, ganancias: gananciaTienda }
          })
        }

        await orden.save()

      } else if (pago.status === 'rejected') {
        orden.mpStatus = 'rejected'
        await orden.save()
        console.log(`❌ Pago rechazado: orden ${ordenId}`)

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

    // Con split payment, MP ya distribuyó la plata al vendedor
    // Esta confirmación cierra el flujo y protege ante disputas
    console.log(`✅ Comprador confirmó recepción: orden ${orden._id}`)

    res.json({ mensaje: 'Recepción confirmada. Gracias por tu compra.' })
  } catch (error) {
    res.status(500).json({ error: 'Error al confirmar recepción' })
  }
})

// GET /api/pagos/estado/:ordenId - Verificar estado de pago
router.get('/estado/:ordenId', verificarToken, async (req, res) => {
  try {
    const orden = await Orden.findById(req.params.ordenId)
    if (!orden) {
      return res.status(404).json({ error: 'Orden no encontrada' })
    }

    res.json({
      estado: orden.estado,
      mpStatus: orden.mpStatus || null,
      total: orden.total,
      usaSplit: orden.usaSplit || false
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
