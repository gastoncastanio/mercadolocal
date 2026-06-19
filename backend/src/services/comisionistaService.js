import PerfilComisionista from '../models/PerfilComisionista.js'
import Viaje from '../models/Viaje.js'
import EnvioComisionista from '../models/EnvioComisionista.js'
import Usuario from '../models/Usuario.js'
import { generarCodigoCanje, hashCodigoCanje } from '../utils/crypto.js'
import { emitNotificacion } from './socketService.js'

// ===== PerfilComisionista =====

export async function crearPerfilComisionista(usuarioId, datos) {
  const existente = await PerfilComisionista.findOne({ usuarioId })
  if (existente) throw new Error('Ya tenés un perfil de comisionista')

  const perfil = await new PerfilComisionista({
    usuarioId,
    nombreServicio: datos.nombreServicio || '',
    descripcion: datos.descripcion || '',
    vehiculo: {
      tipo: datos.vehiculo?.tipo || 'auto',
      patente: datos.vehiculo?.patente || '',
      capacidadBultos: datos.vehiculo?.capacidadBultos || 0
    },
    zonasHabituales: datos.zonasHabituales || [],
    telefonoContacto: datos.telefonoContacto || ''
  }).save()

  // Capability flag (patrón esProfesional/tieneVendedor; no toca el enum rol).
  await Usuario.findByIdAndUpdate(usuarioId, { esComisionista: true })

  await perfil.populate('usuarioId', 'nombre avatar')
  return perfil.toPublic()
}

export async function obtenerPerfilComisionista(usuarioId) {
  return await PerfilComisionista.findOne({ usuarioId }).populate('usuarioId', 'nombre avatar')
}

export async function actualizarPerfilComisionista(usuarioId, datos) {
  const perfil = await PerfilComisionista.findOne({ usuarioId })
  if (!perfil) throw new Error('Perfil de comisionista no encontrado')

  const campos = ['nombreServicio', 'descripcion', 'vehiculo', 'zonasHabituales', 'telefonoContacto']
  for (const campo of campos) {
    if (datos[campo] !== undefined) perfil[campo] = datos[campo]
  }
  await perfil.save()

  await perfil.populate('usuarioId', 'nombre avatar')
  return perfil.toPublic()
}

// ===== Viaje =====

export async function publicarViaje(comisionistaId, datos) {
  const perfil = await PerfilComisionista.findOne({ usuarioId: comisionistaId }).select('_id')
  if (!perfil) throw new Error('Necesitás un perfil de comisionista para publicar viajes')

  if (!datos.origen?.ciudad || !datos.destino?.ciudad) {
    throw new Error('Origen y destino son obligatorios')
  }
  if (!datos.fechaSalida) throw new Error('La fecha de salida es obligatoria')

  const capacidad = Number(datos.capacidadTotal)
  if (!Number.isInteger(capacidad) || capacidad < 1) {
    throw new Error('La capacidad debe ser de al menos 1 bulto')
  }

  const viaje = await new Viaje({
    comisionistaId,
    origen: { ciudad: datos.origen.ciudad },
    destino: { ciudad: datos.destino.ciudad },
    fechaSalida: datos.fechaSalida,
    horaSalida: datos.horaSalida || '',
    tarifas: {
      bultoChico: datos.tarifas?.bultoChico || 0,
      bultoMediano: datos.tarifas?.bultoMediano || 0,
      bultoGrande: datos.tarifas?.bultoGrande || 0
    },
    capacidadTotal: capacidad,
    capacidadDisponible: capacidad,
    notas: datos.notas || ''
  }).save()

  return viaje
}

export async function buscarViajes(filtros = {}) {
  const { origen, destino, fecha, skip = 0, limit = 20 } = filtros

  const query = { estado: 'programado', fechaSalida: { $gte: new Date() } }
  if (origen) query['origen.ciudad'] = origen
  if (destino) query['destino.ciudad'] = destino
  if (fecha) {
    const dia = new Date(fecha)
    const finDia = new Date(dia)
    finDia.setHours(23, 59, 59, 999)
    query.fechaSalida = { $gte: dia, $lte: finDia }
  }

  const viajes = await Viaje.find(query)
    .sort({ fechaSalida: 1 })
    .skip(skip)
    .limit(limit)
    .populate('comisionistaId', 'nombre avatar')

  const total = await Viaje.countDocuments(query)
  return { viajes, total }
}

