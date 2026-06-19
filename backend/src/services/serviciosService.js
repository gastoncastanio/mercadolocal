import PerfilProfesional from '../models/PerfilProfesional.js'
import SolicitudServicio from '../models/SolicitudServicio.js'
import ResenaServicio from '../models/ResenaServicio.js'
import TrabajoBuscado from '../models/TrabajoBuscado.js'
import Bid from '../models/Bid.js'
import Usuario from '../models/Usuario.js'
import { emitNotificacion } from './socketService.js'

// ===== PerfilProfesional =====
export async function crearPerfilProfesional(usuarioId, datos) {
  // Validar que el usuario no tenga ya un perfil
  const perfilExistente = await PerfilProfesional.findOne({ usuarioId })
  if (perfilExistente) throw new Error('Ya tienes un perfil profesional')

  const perfil = new PerfilProfesional({
    usuarioId,
    rubro: datos.rubro,
    nombreNegocio: datos.nombreNegocio || '',
    descripcion: datos.descripcion || '',
    experiencia: datos.experiencia || '',
    habilidades: datos.habilidades || [],
    añosExperiencia: datos.añosExperiencia || 0,
    localidad: datos.localidad,
    zonasCobertura: datos.zonasCobertura || [],
    matricula: datos.matricula || '',
    telefonoContacto: datos.telefonoContacto || '',
    media: {
      fotos: datos.fotos || [],
      logo: datos.logo || ''
    }
  })

  await perfil.save()

  // Marcar usuario como profesional
  await Usuario.findByIdAndUpdate(usuarioId, { esProfesional: true })

  return perfil
}

export async function obtenerPerfilProfesional(usuarioId) {
  return await PerfilProfesional.findOne({ usuarioId })
    .populate('usuarioId', 'nombre avatar')
}

export async function actualizarPerfilProfesional(usuarioId, datos) {
  const perfil = await PerfilProfesional.findOne({ usuarioId })
  if (!perfil) throw new Error('Perfil profesional no encontrado')

  // Solo asignar campos definidos para no pisar con undefined
  const campos = ['rubro', 'nombreNegocio', 'descripcion', 'experiencia', 'habilidades',
    'añosExperiencia', 'localidad', 'zonasCobertura', 'matricula', 'telefonoContacto', 'media']
  for (const campo of campos) {
    if (datos[campo] !== undefined) perfil[campo] = datos[campo]
  }
  await perfil.save()

  return await perfil.populate('usuarioId', 'nombre avatar')
}

export async function buscarProfesionales(filtros = {}) {
  const { rubro, localidad, skip = 0, limit = 20 } = filtros

  const query = { activo: true }
  if (rubro) query.rubro = rubro
  if (localidad) query.localidad = localidad

  const perfiles = await PerfilProfesional.find(query)
    .sort({ destacadoHasta: -1, calificacion: -1 })
    .skip(skip)
    .limit(limit)
    .populate('usuarioId', 'nombre avatar')

  const total = await PerfilProfesional.countDocuments(query)

  return { perfiles, total }
}

// ===== SolicitudServicio =====
export async function crearSolicitud(clienteId, profesionalId, datos) {
  // Validar que el cliente y profesional existan
  const [cliente, profesional] = await Promise.all([
    Usuario.findById(clienteId),
    PerfilProfesional.findOne({ usuarioId: profesionalId })
  ])

  if (!cliente) throw new Error('Cliente no encontrado')
  if (!profesional) throw new Error('Profesional no encontrado')

  const solicitud = new SolicitudServicio({
    clienteId,
    profesionalId,
    rubro: datos.rubro,
    descripcion: datos.descripcion,
    zona: datos.zona
  })

  await solicitud.save()

  return solicitud
}

export async function obtenerSolicitud(solicitudId) {
  return await SolicitudServicio.findById(solicitudId)
    .populate('clienteId', 'nombre avatar email')
    .populate('profesionalId', 'nombre avatar email')
}

