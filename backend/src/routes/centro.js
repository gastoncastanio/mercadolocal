import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import ComercioCentro from '../models/ComercioCentro.js'
import OfertaFlash from '../models/OfertaFlash.js'
import CanjeAtribuido from '../models/CanjeAtribuido.js'
import BloqueHorarioConfig from '../models/BloqueHorarioConfig.js'
import { generarCodigoCanje, hashCodigoCanje } from '../utils/crypto.js'
import { bloqueActual, obtenerBloques } from '../utils/bloqueHorario.js'

const router = Router()

// Minutos que el cliente tiene para llegar al mostrador y canjear su código.
const VENTANA_CANJE_MIN = 30

// Redondea coordenadas a ~4 decimales (~11 m) para no exponer ubicación exacta
function redondearCoord(n) {
  return Math.round(Number(n) * 10000) / 10000
}

// Carga un comercio y verifica que el usuario logueado sea su dueño (o admin).
// Devuelve el comercio o null si no autorizado / inexistente.
async function comercioDelUsuario(comercioId, usuario) {
  const comercio = await ComercioCentro.findById(comercioId)
  if (!comercio) return { error: 404, msg: 'Comercio no encontrado' }
  const esDueño = comercio.usuarioId.toString() === usuario.id
  if (!esDueño && usuario.rol !== 'admin') {
    return { error: 403, msg: 'No autorizado sobre este comercio' }
  }
  return { comercio }
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
    let cambioCiudad = false
    if (req.body.ubicacion) {
      const u = req.body.ubicacion
      if (u.lat != null) comercio.ubicacion.lat = redondearCoord(u.lat)
      if (u.lng != null) comercio.ubicacion.lng = redondearCoord(u.lng)
      if (u.direccion !== undefined) comercio.ubicacion.direccion = u.direccion
      if (u.ciudad && String(u.ciudad).trim() !== comercio.ubicacion.ciudad) {
        comercio.ubicacion.ciudad = String(u.ciudad).trim()
        cambioCiudad = true
      }
    }

    await comercio.save()
    // Si cambió la ciudad, mantenemos la denormalización de las ofertas en sintonía
    // para que el feed las filtre bien por ciudad.
    if (cambioCiudad) {
      await OfertaFlash.updateMany({ comercioId: comercio._id }, { ciudad: comercio.ubicacion.ciudad })
    }
    res.json(comercio)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// DELETE /api/centro/comercios/:id - eliminar el local y sus ofertas (dueño/admin).
// Los canjes ya realizados se conservan como historial (no se borran datos contables).
router.delete('/comercios/:id', verificarToken, async (req, res) => {
  try {
    const acceso = await comercioDelUsuario(req.params.id, req.usuario)
    if (acceso.error) return res.status(acceso.error).json({ error: acceso.msg })

    await OfertaFlash.deleteMany({ comercioId: acceso.comercio._id })
    await acceso.comercio.deleteOne()
    res.json({ ok: true, mensaje: 'Local y ofertas eliminados.' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================================
//  OFERTAS FLASH — feed público
// ============================================================

// GET /api/centro/ofertas?ciudad=&bloque=&comercioId=
// Solo ofertas VIGENTES (ventana temporal abierta + cupo) calculadas con la hora
// del server. El cliente nunca decide si una oferta sigue viva: lo decide el server.
router.get('/ofertas', async (req, res) => {
  try {
    const ahora = new Date()
    const filtro = {
      activa: true,
      inicioEn: { $lte: ahora },
      finEn: { $gte: ahora }
    }
    if (req.query.ciudad) {
      filtro.ciudad = new RegExp(`^${String(req.query.ciudad).trim()}$`, 'i')
    }
    if (req.query.bloque && req.query.bloque !== 'todos') {
      filtro.bloqueHorario = { $in: [String(req.query.bloque), 'todos'] }
    }
    if (req.query.comercioId) {
      filtro.comercioId = req.query.comercioId
    }

    const ofertas = await OfertaFlash.find(filtro).sort({ finEn: 1 }).limit(200)
    // Filtramos cupo agotado acá (estaVigente lo contempla) para no mostrar ofertas muertas.
    const publicas = ofertas
      .filter(o => o.estaVigente(ahora))
      .map(o => o.toPublic(ahora))
    res.json({ serverNow: ahora, ofertas: publicas })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/centro/ofertas/:id - detalle público de una oferta
router.get('/ofertas/:id', async (req, res) => {
  try {
    const ahora = new Date()
    const oferta = await OfertaFlash.findById(req.params.id)
    if (!oferta) return res.status(404).json({ error: 'Oferta no encontrada' })
    res.json(oferta.toPublic(ahora))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/centro/ofertas/:id/reclamar - el usuario reclama un código de canje
// Requiere login (fricción cero hasta acá; recién al reclamar pedimos cuenta).
router.post('/ofertas/:id/reclamar', verificarToken, async (req, res) => {
  try {
    const ahora = new Date()
    const oferta = await OfertaFlash.findById(req.params.id)
    if (!oferta) return res.status(404).json({ error: 'Oferta no encontrada' })
    if (!oferta.estaVigente(ahora)) {
      return res.status(409).json({ error: 'La oferta ya no está vigente.' })
    }

    // ¿El usuario ya tiene un reclamo vigente de esta oferta? (evita duplicados)
    const yaReclamada = await CanjeAtribuido.findOne({
      usuarioId: req.usuario.id,
      ofertaId: oferta._id,
      estado: 'emitido',
      expiraEn: { $gt: ahora }
    })
    if (yaReclamada) {
      return res.status(409).json({ error: 'Ya tenés un código activo para esta oferta. Revisá "Mis canjes".' })
    }

    // Guarda de cupo: contamos lo ya canjeado + reclamos vigentes. La guarda DURA
    // (atómica) ocurre al canjear; esta evita repartir más códigos que cupos.
    if (oferta.cupoTotal > 0) {
      const emitidosVigentes = await CanjeAtribuido.countDocuments({
        ofertaId: oferta._id,
        estado: 'emitido',
        expiraEn: { $gt: ahora }
      })
      if (oferta.cupoUsado + emitidosVigentes >= oferta.cupoTotal) {
        return res.status(409).json({ error: 'No quedan cupos disponibles para esta oferta.' })
      }
    }

    // Genera código legible + hash. El código en claro se devuelve UNA sola vez.
    const { codigo, codigoHash } = generarCodigoCanje()
    const expiraEn = new Date(ahora.getTime() + VENTANA_CANJE_MIN * 60 * 1000)

    let canje
    try {
      canje = await CanjeAtribuido.create({
        usuarioId: req.usuario.id,
        comercioId: oferta.comercioId,
        ofertaId: oferta._id,
        codigoHash,
        estado: 'emitido',
        emitidoEn: ahora,
        expiraEn
      })
    } catch (e) {
      // Choca con el índice único parcial ⇒ carrera: ya hay un reclamo emitido.
      if (e.code === 11000) {
        return res.status(409).json({ error: 'Ya tenés un código activo para esta oferta.' })
      }
      throw e
    }

    res.status(201).json({
      canjeId: canje._id,
      codigo,                 // ⚠️ única vez que viaja en claro
      expiraEn,
      ventanaMin: VENTANA_CANJE_MIN,
      oferta: { _id: oferta._id, titulo: oferta.titulo, comercioId: oferta.comercioId }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/centro/mis-canjes - reclamos del usuario (vigentes y pasados)
router.get('/mis-canjes', verificarToken, async (req, res) => {
  try {
    const ahora = new Date()
    const canjes = await CanjeAtribuido.find({ usuarioId: req.usuario.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('comercioId', 'nombre rubro ubicacion')
      .populate('ofertaId', 'titulo descripcion tipoGancho valorDescuento')

    const data = canjes.map(c => ({
      _id: c._id,
      estado: c.estado === 'emitido' && ahora > c.expiraEn ? 'expirado' : c.estado,
      emitidoEn: c.emitidoEn,
      expiraEn: c.expiraEn,
      canjeadoEn: c.canjeadoEn,
      vigente: c.estaVigente(ahora),
      comercio: c.comercioId,
      oferta: c.ofertaId
    }))
    res.json({ serverNow: ahora, canjes: data })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/centro/canjear - el COMERCIO valida un código en el mostrador.
// Body: { codigo, ticketValor? }. Requiere ser dueño del comercio de la oferta.
router.post('/canjear', verificarToken, async (req, res) => {
  try {
    const ahora = new Date()
    const { codigo, ticketValor } = req.body
    if (!codigo) return res.status(400).json({ error: 'Falta el código de canje.' })

    const codigoHash = hashCodigoCanje(codigo)
    const canje = await CanjeAtribuido.findOne({ codigoHash, estado: 'emitido' })
    if (!canje) {
      return res.status(404).json({ error: 'Código inválido o ya utilizado.' })
    }
    if (ahora > canje.expiraEn) {
      canje.estado = 'expirado'
      await canje.save()
      return res.status(410).json({ error: 'El código expiró. Pedile al cliente que lo vuelva a generar.' })
    }

    // El que canjea debe ser dueño del comercio de la oferta (o admin).
    const acceso = await comercioDelUsuario(canje.comercioId, req.usuario)
    if (acceso.error) return res.status(acceso.error).json({ error: acceso.msg })

    // 1) Transición atómica emitido → canjeado (un solo uso; foto de pantalla no sirve 2 veces).
    const actualizado = await CanjeAtribuido.findOneAndUpdate(
      { _id: canje._id, estado: 'emitido' },
      {
        $set: {
          estado: 'canjeado',
          canjeadoEn: ahora,
          ticketValor: (ticketValor != null && !isNaN(ticketValor)) ? Number(ticketValor) : null
        }
      },
      { new: true }
    )
    if (!actualizado) {
      return res.status(409).json({ error: 'El código ya fue canjeado.' })
    }

    // 2) Consumo ATÓMICO de cupo (imposible vender de más). Si justo se agotó, revertimos.
    const oferta = await OfertaFlash.findOneAndUpdate(
      {
        _id: canje.ofertaId,
        $or: [{ cupoTotal: 0 }, { $expr: { $lt: ['$cupoUsado', '$cupoTotal'] } }]
      },
      { $inc: { cupoUsado: 1 } },
      { new: true }
    )
    if (!oferta) {
      // Cupo agotado en la carrera: revertir el canje para no cobrarle el cupo a nadie.
      await CanjeAtribuido.updateOne(
        { _id: canje._id },
        { $set: { estado: 'emitido', canjeadoEn: null, ticketValor: null } }
      )
      return res.status(409).json({ error: 'Se agotó el cupo justo en este momento.' })
    }

    res.json({
      ok: true,
      mensaje: 'Canje validado ✅',
      oferta: { _id: oferta._id, titulo: oferta.titulo, cupoRestante: oferta.cupoRestante() },
      canjeadoEn: ahora
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================================
//  PANEL DEL COMERCIO — gestión de ofertas y métricas
// ============================================================

// GET /api/centro/mis-ofertas?comercioId= - ofertas de los comercios del usuario
router.get('/mis-ofertas', verificarToken, async (req, res) => {
  try {
    let comercioIds
    if (req.query.comercioId) {
      const acceso = await comercioDelUsuario(req.query.comercioId, req.usuario)
      if (acceso.error) return res.status(acceso.error).json({ error: acceso.msg })
      comercioIds = [acceso.comercio._id]
    } else {
      const mios = await ComercioCentro.find({ usuarioId: req.usuario.id }).select('_id')
      comercioIds = mios.map(c => c._id)
    }
    const ofertas = await OfertaFlash.find({ comercioId: { $in: comercioIds } })
      .sort({ createdAt: -1 })
      .limit(200)
    res.json(ofertas)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/centro/ofertas - crear oferta flash (dueño del comercio)
router.post('/ofertas', verificarToken, async (req, res) => {
  try {
    const { comercioId, titulo, descripcion, tipoGancho, valorDescuento, inicioEn, finEn, cupoTotal, bloqueHorario, condiciones, desbloquea } = req.body

    if (!comercioId || !titulo || !inicioEn || !finEn) {
      return res.status(400).json({ error: 'Comercio, título, inicio y fin son obligatorios.' })
    }
    const acceso = await comercioDelUsuario(comercioId, req.usuario)
    if (acceso.error) return res.status(acceso.error).json({ error: acceso.msg })

    const inicio = new Date(inicioEn)
    const fin = new Date(finEn)
    if (isNaN(inicio) || isNaN(fin) || fin <= inicio) {
      return res.status(400).json({ error: 'La ventana temporal es inválida (fin debe ser posterior al inicio).' })
    }

    const oferta = await OfertaFlash.create({
      comercioId,
      titulo,
      descripcion: descripcion || '',
      tipoGancho: tipoGancho || 'descuento',
      valorDescuento: valorDescuento || 0,
      inicioEn: inicio,
      finEn: fin,
      cupoTotal: cupoTotal ?? 0,
      bloqueHorario: bloqueHorario || 'todos',
      condiciones: condiciones || '',
      desbloquea: desbloquea || {},
      ciudad: acceso.comercio.ubicacion.ciudad // denormalizado para filtrar el feed
    })
    res.status(201).json(oferta)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PUT /api/centro/ofertas/:id - editar / pausar oferta (dueño del comercio)
router.put('/ofertas/:id', verificarToken, async (req, res) => {
  try {
    const oferta = await OfertaFlash.findById(req.params.id)
    if (!oferta) return res.status(404).json({ error: 'Oferta no encontrada' })

    const acceso = await comercioDelUsuario(oferta.comercioId, req.usuario)
    if (acceso.error) return res.status(acceso.error).json({ error: acceso.msg })

    const campos = ['titulo', 'descripcion', 'tipoGancho', 'valorDescuento', 'cupoTotal', 'bloqueHorario', 'condiciones', 'activa', 'desbloquea']
    for (const c of campos) {
      if (req.body[c] !== undefined) oferta[c] = req.body[c]
    }
    if (req.body.inicioEn) oferta.inicioEn = new Date(req.body.inicioEn)
    if (req.body.finEn) oferta.finEn = new Date(req.body.finEn)
    if (oferta.finEn <= oferta.inicioEn) {
      return res.status(400).json({ error: 'El fin debe ser posterior al inicio.' })
    }

    await oferta.save()
    res.json(oferta)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// DELETE /api/centro/ofertas/:id - eliminar una oferta (dueño del comercio).
// Si hay códigos sin canjear, se cancelan para que no queden "vivos".
router.delete('/ofertas/:id', verificarToken, async (req, res) => {
  try {
    const oferta = await OfertaFlash.findById(req.params.id)
    if (!oferta) return res.status(404).json({ error: 'Oferta no encontrada' })

    const acceso = await comercioDelUsuario(oferta.comercioId, req.usuario)
    if (acceso.error) return res.status(acceso.error).json({ error: acceso.msg })

    // Cancelamos los reclamos vigentes (pasan a expirado) para no dejar QR canjeables
    // de una oferta que ya no existe.
    await CanjeAtribuido.updateMany(
      { ofertaId: oferta._id, estado: 'emitido' },
      { $set: { estado: 'expirado' } }
    )
    await oferta.deleteOne()
    res.json({ ok: true, mensaje: 'Oferta eliminada.' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/centro/metricas/:comercioId - ROI real del comercio (canjes, ticket promedio)
router.get('/metricas/:comercioId', verificarToken, async (req, res) => {
  try {
    const acceso = await comercioDelUsuario(req.params.comercioId, req.usuario)
    if (acceso.error) return res.status(acceso.error).json({ error: acceso.msg })

    const comercioId = acceso.comercio._id
    const [emitidos, canjeados, agg] = await Promise.all([
      CanjeAtribuido.countDocuments({ comercioId, estado: 'emitido' }),
      CanjeAtribuido.countDocuments({ comercioId, estado: 'canjeado' }),
      CanjeAtribuido.aggregate([
        { $match: { comercioId, estado: 'canjeado', ticketValor: { $ne: null } } },
        { $group: { _id: null, total: { $sum: '$ticketValor' }, n: { $sum: 1 } } }
      ])
    ])

    const totalReclamos = emitidos + canjeados
    const ticketPromedio = agg[0]?.n ? agg[0].total / agg[0].n : null
    res.json({
      reclamos: totalReclamos,
      canjeados,
      tasaConversion: totalReclamos ? Math.round((canjeados / totalReclamos) * 100) : 0,
      ticketPromedio,
      ingresoAtribuido: agg[0]?.total || 0
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================================
//  FASE 3 — Bloques horarios dinámicos y despachador
// ============================================================

// GET /api/centro/bloque/actual - bloque horario activo AHORA
router.get('/bloque/actual', async (req, res) => {
  try {
    const bloque = await bloqueActual()
    res.json({ bloque })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/centro/bloques - lista de bloques configurados (para UI)
router.get('/bloques', async (req, res) => {
  try {
    const bloques = await obtenerBloques()
    res.json(bloques)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/centro/ofertas/bloque/:nombre - ofertas del bloque actual o específico
// Dispatch dinámico: si tipoDispatcher='cercania', filtra por distancia real del usuario
// Si 'cruzada', devuelve ofertas con desbloquea (sugerencias de ruta).
// El cliente debe enviar ?lat=X&lng=Y si quiere filtro de cercanía.
router.get('/ofertas/bloque/:nombre', async (req, res) => {
  try {
    const ahora = new Date()
    const { nombre } = req.params
    const { lat, lng, ciudad } = req.query

    // Obtén la config del bloque (valida que exista + esté activo)
    const bloqueConfig = await BloqueHorarioConfig.findOne({ nombre, activo: true }).lean()
    if (!bloqueConfig) {
      return res.status(404).json({ error: `Bloque "${nombre}" no disponible.` })
    }

    const filtro = {
      activa: true,
      inicioEn: { $lte: ahora },
      finEn: { $gte: ahora },
      bloqueHorario: { $in: [nombre, 'todos'] }
    }
    if (ciudad) {
      filtro.ciudad = new RegExp(`^${String(ciudad).trim()}$`, 'i')
    }

    const ofertas = await OfertaFlash.find(filtro)
      .populate('comercioId', 'nombre ubicacion')
      .sort({ finEn: 1 })
      .limit(100)

    // Filtra solo vigentes (con cupo)
    const vigentes = ofertas.filter(o => o.estaVigente(ahora))

    // Despacha según tipo del bloque
    let resultado = vigentes.map(o => ({
      ...o.toPublic(ahora),
      comercioNombre: o.comercioId?.nombre,
      comercioLat: o.comercioId?.ubicacion?.lat,
      comercioLng: o.comercioId?.ubicacion?.lng
    }))

    if (bloqueConfig.tipoDispatcher === 'cercania' && lat != null && lng != null) {
      // Calcula distancia client-side: ordena por proximidad, filtra < distanciaMaxima
      const clientLat = Number(lat)
      const clientLng = Number(lng)
      if (!isNaN(clientLat) && !isNaN(clientLng)) {
        resultado = resultado
          .map(o => ({
            ...o,
            distancia: calcularDistancia(clientLat, clientLng, o.comercioLat, o.comercioLng)
          }))
          .filter(o => o.distancia <= bloqueConfig.distanciaMaxima)
          .sort((a, b) => a.distancia - b.distancia)
      }
    } else if (bloqueConfig.tipoDispatcher === 'cruzada') {
      // Para 'Desconexión e Impulso': prioriza ofertas con desbloquea
      resultado.sort((a, b) => {
        const aDesbloquea = a.desbloquea ? 1 : 0
        const bDesbloquea = b.desbloquea ? 1 : 0
        return bDesbloquea - aDesbloquea // desbloquea primero
      })
    }

    res.json({
      serverNow: ahora,
      bloque: bloqueConfig,
      ofertas: resultado
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================================
//  ADMIN — configuración de bloques horarios
// ============================================================

// POST /api/centro/admin/bloques - crear bloque (solo admin)
router.post('/admin/bloques', verificarToken, async (req, res) => {
  try {
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden configurar bloques.' })
    }

    const { nombre, horaInicio, horaFin, titulo, descripcion, tipoDispatcher, distanciaMaxima } = req.body

    if (!nombre || !horaInicio || !horaFin || !titulo) {
      return res.status(400).json({ error: 'Nombre, horas y título son obligatorios.' })
    }

    // Valida que no exista un bloque con ese nombre
    const existe = await BloqueHorarioConfig.findOne({ nombre })
    if (existe) {
      return res.status(409).json({ error: `Bloque "${nombre}" ya existe.` })
    }

    const bloque = await BloqueHorarioConfig.create({
      nombre,
      horaInicio,
      horaFin,
      titulo,
      descripcion: descripcion || '',
      tipoDispatcher: tipoDispatcher || 'general',
      distanciaMaxima: distanciaMaxima || 300
    })

    res.status(201).json(bloque)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PUT /api/centro/admin/bloques/:nombre - editar bloque (solo admin)
router.put('/admin/bloques/:nombre', verificarToken, async (req, res) => {
  try {
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden configurar bloques.' })
    }

    const bloque = await BloqueHorarioConfig.findOne({ nombre: req.params.nombre })
    if (!bloque) {
      return res.status(404).json({ error: 'Bloque no encontrado.' })
    }

    const campos = ['horaInicio', 'horaFin', 'titulo', 'descripcion', 'tipoDispatcher', 'distanciaMaxima', 'activo']
    for (const c of campos) {
      if (req.body[c] !== undefined) bloque[c] = req.body[c]
    }

    await bloque.save()
    res.json(bloque)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// DELETE /api/centro/admin/bloques/:nombre - eliminar bloque (solo admin)
router.delete('/admin/bloques/:nombre', verificarToken, async (req, res) => {
  try {
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden configurar bloques.' })
    }

    const bloque = await BloqueHorarioConfig.findOneAndDelete({ nombre: req.params.nombre })
    if (!bloque) {
      return res.status(404).json({ error: 'Bloque no encontrado.' })
    }

    // Al eliminar un bloque, las ofertas vinculadas quedan con bloqueHorario='todos' o se mantienen
    // (no borramos ofertas; solo se dejan sin bloque específico)
    res.json({ ok: true, mensaje: 'Bloque eliminado.' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Helper: Haversine distance entre dos coords (lat/lng en grados)
function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371000 // Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // distancia en metros
}

export default router