export async function obtenerViaje(id) {
  return await Viaje.findById(id).populate('comisionistaId', 'nombre avatar')
}

export async function misViajes(comisionistaId) {
  return await Viaje.find({ comisionistaId }).sort({ fechaSalida: -1 })
}

const TRANSICIONES_VIAJE = {
  programado: ['en_curso', 'cancelado'],
  en_curso: ['completado', 'cancelado'],
  completado: [],
  cancelado: []
}

export async function cambiarEstadoViaje(comisionistaId, viajeId, nuevoEstado) {
  const viaje = await Viaje.findById(viajeId)
  if (!viaje) throw new Error('Viaje no encontrado')
  if (viaje.comisionistaId.toString() !== comisionistaId.toString()) {
    throw new Error('No autorizado')
  }
  const permitidos = TRANSICIONES_VIAJE[viaje.estado] || []
  if (!permitidos.includes(nuevoEstado)) {
    throw new Error(`No se puede pasar de "${viaje.estado}" a "${nuevoEstado}"`)
  }

  viaje.estado = nuevoEstado
  await viaje.save()

  // Al completar el viaje, suma al historial del comisionista.
  if (nuevoEstado === 'completado') {
    await PerfilComisionista.findOneAndUpdate({ usuarioId: comisionistaId }, { $inc: { totalViajes: 1 } })
  }
  return viaje
}

// ===== EnvioComisionista =====

export async function contratarEnvio(contratanteId, viajeId, datos) {
  const { tamano, descripcion = '' } = datos
  if (!['chico', 'mediano', 'grande'].includes(tamano)) throw new Error('Tamaño de bulto inválido')

  const cantidad = Number(datos.cantidadBultos)
  if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error('Cantidad de bultos inválida')

  const viaje = await Viaje.findById(viajeId)
  if (!viaje) throw new Error('Viaje no encontrado')
  if (viaje.comisionistaId.toString() === contratanteId.toString()) {
    throw new Error('No podés contratar tu propio viaje')
  }
  if (viaje.estado !== 'programado') throw new Error('Este viaje ya no recibe reservas')

  const precio = viaje.precioPara(tamano, cantidad)
  if (precio == null) throw new Error('El viaje no tiene tarifa para ese tamaño')

  // Reservar cupo ATÓMICAMENTE: la guarda $gte evita sobreventa entre reservas
  // simultáneas (mismo patrón que cupoUsado en OfertaFlash).
  const viajeReservado = await Viaje.findOneAndUpdate(
    { _id: viajeId, estado: 'programado', capacidadDisponible: { $gte: cantidad } },
    { $inc: { capacidadDisponible: -cantidad } },
    { new: true }
  )
  if (!viajeReservado) throw new Error('No hay cupo suficiente en este viaje')

  // Código de entrega: guardamos el HASH; el código en claro va al contratante
  // una sola vez y lo presenta en destino para cerrar el envío.
  const { codigo, codigoHash } = generarCodigoCanje()

  let envio
  try {
    envio = await new EnvioComisionista({
      viajeId,
      comisionistaId: viaje.comisionistaId,
      contratanteId,
      cantidadBultos: cantidad,
      tamano,
      descripcion,
      precio,
      codigoEntregaHash: codigoHash
    }).save()
  } catch (err) {
    // Si falla la creación, devolvemos el cupo reservado.
    await Viaje.findByIdAndUpdate(viajeId, { $inc: { capacidadDisponible: cantidad } })
    throw err
  }

  emitNotificacion(viaje.comisionistaId.toString(), {
    tipo: 'envio',
    titulo: 'Nueva reserva en tu viaje',
    mensaje: `Te reservaron ${cantidad} bulto(s) ${tamano} de ${viaje.origen.ciudad} a ${viaje.destino.ciudad}.`,
    enlace: '/comisionistas/panel'
  })

  return { envio, codigoEntrega: codigo }
}

export async function misEnviosContratante(contratanteId) {
  return await EnvioComisionista.find({ contratanteId })
    .sort({ createdAt: -1 })
    .populate('comisionistaId', 'nombre avatar')
    .populate('viajeId')
}

export async function enviosRecibidos(comisionistaId) {
  return await EnvioComisionista.find({ comisionistaId })
    .sort({ createdAt: -1 })
    .populate('contratanteId', 'nombre avatar')
    .populate('viajeId')
}

