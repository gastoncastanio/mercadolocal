import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import * as remisService from '../services/remisService.js'

const router = Router()

// ===== Configuración del conductor =====

// PATCH /api/remis/configuracion - Activar remis y configurar tarifas
router.patch('/configuracion', verificarToken, async (req, res) => {
  try {
    const perfil = await remisService.configurarRemis(req.usuario.id, req.body)
    res.json(perfil)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/remis/disponibles?ciudad=&distanciaKm=&horasEspera= - Remiseros disponibles ahora
router.get('/disponibles', async (req, res) => {
  try {
    const { ciudad, distanciaKm, horasEspera } = req.query
    const lista = await remisService.remiserosDisponibles({
      ciudad,
      distanciaKm: distanciaKm ? Number(distanciaKm) : 0,
      horasEspera: horasEspera ? Number(horasEspera) : 0
    })
    res.json(lista)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===== Pedido de remis (pasajero) =====

// POST /api/remis/pedir - Pedir un remis
router.post('/pedir', verificarToken, async (req, res) => {
  try {
    const viaje = await remisService.pedirRemis(req.usuario.id, req.body)
    res.status(201).json(viaje.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/remis/mis-viajes - Viajes que pedí (pasajero)
router.get('/mis-viajes', verificarToken, async (req, res) => {
  try {
    const viajes = await remisService.misViajesPasajero(req.usuario.id)
    res.json(viajes)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/remis/conductor/viajes - Viajes que tomé (conductor)
router.get('/conductor/viajes', verificarToken, async (req, res) => {
  try {
    const viajes = await remisService.misViajesConductor(req.usuario.id)
    res.json(viajes)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/remis/conductor/pedidos - Pedidos abiertos que puedo tomar (conductor)
router.get('/conductor/pedidos', verificarToken, async (req, res) => {
  try {
    const pedidos = await remisService.pedidosAbiertos(req.usuario.id)
    res.json(pedidos)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/remis/viaje/:id - Detalle de un viaje (pasajero o conductor)
router.get('/viaje/:id', verificarToken, async (req, res) => {
  try {
    const viaje = await remisService.obtenerViajeRemis(req.usuario.id, req.params.id)
    res.json(viaje)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ===== Gestión del viaje (conductor) =====

// PATCH /api/remis/viaje/:id/aceptar - Tomar un pedido abierto
router.patch('/viaje/:id/aceptar', verificarToken, async (req, res) => {
  try {
    const viaje = await remisService.aceptarRemis(req.usuario.id, req.params.id)
    res.json(viaje.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PATCH /api/remis/viaje/:id/en-camino - El conductor va hacia el origen
router.patch('/viaje/:id/en-camino', verificarToken, async (req, res) => {
  try {
    const viaje = await remisService.avanzarEstadoRemis(req.usuario.id, req.params.id, 'en_camino')
    res.json(viaje.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PATCH /api/remis/viaje/:id/a-bordo - El pasajero subió
router.patch('/viaje/:id/a-bordo', verificarToken, async (req, res) => {
  try {
    const viaje = await remisService.avanzarEstadoRemis(req.usuario.id, req.params.id, 'a_bordo')
    res.json(viaje.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PATCH /api/remis/viaje/:id/finalizar - Cerrar el viaje (con precio final opcional)
router.patch('/viaje/:id/finalizar', verificarToken, async (req, res) => {
  try {
    const viaje = await remisService.avanzarEstadoRemis(req.usuario.id, req.params.id, 'finalizado', {
      precioFinal: req.body.precioFinal
    })
    res.json(viaje.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ===== Pago en EFECTIVO (excepción con comisión adeudada) =====

// PATCH /api/remis/viaje/:id/efectivo/aceptar - Conductor acepta pagar en efectivo
router.patch('/viaje/:id/efectivo/aceptar', verificarToken, async (req, res) => {
  try {
    const viaje = await remisService.aceptarPagoEfectivo(req.usuario.id, req.params.id)
    res.json(viaje.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PATCH /api/remis/viaje/:id/efectivo/registrar - Conductor registra cobro en efectivo
router.patch('/viaje/:id/efectivo/registrar', verificarToken, async (req, res) => {
  try {
    const viaje = await remisService.registrarCobroEfectivo(req.usuario.id, req.params.id)
    res.json(viaje.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/remis/conductor/comision - Resumen de comisión adeudada
router.get('/conductor/comision', verificarToken, async (req, res) => {
  try {
    const resumen = await remisService.resumenComisionConductor(req.usuario.id)
    res.json(resumen)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/remis/conductor/pagar-comision - Iniciar pago de comisión adeudada
router.post('/conductor/pagar-comision', verificarToken, async (req, res) => {
  try {
    const { default: Usuario } = await import('../models/Usuario.js')
    const usuario = await Usuario.findById(req.usuario.id).select('email')
    const resultado = await remisService.pagarComisionAdeudada(req.usuario.id, usuario?.email || '')
    res.json(resultado)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/remis/conductor/verificar-comision - Verificar pago al volver del checkout
router.post('/conductor/verificar-comision', verificarToken, async (req, res) => {
  try {
    const resumen = await remisService.verificarPagoComision(req.usuario.id)
    res.json(resumen)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PATCH /api/remis/viaje/:id/cancelar - Cancelar (pasajero o conductor)
router.patch('/viaje/:id/cancelar', verificarToken, async (req, res) => {
  try {
    const viaje = await remisService.cancelarRemis(req.usuario.id, req.params.id)
    res.json(viaje.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ===== Pago (split al conductor) =====

// POST /api/remis/viaje/:id/pagar - El pasajero paga el viaje finalizado
router.post('/viaje/:id/pagar', verificarToken, async (req, res) => {
  try {
    const { default: Usuario } = await import('../models/Usuario.js')
    const usuario = await Usuario.findById(req.usuario.id).select('email')
    const resultado = await remisService.pagarRemis(req.usuario.id, req.params.id, usuario?.email || '')
    res.json(resultado)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/remis/viaje/:id/verificar-pago - Verificar el pago al volver del checkout
router.post('/viaje/:id/verificar-pago', verificarToken, async (req, res) => {
  try {
    const viaje = await remisService.verificarPagoRemis(req.usuario.id, req.params.id)
    res.json(viaje)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ===== Reseñas =====

// POST /api/remis/viaje/:id/resena - El pasajero reseña al conductor
router.post('/viaje/:id/resena', verificarToken, async (req, res) => {
  try {
    const resena = await remisService.reseñarRemis(req.usuario.id, req.params.id, req.body)
    res.status(201).json(resena)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/remis/mis-resenas-hechas - IDs de viajes que ya reseñé
router.get('/mis-resenas-hechas', verificarToken, async (req, res) => {
  try {
    const ids = await remisService.viajesRemisReseñadosPor(req.usuario.id)
    res.json(ids)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