export async function actualizarEstadoSolicitud(solicitudId, profesionalId, nuevoEstado, cotizacion = null) {
  const solicitud = await SolicitudServicio.findById(solicitudId)
  if (!solicitud) throw new Error('Solicitud no encontrada')

  // Verificar que el profesional es quien va a cotizar/aceptar
  if (solicitud.profesionalId.toString() !== profesionalId.toString()) {
    throw new Error('No tienes permiso para modificar esta solicitud')
  }

  // Validar transiciones de estado
  const transicionesValidas = {
    'solicitada': ['cotizada', 'cancelada'],
    'cotizada': ['aceptada', 'cancelada'],
    'aceptada': ['en_curso', 'cancelada'],
    'en_curso': ['completada', 'cancelada'],
    'completada': [],
    'cancelada': []
  }

  if (!transicionesValidas[solicitud.estado].includes(nuevoEstado)) {
    throw new Error(`No puedes pasar de ${solicitud.estado} a ${nuevoEstado}`)
  }

  solicitud.estado = nuevoEstado

  if (nuevoEstado === 'cotizada' && cotizacion) {
    solicitud.cotizacion = {
      monto: cotizacion.monto,
      notas: cotizacion.notas || '',
      fecha: new Date()
    }
  }

  await solicitud.save()

  return solicitud
}

export async function solicitudesPorProfesional(profesionalId, filtros = {}) {
  const { estado, skip = 0, limit = 20 } = filtros

  const query = { profesionalId }
  if (estado) query.estado = estado

  const solicitudes = await SolicitudServicio.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('clienteId', 'nombre avatar')

  const total = await SolicitudServicio.countDocuments(query)

  return { solicitudes, total }
}

// ===== ResenaServicio =====
export async function crearResenaServicio(clienteId, solicitudId, datos) {
  // Verificar que la solicitud pertenece al cliente y está completada
  const solicitud = await SolicitudServicio.findById(solicitudId)
  if (!solicitud) throw new Error('Solicitud no encontrada')

  if (solicitud.clienteId.toString() !== clienteId.toString()) {
    throw new Error('Esta solicitud no te pertenece')
  }

  if (solicitud.estado !== 'completada') {
    throw new Error('Solo puedes reseñar solicitudes completadas')
  }

  // Verificar que no exista reseña duplicada
  const resenaExistente = await ResenaServicio.findOne({ clienteId, solicitudId })
  if (resenaExistente) {
    throw new Error('Ya dejaste una reseña para esta solicitud')
  }

  const resena = new ResenaServicio({
    clienteId,
    profesionalId: solicitud.profesionalId,
    solicitudId,
    calificacion: datos.calificacion,
    comentario: datos.comentario || ''
  })

  await resena.save()

  // Actualizar calificación promedio del profesional
  await actualizarCalificacionProfesional(solicitud.profesionalId)

  return resena
}

export async function responderResenaServicio(resenaId, profesionalId, respuesta) {
  const resena = await ResenaServicio.findById(resenaId)
  if (!resena) throw new Error('Reseña no encontrada')

  if (resena.profesionalId.toString() !== profesionalId.toString()) {
    throw new Error('No tienes permiso para responder esta reseña')
  }

  resena.respuestaProfesional = respuesta
  await resena.save()

  return resena
}

export async function resenasPorProfesional(profesionalId) {
  return await ResenaServicio.find({ profesionalId })
    .populate('clienteId', 'nombre avatar')
    .sort({ createdAt: -1 })
}

export async function actualizarCalificacionProfesional(profesionalId) {
  const resenas = await ResenaServicio.find({ profesionalId })

  if (resenas.length === 0) {
    await PerfilProfesional.findOneAndUpdate(
      { usuarioId: profesionalId },
      { calificacion: 0, conteoResenas: 0 }
    )
    return 0
  }

  const promedio = resenas.reduce((sum, r) => sum + r.calificacion, 0) / resenas.length
  const promedioRedondeado = Math.round(promedio * 10) / 10

  await PerfilProfesional.findOneAndUpdate(
    { usuarioId: profesionalId },
    { calificacion: promedioRedondeado, conteoResenas: resenas.length, totalTrabajos: resenas.length }
  )

  return promedioRedondeado
}

