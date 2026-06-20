import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import ComercioCentro from '../models/ComercioCentro.js'
import OfertaFlash from '../models/OfertaFlash.js'
import CanjeAtribuido from '../models/CanjeAtribuido.js'
import BloqueHorarioConfig from '../models/BloqueHorarioConfig.js'
import { generarCodigoCanje, hashCodigoCanje } from '../utils/crypto.js'
import { bloqueActual, obtenerBloques, bloqueSiguienteGancho } from '../utils/bloqueHorario.js'
import { crearPreferenciaOferta, obtenerPago, buscarPagoPorReferencia } from '../config/mercadopago.js'
import { emitLiquidacionRelampago, emitNotificacion } from '../services/socketService.js'

const router = Router()

// Minutos que el cliente tiene para llegar al mostrador y canjear su código.
const VENTANA_CANJE_MIN = 30

// Redondea coordenadas a ~4 decimales (~11 m) para no exponer ubicación exacta
function redondearCoord(n) {
  return Math.round(Number(n) * 10000) / 10000
}

// Escapa los metacaracteres de regex de un texto del usuario. Sin esto, un
// `?ciudad=(a+)+$` se interpreta como regex y abre la puerta a ReDoS (backtracking
// catastrófico que clava la CPU). Devuelve un regex de igualdad exacta, case-insensitive.
function ciudadExacta(valor) {
  const limpio = String(valor || '').trim().slice(0, 100)
  const escapado = limpio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escapado}$`, 'i')
}

// Valida que lat/lng sean números dentro del rango geográfico real. Coordenadas
// fuera de rango (o NaN) romperían el cálculo de distancia Haversine en el cliente.
function coordsValidas(lat, lng) {
  const la = Number(lat)
  const ln = Number(lng)
  return Number.isFinite(la) && Number.isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180
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
      filtro['ubicacion.ciudad'] = ciudadExacta(req.query.ciudad)
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
    const { nombre, rubro, descripcion, ubicacion, bloqueHorarioPrioritario, tiempoPrepEstimado, contacto, media } = req.body

    if (!nombre || !ubicacion || ubicacion.lat == null || ubicacion.lng == null || !ubicacion.ciudad) {
      return res.status(400).json({ error: 'Nombre, ciudad y coordenadas (lat/lng) son obligatorios' })
    }
    if (!coordsValidas(ubicacion.lat, ubicacion.lng)) {
      return res.status(400).json({ error: 'Coordenadas inválidas (lat −90..90, lng −180..180).' })
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
      contacto: contacto || {},
      media: media || {}
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

    const campos = ['nombre', 'rubro', 'descripcion', 'bloqueHorarioPrioritario', 'tiempoPrepEstimado', 'contacto', 'activo']
    for (const c of campos) {
      if (req.body[c] !== undefined) comercio[c] = req.body[c]
    }
    // media se mergea campo a campo: un PUT con solo {logo} no debe borrar
    // videoLoopUrl/posterUrl/fotos (micro-contenido de Fase 4).
    if (req.body.media && typeof req.body.media === 'object') {
      for (const k of ['logo', 'videoLoopUrl', 'posterUrl', 'fotos']) {
        if (req.body.media[k] !== undefined) comercio.media[k] = req.body.media[k]
      }
    }
    // La verificación es un acto del admin (otorga confianza), no del dueño.
    if (req.body.verificado !== undefined && req.usuario.rol === 'admin') {
      comercio.verificado = !!req.body.verificado
    }
    let cambioCiudad = false
    if (req.body.ubicacion) {
      const u = req.body.ubicacion
      // Validar contra el valor efectivo (el nuevo si vino, si no el actual).
      if (u.lat != null || u.lng != null) {
        const latEf = u.lat != null ? u.lat : comercio.ubicacion.lat
        const lngEf = u.lng != null ? u.lng : comercio.ubicacion.lng
        if (!coordsValidas(latEf, lngEf)) {
          return res.status(400).json({ error: 'Coordenadas inválidas (lat −90..90, lng −180..180).' })
        }
      }
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

    // Protección al consumidor: si hay canjes PAGADOS y todavía no canjeados, el
    // comercio les debe el producto (haya o no vencido la ventana). No se puede
    // borrar el local hasta honrarlos (o reembolsar).
    const pagadosVivos = await CanjeAtribuido.countDocuments({
      comercioId: acceso.comercio._id,
      estadoPago: 'pagado',
      estado: { $ne: 'canjeado' }
    })
    if (pagadosVivos > 0) {
      return res.status(409).json({
        error: `No podés eliminar el local: hay ${pagadosVivos} canje(s) pagado(s) sin usar. Atendelos o reembolsalos antes de borrar.`
      })
    }

    // Expiramos los reclamos sin pagar que quedaran vivos (legacy postpago) para no
    // dejar códigos "emitido" apuntando a un comercio inexistente.
    await CanjeAtribuido.updateMany(
      { comercioId: acceso.comercio._id, estado: 'emitido' },
      { $set: { estado: 'expirado' } }
    )
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
      filtro.ciudad = ciudadExacta(req.query.ciudad)
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

    // Limpieza perezosa: marcamos como 'expirado' cualquier reclamo de este
    // usuario para esta oferta cuya ventana ya venció pero que quedó en 'emitido'
    // (nada lo había transicionado). Esto LIBERA el slot del índice único parcial:
    // sin esto, un código vencido bloquea para siempre volver a reclamar la oferta
    // (deadlock: el canje vencido ocupa el slot único aunque ya no sirva).
    await CanjeAtribuido.updateMany(
      { usuarioId: req.usuario.id, ofertaId: oferta._id, estado: 'emitido', expiraEn: { $lte: ahora } },
      { $set: { estado: 'expirado' } }
    )

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
    // Excluimos los prepago que quedaron sin pagar (checkout abandonado): no son canjes
    // reales, solo registros temporales a la espera de pago.
    const canjes = await CanjeAtribuido.find({
      usuarioId: req.usuario.id,
      estadoPago: { $ne: 'pendiente_pago' }
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('comercioId', 'nombre rubro ubicacion')
      .populate('ofertaId', 'titulo descripcion tipoGancho valorDescuento')

    const data = canjes.map(c => {
      // Pagó pero el código nunca se generó (cerró el navegador al volver de MP).
      // No es un canje "expirado": es plata que el usuario puede recuperar pidiendo
      // su código (confirmar-pago lo regenera y renueva la ventana).
      const pagadoSinCodigo = c.estadoPago === 'pagado' && !c.codigoHash
      return {
        _id: c._id,
        estado: pagadoSinCodigo
          ? 'pagado_sin_codigo'
          : (c.estado === 'emitido' && ahora > c.expiraEn ? 'expirado' : c.estado),
        emitidoEn: c.emitidoEn,
        expiraEn: c.expiraEn,
        canjeadoEn: c.canjeadoEn,
        vigente: c.estaVigente(ahora),
        estadoPago: c.estadoPago,
        pagadoSinCodigo,
        tipoReclamo: c.tipoReclamo,
        cuponPorcentaje: c.cuponPorcentaje,
        comercio: c.comercioId,
        oferta: c.ofertaId
      }
    })
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
    const {
      comercioId,
      titulo,
      descripcion,
      imagen,
      imagenPosicion,
      tipoGancho,
      valorDescuento,
      inicioEn,
      finEn,
      cupoTotal,
      bloqueHorario,
      condiciones,
      desbloquea,
      cuponCruzado,
      // FASE 3: campos de prepago
      precioFinal,
      comisionPorcentaje,
      requierePrepagoApp
    } = req.body

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

    // Validar campos de prepago si aplica: precio con tope razonable (evita
    // ofertas malformadas que MercadoPago rechazaría, o cobros absurdos).
    if (requierePrepagoApp) {
      const precio = Number(precioFinal)
      if (!Number.isFinite(precio) || precio <= 0 || precio > 1000000) {
        return res.status(400).json({ error: 'El precio de prepago debe estar entre $1 y $1.000.000.' })
      }
      if (comisionPorcentaje != null) {
        const com = Number(comisionPorcentaje)
        if (!Number.isFinite(com) || com < 0 || com > 100) {
          return res.status(400).json({ error: 'La comisión debe estar entre 0% y 100%.' })
        }
      }
    }

    const oferta = await OfertaFlash.create({
      comercioId,
      titulo,
      descripcion: descripcion || '',
      imagen: imagen || '',
      imagenPosicion: imagenPosicion || '50% 50%',
      tipoGancho: tipoGancho || 'descuento',
      valorDescuento: valorDescuento || 0,
      inicioEn: inicio,
      finEn: fin,
      cupoTotal: cupoTotal ?? 0,
      bloqueHorario: bloqueHorario || 'todos',
      condiciones: condiciones || '',
      desbloquea: desbloquea || {},
      cuponCruzado: cuponCruzado || {},
      ciudad: acceso.comercio.ubicacion.ciudad,
      // FASE 3: almacena los datos de prepago
      precioFinal: precioFinal || 0,
      comisionPorcentaje: comisionPorcentaje || 7,
      requierePrepagoApp: requierePrepagoApp || false
    })
    res.status(201).json(oferta)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/centro/ofertas/liquidacion-relampago - "botón de pánico" anti-desperdicio.
// El comercio liquida stock que sobra (facturas, platos del día) en una ventana
// corta. Crea una OfertaFlash de duración limitada y la difunde EN VIVO al Radar
// de la ciudad; cada cliente filtra por su propia distancia (privacy-first).
router.post('/ofertas/liquidacion-relampago', verificarToken, async (req, res) => {
  try {
    const { comercioId, titulo, descripcion, imagen, imagenPosicion, valorDescuento, cupoTotal, duracionMin, condiciones } = req.body

    if (!comercioId || !titulo) {
      return res.status(400).json({ error: 'Comercio y título son obligatorios.' })
    }
    const acceso = await comercioDelUsuario(comercioId, req.usuario)
    if (acceso.error) return res.status(acceso.error).json({ error: acceso.msg })

    // Ventana corta: por defecto 45 min, acotada entre 15 y 180 min.
    const minutos = Math.min(180, Math.max(15, Number(duracionMin) || 45))
    const inicio = new Date()
    const fin = new Date(inicio.getTime() + minutos * 60 * 1000)

    const oferta = await OfertaFlash.create({
      comercioId,
      titulo,
      descripcion: descripcion || '',
      imagen: imagen || '',
      imagenPosicion: imagenPosicion || '50% 50%',
      tipoGancho: 'descuento',
      valorDescuento: Math.min(100, Math.max(0, Number(valorDescuento) || 0)),
      inicioEn: inicio,
      finEn: fin,
      cupoTotal: Math.max(0, Number(cupoTotal) || 0),
      bloqueHorario: 'todos',
      condiciones: condiciones || 'Sujeto a disponibilidad. Retiro en el local dentro de la ventana de la oferta.',
      ciudad: acceso.comercio.ubicacion.ciudad,
      // El anti-desperdicio es postpago en mostrador (recuperar costo, no monetizar app).
      requierePrepagoApp: false,
      precioFinal: 0
    })

    // Difundir EN VIVO al Radar de la ciudad. Mandamos las coords del comercio y
    // el radio; el cliente decide si mostrar la alerta según su propia distancia.
    emitLiquidacionRelampago(acceso.comercio.ubicacion.ciudad, {
      ofertaId: oferta._id,
      titulo: oferta.titulo,
      descripcion: oferta.descripcion,
      imagen: oferta.imagen,
      imagenPosicion: oferta.imagenPosicion,
      valorDescuento: oferta.valorDescuento,
      finEn: oferta.finEn,
      cupoTotal: oferta.cupoTotal,
      comercio: {
        _id: acceso.comercio._id,
        nombre: acceso.comercio.nombre,
        logo: acceso.comercio.media?.logo || '',
        verificado: acceso.comercio.verificado,
        lat: acceso.comercio.ubicacion.lat,
        lng: acceso.comercio.ubicacion.lng
      },
      radioMetros: 1500 // ~15 cuadras
    })

    res.status(201).json(oferta)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ============================================================
//  GAMIFICACIÓN CRUZADA — la cadena de ganchos del día
// ============================================================

// GET /api/centro/cruzada/sugerencias?desde=<bloque>&ciudad=
// Tras comprar en un bloque (ej. desayuno), sugerimos UNA promo del bloque
// gastronómico siguiente (almuerzo) que tenga "cupón cruzado" activo. La promo
// puede no estar vigente todavía (su ventana es más tarde): se reserva por
// adelantado. Si no se manda `desde`, se infiere del bloque activo a esta hora.
router.get('/cruzada/sugerencias', async (req, res) => {
  try {
    const { desde, ciudad } = req.query
    const ahora = new Date()

    // Bloque base: el que se acaba de completar, o el activo ahora mismo.
    let base = desde
    if (!base) {
      const actual = await bloqueActual()
      base = actual?.nombre
    }
    if (!base) return res.json({ sugerencia: null })

    const siguiente = bloqueSiguienteGancho(base)
    if (!siguiente) return res.json({ sugerencia: null })

    const filtro = {
      activa: true,
      finEn: { $gte: ahora }, // que no haya terminado su ventana
      bloqueHorario: siguiente,
      'cuponCruzado.activo': true
    }
    if (ciudad) filtro.ciudad = ciudadExacta(ciudad)

    // Mejor gancho primero: mayor % de cupón, luego la que arranca antes.
    const oferta = await OfertaFlash.findOne(filtro)
      .populate('comercioId', 'nombre ubicacion')
      .sort({ 'cuponCruzado.porcentaje': -1, inicioEn: 1 })

    if (!oferta) return res.json({ sugerencia: null })

    res.json({
      sugerencia: {
        ofertaId: oferta._id,
        titulo: oferta.titulo,
        descripcion: oferta.descripcion,
        precioFinal: oferta.precioFinal,
        valorDescuento: oferta.valorDescuento,
        cuponPorcentaje: oferta.cuponCruzado?.porcentaje || 0,
        mensaje: oferta.cuponCruzado?.mensaje || '',
        comercioNombre: oferta.comercioId?.nombre,
        bloque: siguiente,
        inicioEn: oferta.inicioEn,
        finEn: oferta.finEn
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/centro/cruzada/reservar - el cliente confirma el gancho del bloque
// siguiente. Genera un canje con el cupón extra y AVISA al comercio para que
// prepare la mesa "con invitación especial de Mercado Local".
router.post('/cruzada/reservar', verificarToken, async (req, res) => {
  try {
    const ahora = new Date()
    const { ofertaId } = req.body
    if (!ofertaId) return res.status(400).json({ error: 'Falta la oferta a reservar.' })

    const oferta = await OfertaFlash.findById(ofertaId).populate('comercioId', 'nombre usuarioId ubicacion')
    if (!oferta) return res.status(404).json({ error: 'Oferta no encontrada' })
    if (!oferta.cuponCruzado?.activo) {
      return res.status(409).json({ error: 'Esta promo ya no ofrece cupón de reserva.' })
    }
    if (!oferta.activa || ahora > oferta.finEn) {
      return res.status(409).json({ error: 'La promo ya no está disponible para reservar.' })
    }

    // Limpieza perezosa (igual que en reclamar): si quedó una reserva 'emitido'
    // vencida, la expiramos para liberar el slot del índice único parcial.
    await CanjeAtribuido.updateMany(
      { usuarioId: req.usuario.id, ofertaId: oferta._id, estado: 'emitido', expiraEn: { $lte: ahora } },
      { $set: { estado: 'expirado' } }
    )

    // ¿Ya tiene una reserva/canje vigente de esta oferta? (evita duplicar)
    const yaReservada = await CanjeAtribuido.findOne({
      usuarioId: req.usuario.id,
      ofertaId: oferta._id,
      estado: 'emitido',
      expiraEn: { $gt: ahora }
    })
    if (yaReservada) {
      return res.status(409).json({ error: 'Ya tenés esta promo reservada. Mirá "Mis canjes".' })
    }

    // Guarda de cupo (blanda): no repartir más reservas que cupos.
    if (oferta.cupoTotal > 0) {
      const emitidosVigentes = await CanjeAtribuido.countDocuments({
        ofertaId: oferta._id,
        estado: 'emitido',
        expiraEn: { $gt: ahora }
      })
      if (oferta.cupoUsado + emitidosVigentes >= oferta.cupoTotal) {
        return res.status(409).json({ error: 'No quedan cupos para reservar esta promo.' })
      }
    }

    // El código vive hasta que termine la ventana de la promo (la mesa lo espera).
    const { codigo, codigoHash } = generarCodigoCanje()
    let canje
    try {
      canje = await CanjeAtribuido.create({
        usuarioId: req.usuario.id,
        comercioId: oferta.comercioId._id,
        ofertaId: oferta._id,
        codigoHash,
        estado: 'emitido',
        emitidoEn: ahora,
        expiraEn: oferta.finEn,
        tipoReclamo: 'reserva_cruzada',
        cuponPorcentaje: oferta.cuponCruzado.porcentaje || 0
      })
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ error: 'Ya tenés esta promo reservada.' })
      }
      throw e
    }

    // Avisar al comercio: preparen la mesa con la invitación especial.
    if (oferta.comercioId?.usuarioId) {
      emitNotificacion(oferta.comercioId.usuarioId.toString(), {
        tipo: 'reserva_cruzada',
        titulo: '🪑 Nueva reserva con invitación Mercado Local',
        mensaje: `Un cliente reservó "${oferta.titulo}" con cupón ${oferta.cuponCruzado.porcentaje || 0}%. Prepará la mesa con la invitación especial.`,
        enlace: '/panel-comercio'
      })
    }

    res.status(201).json({
      canjeId: canje._id,
      codigo, // ⚠️ única vez que viaja en claro
      expiraEn: canje.expiraEn,
      cuponPorcentaje: canje.cuponPorcentaje,
      comercioNombre: oferta.comercioId?.nombre,
      titulo: oferta.titulo
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/centro/ofertas/:id - editar / pausar oferta (dueño del comercio)
router.put('/ofertas/:id', verificarToken, async (req, res) => {
  try {
    const oferta = await OfertaFlash.findById(req.params.id)
    if (!oferta) return res.status(404).json({ error: 'Oferta no encontrada' })

    const acceso = await comercioDelUsuario(oferta.comercioId, req.usuario)
    if (acceso.error) return res.status(acceso.error).json({ error: acceso.msg })

    const campos = ['titulo', 'descripcion', 'imagen', 'imagenPosicion', 'tipoGancho', 'valorDescuento', 'cupoTotal', 'bloqueHorario', 'condiciones', 'activa', 'desbloquea', 'cuponCruzado', 'precioFinal', 'comisionPorcentaje', 'requierePrepagoApp']
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
      filtro.ciudad = ciudadExacta(ciudad)
    }

    const ofertas = await OfertaFlash.find(filtro)
      .populate('comercioId', 'nombre ubicacion media verificado estadoPrograma')
      .sort({ finEn: 1 })
      .limit(100)

    // Filtra solo vigentes (con cupo)
    const vigentes = ofertas.filter(o => o.estaVigente(ahora))

    // Despacha según tipo del bloque
    let resultado = vigentes.map(o => ({
      ...o.toPublic(ahora),
      comercioNombre: o.comercioId?.nombre,
      comercioLogo: o.comercioId?.media?.logo || '',
      // Verificado = acto explícito del admin (no se infiere de 'fundador', que es
      // un estado de programa distinto). Consistente con el feed y el broadcast.
      comercioVerificado: !!o.comercioId?.verificado,
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
//  FASE 3 — Monetización prepago (MercadoPago)
// ============================================================

// POST /api/centro/ofertas/:id/checkout - inicia pago prepago para una oferta
// Crea una preferencia de MercadoPago y devuelve la URL para redirigir al usuario
router.post('/ofertas/:id/checkout', verificarToken, async (req, res) => {
  try {
    const ahora = new Date()
    const oferta = await OfertaFlash.findById(req.params.id)
    if (!oferta) return res.status(404).json({ error: 'Oferta no encontrada' })

    // Validar que esté vigente
    if (!oferta.estaVigente(ahora)) {
      return res.status(409).json({ error: 'La oferta ya no está vigente.' })
    }

    // Validar que requiera prepago
    if (!oferta.requierePrepagoApp) {
      return res.status(400).json({ error: 'Esta oferta no requiere prepago.' })
    }

    // Limpieza perezosa: un checkout abandonado (pago nunca confirmado) cuya
    // ventana venció queda en 'emitido'/'pendiente_pago'. Sin transicionarlo,
    // bloquea PARA SIEMPRE tanto re-pagar (guard de abajo) como reclamar (índice
    // único parcial sobre estado 'emitido'). Lo expiramos para liberar ambos.
    await CanjeAtribuido.updateMany(
      { usuarioId: req.usuario.id, ofertaId: oferta._id, estado: 'emitido', estadoPago: 'pendiente_pago', expiraEn: { $lte: ahora } },
      { $set: { estado: 'expirado' } }
    )

    // Evitar acaparamiento: ¿el usuario ya tiene un canje pendiente de pago VIGENTE?
    const yaReclamo = await CanjeAtribuido.findOne({
      usuarioId: req.usuario.id,
      ofertaId: oferta._id,
      estadoPago: 'pendiente_pago',
      expiraEn: { $gt: ahora }
    })
    if (yaReclamo) {
      return res.status(409).json({ error: 'Ya tenés un pago pendiente para esta oferta. Esperá unos minutos o revisá "Mis canjes".' })
    }

    // Crear registro de canje (aún sin pago confirmado). Si choca con el índice
    // único parcial es porque ya existe un canje 'emitido' de esta oferta (p. ej.
    // un pago anterior que quedó confirmado pero sin código): lo derivamos a "Mis
    // canjes" en vez de cobrar dos veces.
    let canje
    try {
      canje = await CanjeAtribuido.create({
        usuarioId: req.usuario.id,
        comercioId: oferta.comercioId,
        ofertaId: oferta._id,
        codigoHash: '', // Se completa después del pago
        estado: 'emitido',
        estadoPago: 'pendiente_pago',
        emitidoEn: ahora,
        expiraEn: new Date(ahora.getTime() + 15 * 60 * 1000), // 15 min window
        montoCentavos: Math.round(oferta.precioFinal * 100)
      })
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ error: 'Ya tenés un canje activo para esta oferta. Revisá "Mis canjes".' })
      }
      throw e
    }

    // Crear preferencia en MercadoPago
    const mpResponse = await crearPreferenciaOferta(oferta, req.usuario, canje._id)

    // Guardar el ID de preferencia en el canje
    canje.mercadopagoPreferenceId = mpResponse.preferenceId
    await canje.save()

    res.status(201).json({
      canjeId: canje._id,
      initPoint: mpResponse.initPoint,
      sandboxInitPoint: mpResponse.sandboxInitPoint,
      precioFinal: oferta.precioFinal,
      comisionPorcentaje: oferta.comisionPorcentaje,
      oferta: { _id: oferta._id, titulo: oferta.titulo }
    })
  } catch (error) {
    console.error('Error en checkout:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/centro/webhook/mercadopago - webhook de MercadoPago.
// MercadoPago avisa acá cuando cambia un pago. Marcamos el canje como pagado
// (red de seguridad: si el usuario cierra el navegador, igual queda confirmado).
// El código en claro NO se genera acá (no hay sesión del usuario); se entrega en
// confirmar-pago. Por eso solo marcamos estadoPago, dejando codigoHash vacío.
router.post('/webhook/mercadopago', async (req, res) => {
  // Respondemos 200 siempre y rápido: MP reintenta si no recibe 200.
  try {
    const tipo = req.body?.type || req.query?.type
    const paymentId = req.body?.data?.id || req.query['data.id'] || req.query.id

    if (tipo !== 'payment' || !paymentId) {
      return res.status(200).send('OK')
    }

    const pago = await obtenerPago(paymentId)
    if (!pago || pago.status !== 'approved') {
      return res.status(200).send('OK')
    }

    // external_reference = canjeId (lo seteamos al crear la preferencia)
    const canjeId = pago.external_reference
    const canje = await CanjeAtribuido.findById(canjeId)
    if (!canje) {
      console.warn(`⚠️ Webhook centro: canje ${canjeId} no encontrado`)
      return res.status(200).send('OK')
    }

    // Idempotente: si ya está pagado, no hacemos nada.
    if (canje.estadoPago === 'pendiente_pago') {
      canje.estadoPago = 'pagado'
      await canje.save()
      console.log(`✅ Webhook centro: canje ${canjeId} marcado como pagado`)
    }
    return res.status(200).send('OK')
  } catch (error) {
    console.error('Error en webhook MercadoPago (centro):', error?.message || error)
    return res.status(200).send('OK')
  }
})

// GET /api/centro/canje/:id/estado-pago - estado del pago (solo lectura, sin código).
// El cliente lo usa para saber si ya está pagado; el código se pide con confirmar-pago.
router.get('/canje/:id/estado-pago', verificarToken, async (req, res) => {
  try {
    const canje = await CanjeAtribuido.findById(req.params.id)
    if (!canje) return res.status(404).json({ error: 'Canje no encontrado' })
    if (canje.usuarioId.toString() !== req.usuario.id) {
      return res.status(403).json({ error: 'No autorizado' })
    }

    res.json({
      canjeId: canje._id,
      estadoPago: canje.estadoPago,
      estado: canje.estado,
      pagado: canje.estadoPago === 'pagado',
      // ¿el código ya se entregó? (si sí, vive solo en el caché del cliente)
      codigoEntregado: !!canje.codigoHash
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/centro/canje/:id/confirmar-pago - tras volver de MP, el cliente pide su código.
// Validamos el pago CONTRA MercadoPago (no confiamos en el cliente). El código en claro
// se genera y se devuelve UNA sola vez; después solo vive en el caché del navegador.
router.post('/canje/:id/confirmar-pago', verificarToken, async (req, res) => {
  try {
    const canje = await CanjeAtribuido.findById(req.params.id)
    if (!canje) return res.status(404).json({ error: 'Canje no encontrado' })
    if (canje.usuarioId.toString() !== req.usuario.id) {
      return res.status(403).json({ error: 'No autorizado' })
    }

    // Si el código ya fue generado y entregado, no podemos volver a mostrarlo en claro
    // (solo guardamos el hash). El cliente debe usar su caché local.
    if (canje.codigoHash) {
      return res.json({ canjeId: canje._id, pagado: true, yaConfirmado: true, codigo: null })
    }

    // Validar el pago realmente en MercadoPago (por external_reference = canjeId).
    let aprobado = canje.estadoPago === 'pagado'
    if (!aprobado) {
      const pago = await buscarPagoPorReferencia(canje._id.toString())
      aprobado = pago?.status === 'approved'
    }
    if (!aprobado) {
      return res.json({ canjeId: canje._id, pagado: false, codigo: null })
    }

    // Pago confirmado: generamos el código de canje y guardamos solo su hash.
    const { codigo, codigoHash } = generarCodigoCanje()
    canje.estadoPago = 'pagado'
    canje.codigoHash = codigoHash
    // Renovamos la ventana de canje desde la confirmación del pago (30 min para ir al local).
    canje.expiraEn = new Date(Date.now() + VENTANA_CANJE_MIN * 60 * 1000)
    await canje.save()

    res.json({
      canjeId: canje._id,
      pagado: true,
      codigo, // ⚠️ única vez que viaja en claro
      expiraEn: canje.expiraEn
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