// Transición simple de estado del envío validando que la haga el comisionista dueño.
async function transicionEnvio(comisionistaId, envioId, desde, hacia) {
  const envio = await EnvioComisionista.findById(envioId)
  if (!envio) throw new Error('Envío no encontrado')
  if (envio.comisionistaId.toString() !== comisionistaId.toString()) throw new Error('No autorizado')
  if (envio.estado !== desde) throw new Error(`El envío debe estar "${desde}" (está "${envio.estado}")`)

  const actualizado = await EnvioComisionista.findOneAndUpdate(
    { _id: envioId, estado: desde },
    { $set: { estado: hacia } },
    { new: true }
  )
  if (!actualizado) throw new Error('El envío ya fue procesado')
  return actualizado
}

export async function aceptarEnvio(comisionistaId, envioId) {
  const envio = await transicionEnvio(comisionistaId, envioId, 'pendiente', 'aceptado')
  emitNotificacion(envio.contratanteId.toString(), {
    tipo: 'envio',
    titulo: 'Reserva aceptada',
    mensaje: 'El comisionista aceptó tu envío. Coordiná la entrega por chat.',
    enlace: '/comisionistas/mis-envios'
  })
  return envio
}

export async function marcarEnTransito(comisionistaId, envioId) {
  const envio = await transicionEnvio(comisionistaId, envioId, 'aceptado', 'en_transito')
  emitNotificacion(envio.contratanteId.toString(), {
    tipo: 'envio',
    titulo: 'Envío en camino',
    mensaje: 'Tu envío está en tránsito hacia el destino.',
    enlace: '/comisionistas/mis-envios'
  })
  return envio
}

export async function confirmarEntrega(comisionistaId, envioId, codigo) {
  const envio = await EnvioComisionista.findById(envioId)
  if (!envio) throw new Error('Envío no encontrado')
  if (envio.comisionistaId.toString() !== comisionistaId.toString()) throw new Error('No autorizado')
  if (envio.estado !== 'en_transito') throw new Error('El envío debe estar en tránsito para confirmar la entrega')
  if (!codigo || !envio.codigoEntregaHash || hashCodigoCanje(codigo) !== envio.codigoEntregaHash) {
    throw new Error('Código de entrega inválido')
  }

  // Transición atómica en_transito → entregado (un solo uso).
  const actualizado = await EnvioComisionista.findOneAndUpdate(
    { _id: envioId, estado: 'en_transito' },
    { $set: { estado: 'entregado', entregadoEn: new Date() } },
    { new: true }
  )
  if (!actualizado) throw new Error('El envío ya fue procesado')

  emitNotificacion(envio.contratanteId.toString(), {
    tipo: 'envio',
    titulo: 'Entrega confirmada',
    mensaje: 'Tu envío fue entregado. ¡Gracias por usar MercadoLocal!',
    enlace: '/comisionistas/mis-envios'
  })
  return actualizado
}

export async function cancelarEnvio(usuarioId, envioId) {
  const envio = await EnvioComisionista.findById(envioId)
  if (!envio) throw new Error('Envío no encontrado')

  const esContratante = envio.contratanteId.toString() === usuarioId.toString()
  const esComisionista = envio.comisionistaId.toString() === usuarioId.toString()
  if (!esContratante && !esComisionista) throw new Error('No autorizado')
  if (['entregado', 'cancelado'].includes(envio.estado)) {
    throw new Error('Este envío ya no se puede cancelar')
  }

  const actualizado = await EnvioComisionista.findOneAndUpdate(
    { _id: envioId, estado: { $nin: ['entregado', 'cancelado'] } },
    { $set: { estado: 'cancelado' } },
    { new: true }
  )
  if (!actualizado) throw new Error('El envío ya fue procesado')

  // Devolver el cupo reservado al viaje.
  await Viaje.findByIdAndUpdate(envio.viajeId, { $inc: { capacidadDisponible: envio.cantidadBultos } })

  const otraParte = esContratante ? envio.comisionistaId : envio.contratanteId
  emitNotificacion(otraParte.toString(), {
    tipo: 'envio',
    titulo: 'Envío cancelado',
    mensaje: 'Una reserva de envío fue cancelada.',
    enlace: '/comisionistas/panel'
  })
  return actualizado
}
