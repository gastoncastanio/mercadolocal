import { Router } from 'express'
import { verificarToken, tokenOpcional, soloAdmin } from '../middleware/auth.js'
import Usuario from '../models/Usuario.js'
import Orden from '../models/Orden.js'
import Notificacion from '../models/Notificacion.js'
import SolicitudLegal from '../models/SolicitudLegal.js'
import {
  exportarDatos,
  anonimizarCuenta,
  cambiarPreferencias,
  registrarSolicitud
} from '../services/privacidadService.js'

const router = Router()

// GET /api/privacidad/exportar
// Derecho de acceso: descarga TODOS los datos del usuario en un JSON.
router.get('/exportar', verificarToken, async (req, res) => {
  try {
    const datos = await exportarDatos(req.usuario.id)
    // Auditoría del ejercicio del derecho de acceso
    registrarSolicitud({
      usuarioId: req.usuario.id,
      emailContacto: datos.cuenta?.email || '',
      tipo: 'acceso',
      estado: 'resuelta',
      detalle: 'El usuario descargó sus datos personales.'
    }).catch(() => {})

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="mis-datos-mercadolocal.json"')
    res.send(JSON.stringify(datos, null, 2))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/privacidad/preferencias
router.get('/preferencias', verificarToken, async (req, res) => {
  try {
    const u = await Usuario.findById(req.usuario.id).select('preferencias').lean()
    res.json(u?.preferencias || { perfilarPublicidad: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/privacidad/preferencias  { perfilarPublicidad }
// Derecho de oposición al perfilado publicitario.
router.put('/preferencias', verificarToken, async (req, res) => {
  try {
    const prefs = await cambiarPreferencias(req.usuario.id, {
      perfilarPublicidad: req.body?.perfilarPublicidad
    })
    res.json(prefs)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/privacidad/eliminar-cuenta  { contraseña }
// Derecho de supresión / botón de baja. Pide la contraseña para confirmar.
router.post('/eliminar-cuenta', verificarToken, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id)
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' })

    const { contraseña } = req.body || {}
    if (!contraseña || !(await usuario.compararContraseña(contraseña))) {
      return res.status(400).json({ error: 'Contraseña incorrecta. Confirmá tu identidad para dar de baja la cuenta.' })
    }

    await anonimizarCuenta(req.usuario.id)
    res.json({ ok: true, mensaje: 'Tu cuenta fue dada de baja y tus datos personales fueron eliminados.' })
  } catch (error) {
    if (error.code === 'ADMIN_NO_BAJA') {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: error.message })
  }
})

// POST /api/privacidad/arrepentimiento/:ordenId  { motivo }
// Botón de arrepentimiento (Ley 24.240, art. 34): hasta 10 días corridos.
router.post('/arrepentimiento/:ordenId', verificarToken, async (req, res) => {
  try {
    const orden = await Orden.findById(req.params.ordenId)
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })
    if (orden.compradorId.toString() !== req.usuario.id) {
      return res.status(403).json({ error: 'No autorizado' })
    }
    if (orden.estado === 'cancelada') {
      return res.status(400).json({ error: 'Esta orden ya está cancelada' })
    }

    // Ventana de 10 días corridos desde la confirmación (o creación) de la compra.
    const base = orden.fechaConfirmacion || orden.createdAt
    const dias = (Date.now() - new Date(base).getTime()) / (1000 * 60 * 60 * 24)
    if (dias > 10) {
      return res.status(400).json({ error: 'El plazo de arrepentimiento (10 días) ya venció para esta compra.' })
    }

    const solicitud = await registrarSolicitud({
      usuarioId: req.usuario.id,
      emailContacto: req.usuario.email,
      tipo: 'arrepentimiento',
      estado: 'recibida',
      detalle: String(req.body?.motivo || '').slice(0, 500),
      ordenId: orden._id
    })

    // Avisar a los administradores para gestionar la devolución/reintegro.
    try {
      const admins = await Usuario.find({ rol: 'admin' }).select('_id')
      for (const admin of admins) {
        await new Notificacion({
          usuarioId: admin._id,
          tipo: 'sistema',
          titulo: 'Arrepentimiento de compra',
          mensaje: `Un comprador ejerció el botón de arrepentimiento en la orden #${orden._id.toString().slice(-8)}. Hay que gestionar la devolución.`,
          enlace: '/admin'
        }).save()
      }
    } catch { /* noop */ }

    res.status(201).json({ ok: true, solicitudId: solicitud._id, mensaje: 'Registramos tu arrepentimiento. Te vamos a contactar para coordinar la devolución y el reintegro.' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/privacidad/queja  { texto, email }
// Libro de quejas online (Defensa del Consumidor). Funciona logueado o no.
router.post('/queja', tokenOpcional, async (req, res) => {
  try {
    const texto = String(req.body?.texto || '').trim().slice(0, 2000)
    if (texto.length < 10) {
      return res.status(400).json({ error: 'Contanos un poco más para poder ayudarte (mínimo 10 caracteres).' })
    }
    const emailContacto = req.usuario?.email || String(req.body?.email || '').trim().slice(0, 120)
    if (!emailContacto) {
      return res.status(400).json({ error: 'Necesitamos un email de contacto para responderte.' })
    }

    const solicitud = await registrarSolicitud({
      usuarioId: req.usuario?.id || null,
      emailContacto,
      tipo: 'queja',
      estado: 'recibida',
      detalle: texto
    })

    try {
      const admins = await Usuario.find({ rol: 'admin' }).select('_id')
      for (const admin of admins) {
        await new Notificacion({
          usuarioId: admin._id,
          tipo: 'sistema',
          titulo: 'Nueva queja (Libro de Quejas)',
          mensaje: 'Se recibió una queja en el Libro de Quejas online. Revisala en el panel.',
          enlace: '/admin'
        }).save()
      }
    } catch { /* noop */ }

    res.status(201).json({ ok: true, numero: solicitud._id.toString().slice(-8).toUpperCase(), mensaje: 'Tu queja quedó registrada. Te responderemos al email indicado.' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===== Panel admin: auditoría de solicitudes legales =====

// GET /api/privacidad/solicitudes?tipo=&estado=
router.get('/solicitudes', verificarToken, soloAdmin, async (req, res) => {
  try {
    const filtro = {}
    if (req.query.tipo) filtro.tipo = req.query.tipo
    if (req.query.estado) filtro.estado = req.query.estado
    const solicitudes = await SolicitudLegal.find(filtro)
      .sort({ createdAt: -1 })
      .limit(300)
      .lean()
    res.json(solicitudes)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/privacidad/solicitudes/:id  { estado, respuesta }
router.put('/solicitudes/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const update = {}
    if (req.body?.estado) update.estado = req.body.estado
    if (req.body?.respuesta !== undefined) update.respuesta = String(req.body.respuesta).slice(0, 2000)
    if (req.body?.estado === 'resuelta') update.resueltaEn = new Date()
    const solicitud = await SolicitudLegal.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' })
    res.json(solicitud)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