// ===== Bolsa de Trabajo Inversa (TrabajoBuscado + Bid) =====

// Cliente publica un trabajo. Abierto a cualquier usuario registrado.
export async function crearTrabajo(clienteId, datos) {
  if (datos.presupuestoMin != null && datos.presupuestoMax != null &&
    Number(datos.presupuestoMin) > Number(datos.presupuestoMax)) {
    throw new Error('El presupuesto mínimo no puede ser mayor al máximo')
  }

  const trabajo = new TrabajoBuscado({
    clienteId,
    titulo: datos.titulo,
    descripcion: datos.descripcion,
    rubro: datos.rubro,
    localidad: datos.localidad,
    presupuestoMin: datos.presupuestoMin ?? null,
    presupuestoMax: datos.presupuestoMax ?? null,
    plazoEntrega: datos.plazoEntrega || null,
    skills: datos.skills || []
  })

  await trabajo.save()
  return trabajo
}

// Listar trabajos abiertos (browse del profesional). Incluye contador de ofertas.
export async function buscarTrabajos(filtros = {}) {
  const { rubro, localidad, estado = 'activo', skip = 0, limit = 20 } = filtros

  const query = {}
  if (estado) query.estado = estado
  if (rubro) query.rubro = rubro
  if (localidad) query.localidad = localidad

  const trabajos = await TrabajoBuscado.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('clienteId', 'nombre avatar')
    .lean()

  // Contar ofertas por trabajo
  const ids = trabajos.map(t => t._id)
  const conteos = await Bid.aggregate([
    { $match: { trabajoId: { $in: ids } } },
    { $group: { _id: '$trabajoId', total: { $sum: 1 } } }
  ])
  const mapaConteos = new Map(conteos.map(c => [c._id.toString(), c.total]))
  for (const t of trabajos) {
    t.bidCount = mapaConteos.get(t._id.toString()) || 0
  }

  const total = await TrabajoBuscado.countDocuments(query)
  return { trabajos, total }
}

// Obtener un trabajo. Si el usuario es el cliente dueño, incluye todas las ofertas.
// Si es otro usuario (profesional), incluye solo su propia oferta (si existe).
export async function obtenerTrabajoConBids(trabajoId, usuarioId) {
  const trabajo = await TrabajoBuscado.findById(trabajoId)
    .populate('clienteId', 'nombre avatar')
  if (!trabajo) throw new Error('Trabajo no encontrado')

  const esDueno = trabajo.clienteId._id.toString() === usuarioId.toString()

  let bids
  if (esDueno) {
    // Todas las ofertas, con datos del profesional + su calificación
    bids = await Bid.find({ trabajoId })
      .sort({ precioOfrecido: 1, createdAt: 1 })
      .populate('profesionalId', 'nombre avatar')
      .lean()
    // Adjuntar calificación/totalTrabajos del perfil del profesional
    const profIds = bids.map(b => b.profesionalId?._id).filter(Boolean)
    const perfiles = await PerfilProfesional.find({ usuarioId: { $in: profIds } })
      .select('usuarioId calificacion totalTrabajos conteoResenas rubro').lean()
    const mapaPerfiles = new Map(perfiles.map(p => [p.usuarioId.toString(), p]))
    for (const b of bids) {
      const perfil = b.profesionalId && mapaPerfiles.get(b.profesionalId._id.toString())
      b.perfilProfesional = perfil || null
    }
  } else {
    // Solo la oferta propia del profesional que consulta
    bids = await Bid.find({ trabajoId, profesionalId: usuarioId }).lean()
  }

  // Si el dueño ya reseñó este trabajo, avisamos para no ofrecer reseñar de nuevo
  let yaResenado = false
  if (esDueno && trabajo.estado === 'completado') {
    yaResenado = !!(await ResenaServicio.exists({ clienteId: usuarioId, trabajoId }))
  }

  return { trabajo, bids, esDueno, yaResenado }
}

