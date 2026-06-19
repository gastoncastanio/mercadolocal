import PerfilProfesional from '../models/PerfilProfesional.js'
import SolicitudServicio from '../models/SolicitudServicio.js'
import ResenaServicio from '../models/ResenaServicio.js'
import Usuario from '../models/Usuario.js'

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
  actualizarCalificacionProfesional
}
