import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { crearPreferencia } from '../services/mercadoPagoService.js'
import Orden from '../models/Orden.js'
import Usuario from '../models/Usuario.js'
import { MercadoPagoConfig, Payment } from 'mercadopago'

const router = Router()

// POST /api/pagos/crear-preferencia - Crear preferencia de MP
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
    await orden.save()

    res.json(preferencia)
  } catch (error) {
    console.error('Error creando preferencia MP:', error)
    res.status(500).json({ error: 'Error al crear pago' })
  }
})

// POST /api/pagos/webhook - Webhook de Mercado Pago
router.post('/webhook', async (req, res) => {
  try {
    const { type, data } = req.body

    if (type === 'payment') {
      const client = new MercadoPagoConfig({
        accessToken: process.env.MP_ACCESS_TOKEN
      })
      const payment = new Payment(client)
      const pago = await payment.get({ id: data.id })

      if (pago.status === 'approved') {
        const ordenId = pago.external_reference
        const orden = await Orden.findById(ordenId)

        if (orden && orden.estado === 'pendiente') {
          orden.estado = 'pagada'
          orden.mpPaymentId = pago.id.toString()
          orden.mpStatus = pago.status
          await orden.save()
          console.log(`💰 Pago aprobado para orden ${ordenId}: $${orden.total}`)
        }
      }
    }

    res.status(200).send('OK')
  } catch (error) {
    console.error('Error en webhook MP:', error)
    res.status(200).send('OK') // Siempre responder 200 a MP
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
      total: orden.total
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