// Profesional oferta por un trabajo. Requiere tener PerfilProfesional.
export async function crearBid(trabajoId, profesionalId, datos) {
  const trabajo = await TrabajoBuscado.findById(trabajoId)
  if (!trabajo) throw new Error('Trabajo no encontrado')
  if (trabajo.estado !== 'activo') throw new Error('Este trabajo ya no recibe ofertas')
  if (trabajo.clienteId.toString() === profesionalId.toString()) {
    throw new Error('No podés ofertar en tu propio trabajo')
  }

  const perfil = await PerfilProfesional.findOne({ usuarioId: profesionalId }).select('_id')
  if (!perfil) throw new Error('Necesitás un perfil profesional para ofertar')

  if (datos.precioOfrecido == null || Number(datos.precioOfrecido) <= 0) {
    throw new Error('El precio ofrecido debe ser mayor a cero')
  }

  const yaOferto = await Bid.findOne({ trabajoId, profesionalId }).select('_id')
  if (yaOferto) throw new Error('Ya ofertaste en este trabajo')

  const bid = new Bid({
    trabajoId,
    profesionalId,
    precioOfrecido: datos.precioOfrecido,
    notas: datos.notas || ''
  })
  await bid.save()

  // Notificar al cliente que recibió una oferta
  emitNotificacion(trabajo.clienteId, {
    tipo: 'trabajo_oferta',
    titulo: 'Nueva oferta en tu trabajo',
    mensaje: `Recibiste una oferta de $${Number(datos.precioOfrecido).toLocaleString('es-AR')} en "${trabajo.titulo}"`,
    enlace: `/trabajos/${trabajoId}`
  })

  return bid
}

// Cliente acepta una oferta: asigna el profesional y rechaza el resto.
export async function aceptarBid(trabajoId, bidId, clienteId) {
  // Validar la oferta antes de comprometer el estado del trabajo
  const bid = await Bid.findById(bidId)
  if (!bid || bid.trabajoId.toString() !== trabajoId.toString()) {
    throw new Error('Oferta no encontrada')
  }
  if (bid.estado !== 'activa') throw new Error('Esa oferta ya no está disponible')

  // Asignación atómica: solo tiene éxito si el trabajo sigue activo y es del cliente.
  // Evita doble asignación ante clics/requests concurrentes.
  const trabajo = await TrabajoBuscado.findOneAndUpdate(
    { _id: trabajoId, clienteId, estado: 'activo' },
    { profesionalAsignadoId: bid.profesionalId, bidGanadora: bid._id, estado: 'asignado' },
    { new: true }
  )
  if (!trabajo) {
    // O no es suyo, o ya no está activo. Distinguir para un mensaje claro.
    const existe = await TrabajoBuscado.findById(trabajoId).select('clienteId estado')
    if (!existe) throw new Error('Trabajo no encontrado')
    if (existe.clienteId.toString() !== clienteId.toString()) {
      throw new Error('No tenés permiso para gestionar este trabajo')
    }
    throw new Error('El trabajo ya no está activo')
  }

  // Marcar ofertas: ganadora aceptada, resto rechazadas
  bid.estado = 'aceptada'
  await bid.save()
  await Bid.updateMany(
    { trabajoId, _id: { $ne: bid._id } },
    { estado: 'rechazada' }
  )

  // Notificar al profesional ganador (desbloquea chat seguro)
  emitNotificacion(bid.profesionalId, {
    tipo: 'trabajo_asignado',
    titulo: '¡Te asignaron un trabajo!',
    mensaje: `Tu oferta fue aceptada en "${trabajo.titulo}". Ya podés coordinar por chat.`,
    enlace: `/trabajos/${trabajoId}`
  })

  return trabajo
}

// Cliente cancela su trabajo.
export async function cancelarTrabajo(trabajoId, clienteId) {
  const trabajo = await TrabajoBuscado.findById(trabajoId)
  if (!trabajo) throw new Error('Trabajo no encontrado')
  if (trabajo.clienteId.toString() !== clienteId.toString()) {
    throw new Error('No tenés permiso para gestionar este trabajo')
  }
  if (['completado', 'cancelado'].includes(trabajo.estado)) {
    throw new Error('El trabajo ya está cerrado')
  }

  trabajo.estado = 'cancelado'
  await trabajo.save()
  await Bid.updateMany({ trabajoId, estado: 'activa' }, { estado: 'rechazada' })
  return trabajo
}

