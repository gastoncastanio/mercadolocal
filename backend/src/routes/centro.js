import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import ComercioCentro from '../models/ComercioCentro.js'

const router = Router()

// Redondea coordenadas a ~4 decimales (~11 m) para no exponer ubicación exacta
function redondearCoord(n) {
  return Math.round(Number(n) * 10000) / 10000
}

// ============================================================
//  PÚBLICO — alimenta el "Radar del Centro" (cálculo client-side)
// ============================================================

// GET /api/centro/comercios?ciudad=Rosario
// Devuelve comercios activos con sus coords PÚBLICAS. El navegador calcula
// la distancia localmente; la ubicación del usuario nunca llega acá.
router.get('/comercios', async (req, res) => {
  try {
    const filtro = { activo: true }
    if (req.query.ciudad) {
      filtro['ubicacion.ciudad'] = new RegExp(`^${String(req.query.ciudad).trim()}$`, 'i')
    }
    const comercios = await ComercioCentro.find(filtro).limit(200)
    res.json(comercios.map(c => c.toPublic()))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/centro/comercios/:id - detalle público de un comercio
router.get('/comercios/:id', async (req, res) => {
  try {
    const comercio = await ComercioCentro.findById(req.params.id)
    if (!comercio || !comercio.activo) {
      return res.status(404).json({ error: 'Comercio no encontrado' })
    }
    res.json(comercio.toPublic())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================================
//  PANEL DEL COMERCIO — cada dueño gestiona su(s) comercio(s)
// ============================================================

// GET /api/centro/mis-comercios - comercios del usuario logueado
router.get('/mis-comercios', verificarToken, async (req, res) => {
  try {
    const comercios = await ComercioCentro.find({ usuarioId: req.usuario.id })
    res.json(comercios)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/centro/comercios - alta de comercio (el dueño lo crea)
router.post('/comercios', verificarToken, async (req, res) => {
  try {
    const { nombre, rubro, descripcion, ubicacion, bloqueHorarioPrioritario, tiempoPrepEstimado, contacto } = req.body

    if (!nombre || !ubicacion || ubicacion.lat == null || ubicacion.lng == null || !ubicacion.ciudad) {
      return res.status(400).json({ error: 'Nombre, ciudad y coordenadas (lat/lng) son obligatorios' })
    }

    const comercio = await ComercioCentro.create({
      usuarioId: req.usuario.id,
      nombre,
      rubro: rubro || 'cafeteria',
      descripcion: descripcion || '',
      ubicacion: {
        lat: redondearCoord(ubicacion.lat),
        lng: redondearCoord(ubicacion.lng),
        direccion: ubicacion.direccion || '',
        ciudad: String(ubicacion.ciudad).trim()
      },
      bloqueHorarioPrioritario: bloqueHorarioPrioritario || 'todos',
      tiempoPrepEstimado: tiempoPrepEstimado ?? null,
      contacto: contacto || {}
    })

    res.status(201).json(comercio)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PUT /api/centro/comercios/:id - editar (solo el dueño o admin)
router.put('/comercios/:id', verificarToken, async (req, res) => {
  try {
    const comercio = await ComercioCentro.findById(req.params.id)
    if (!comercio) return res.status(404).json({ error: 'Comercio no encontrado' })

    const esDueño = comercio.usuarioId.toString() === req.usuario.id
    if (!esDueño && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' })
    }

    const campos = ['nombre', 'rubro', 'descripcion', 'bloqueHorarioPrioritario', 'tiempoPrepEstimado', 'contacto', 'media', 'activo']
    for (const c of campos) {
      if (req.body[c] !== undefined) comercio[c] = req.body[c]
    }
    if (req.body.ubicacion) {
      const u = req.body.ubicacion
      if (u.lat != null) comercio.ubicacion.lat = redondearCoord(u.lat)
      if (u.lng != null) comercio.ubicacion.lng = redondearCoord(u.lng)
      if (u.direccion !== undefined) comercio.ubicacion.direccion = u.direccion
      if (u.ciudad) comercio.ubicacion.ciudad = String(u.ciudad).trim()
    }

    await comercio.save()
    res.json(comercio)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