// Cliente marca el trabajo como completado (tras la entrega manual).
export async function completarTrabajo(trabajoId, clienteId) {
  const trabajo = await TrabajoBuscado.findById(trabajoId)
  if (!trabajo) throw new Error('Trabajo no encontrado')
  if (trabajo.clienteId.toString() !== clienteId.toString()) {
    throw new Error('No tenés permiso para gestionar este trabajo')
  }
  if (trabajo.estado !== 'asignado') {
    throw new Error('Solo se puede completar un trabajo asignado')
  }

  trabajo.estado = 'completado'
  await trabajo.save()

  if (trabajo.profesionalAsignadoId) {
    emitNotificacion(trabajo.profesionalAsignadoId, {
      tipo: 'trabajo_completado',
      titulo: 'Trabajo completado',
      mensaje: `"${trabajo.titulo}" fue marcado como completado. ¡Gracias!`,
      enlace: `/trabajos/${trabajoId}`
    })
  }

  return trabajo
}

// Mis trabajos como cliente (dashboard).
export async function trabajosPorCliente(clienteId, filtros = {}) {
  const { estado, skip = 0, limit = 50 } = filtros
  const query = { clienteId }
  if (estado) query.estado = estado

  const trabajos = await TrabajoBuscado.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('profesionalAsignadoId', 'nombre avatar')
    .lean()

  const ids = trabajos.map(t => t._id)
  const conteos = await Bid.aggregate([
    { $match: { trabajoId: { $in: ids } } },
    { $group: { _id: '$trabajoId', total: { $sum: 1 } } }
  ])
  const mapaConteos = new Map(conteos.map(c => [c._id.toString(), c.total]))
  for (const t of trabajos) {
    t.bidCount = mapaConteos.get(t._id.toString()) || 0
  }

  const total = await TrabajoBuscado.countDocuments(query)
  return { trabajos, total }
}

// Cliente reseña al profesional que completó un trabajo de la bolsa.
export async function crearResenaTrabajo(clienteId, trabajoId, datos) {
  const trabajo = await TrabajoBuscado.findById(trabajoId)
  if (!trabajo) throw new Error('Trabajo no encontrado')
  if (trabajo.clienteId.toString() !== clienteId.toString()) {
    throw new Error('Este trabajo no te pertenece')
  }
  if (trabajo.estado !== 'completado') {
    throw new Error('Solo podés reseñar trabajos completados')
  }
  if (!trabajo.profesionalAsignadoId) {
    throw new Error('El trabajo no tiene un profesional asignado')
  }

  const resenaExistente = await ResenaServicio.findOne({ clienteId, trabajoId })
  if (resenaExistente) throw new Error('Ya dejaste una reseña para este trabajo')

  const resena = new ResenaServicio({
    clienteId,
    profesionalId: trabajo.profesionalAsignadoId,
    tipo: 'trabajo',
    trabajoId,
    calificacion: datos.calificacion,
    comentario: datos.comentario || ''
  })
  await resena.save()

  // Recalcular calificación promedio (cuenta servicios + trabajos)
  await actualizarCalificacionProfesional(trabajo.profesionalAsignadoId)

  return resena
}

export default {
  crearPerfilProfesional,
  obtenerPerfilProfesional,
  actualizarPerfilProfesional,
  buscarProfesionales,
  crearSolicitud,
  obtenerSolicitud,
  actualizarEstadoSolicitud,
  solicitudesPorProfesional,
  crearResenaServicio,
  responderResenaServicio,
  resenasPorProfesional,
  actualizarCalificacionProfesional,
  crearTrabajo,
  buscarTrabajos,
  obtenerTrabajoConBids,
  crearBid,
  aceptarBid,
  cancelarTrabajo,
  completarTrabajo,
  trabajosPorCliente,
  crearResenaTrabajo
}
