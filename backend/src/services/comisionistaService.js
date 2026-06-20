import PerfilComisionista from '../models/PerfilComisionista.js'
import Viaje from '../models/Viaje.js'
import EnvioComisionista from '../models/EnvioComisionista.js'
import SolicitudCotizacion from '../models/SolicitudCotizacion.js'
import Orden from '../models/Orden.js'
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

  const campos = ['nombreServicio', 'descripcion', 'vehiculo', 'zonasHabituales', 'telefonoContacto', 'horariosActivos']
  for (const campo of campos) {
    if (datos[campo] !== undefined) perfil[campo] = datos[campo]
  }
  await perfil.save()

  await perfil.populate('usuarioId', 'nombre avatar')
  return perfil.toPublic()
}

/**
 * Carga/actualiza el documento del vehículo. Al subir uno nuevo, el estado vuelve
 * a 'pendiente' (lo revisa un admin que verifica que el vehículo esté a su nombre
 * o que tenga permiso para conducirlo). Sin documento verificado, el comisionista
 * NO aparece en el panel "en vivo" del checkout.
 */
export async function cargarDocumentoVehiculo(usuarioId, { url, tipoDocumento, nombreArchivo }) {
  if (!url) throw new Error('Falta el documento')
  const perfil = await PerfilComisionista.findOne({ usuarioId })
  if (!perfil) throw new Error('Perfil de comisionista no encontrado')

  perfil.documentoVehiculo = {
    url,
    tipoDocumento: tipoDocumento || 'titulo_propiedad',
    nombreArchivo: nombreArchivo || ''
  }
  perfil.estadoDocumento = 'pendiente'
  await perfil.save()

  await perfil.populate('usuarioId', 'nombre avatar')
  return perfil.toPublic()
}

/**
 * Botón "Estoy trabajando" — el comisionista marca/desmarca que está activo ahora.
 * Requiere documento verificado para poder aparecer en el panel en vivo.
 */
export async function marcarTrabajandoHoy(usuarioId, activo) {
  const perfil = await PerfilComisionista.findOne({ usuarioId })
  if (!perfil) throw new Error('Perfil de comisionista no encontrado')

  if (activo && perfil.estadoDocumento !== 'verificado') {
    throw new Error('Necesitás tener el documento del vehículo verificado para empezar a trabajar')
  }

  perfil.estaTrabajandoHoy = !!activo
  await perfil.save()

  await perfil.populate('usuarioId', 'nombre avatar')
  return perfil.toPublic()
}

// ===== Admin: verificación de documentos de vehículo =====

// Lista perfiles con documento cargado a la espera de revisión.
export async function documentosPendientes() {
  return await PerfilComisionista.find({
    'documentoVehiculo.url': { $ne: '' },
    estadoDocumento: 'pendiente'
  })
    .sort({ updatedAt: 1 })
    .populate('usuarioId', 'nombre avatar email')
    .lean()
}

// El admin aprueba o rechaza el documento del vehículo.
export async function verificarDocumento(perfilId, aprobado) {
  const perfil = await PerfilComisionista.findById(perfilId)
  if (!perfil) throw new Error('Perfil no encontrado')

  perfil.estadoDocumento = aprobado ? 'verificado' : 'rechazado'
  // Si se rechaza, no puede seguir apareciendo como trabajando.
  if (!aprobado) perfil.estaTrabajandoHoy = false
  await perfil.save()

  emitNotificacion(perfil.usuarioId.toString(), {
    tipo: 'comisionista',
    titulo: aprobado ? 'Documento verificado' : 'Documento rechazado',
    mensaje: aprobado
      ? 'Tu documento fue verificado. Ya podés empezar a trabajar.'
      : 'Tu documento fue rechazado. Subí uno nuevo, válido y legible.',
    enlace: '/comisionistas/mi-perfil'
  })
  return perfil.toPublic()
}

/**
 * Panel "en vivo" del checkout: comisionistas que están trabajando AHORA, con el
 * documento verificado. Si se pasa una ciudad de destino, prioriza a los que la
 * tienen entre sus zonas habituales (pero igual muestra al resto, ordenados).
 */
export async function comisionistasEnVivo({ ciudadDestino } = {}) {
  const query = {
    activo: true,
    estaTrabajandoHoy: true,
    estadoDocumento: 'verificado'
  }
  const perfiles = await PerfilComisionista.find(query)
    .sort({ calificacion: -1, totalViajes: -1 })
    .limit(50)
    .populate('usuarioId', 'nombre avatar')

  let resultado = perfiles.map(p => p.toPublic())

  // Si hay ciudad de destino, ordena primero los que la cubren.
  if (ciudadDestino) {
    const norm = ciudadDestino.trim().toLowerCase()
    resultado = resultado
      .map(p => ({
        ...p,
        cubreDestino: (p.zonasHabituales || []).some(z => z.trim().toLowerCase() === norm)
      }))
      .sort((a, b) => Number(b.cubreDestino) - Number(a.cubreDestino))
  }

  return resultado
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

// ===== SolicitudCotizacion (comisionista en vivo desde el checkout) =====

/**
 * El comprador, tras pagar una orden, le pide cotización a un comisionista que
 * está trabajando ahora. Requiere aceptar el deslinde de responsabilidad.
 */
export async function solicitarCotizacion(compradorId, { ordenId, comisionistaId, descripcionCarga, terminosAceptados }) {
  if (!terminosAceptados) {
    throw new Error('Tenés que aceptar los términos del servicio de traslado para continuar')
  }
  if (!ordenId || !comisionistaId) throw new Error('Faltan datos de la solicitud')
  if (comisionistaId.toString() === compradorId.toString()) {
    throw new Error('No podés pedirte cotización a vos mismo')
  }

  const orden = await Orden.findById(ordenId)
  if (!orden) throw new Error('Orden no encontrada')
  if (orden.compradorId.toString() !== compradorId.toString()) throw new Error('No autorizado')
  if (orden.estado === 'pendiente') throw new Error('La orden todavía no está paga')

  // El comisionista debe estar activo y verificado.
  const perfil = await PerfilComisionista.findOne({ usuarioId: comisionistaId })
  if (!perfil || !perfil.activo || perfil.estadoDocumento !== 'verificado') {
    throw new Error('El comisionista no está disponible')
  }

  // Vendedor (para coordinar el retiro): primer item de la orden.
  let vendedorId = null
  let ciudadOrigen = orden.ciudadEntrega || ''
  const primerItem = orden.items?.[0]
  if (primerItem?.tiendaId) {
    const { default: Tienda } = await import('../models/Tienda.js')
    const tienda = await Tienda.findById(primerItem.tiendaId).select('usuarioId ciudad').lean()
    if (tienda) {
      vendedorId = tienda.usuarioId
      ciudadOrigen = tienda.ciudad || ciudadOrigen
    }
  }

  try {
    const solicitud = await new SolicitudCotizacion({
      ordenId,
      compradorId,
      comisionistaId,
      vendedorId,
      ciudadOrigen,
      ciudadDestino: orden.ciudadEntrega || '',
      descripcionCarga: descripcionCarga || (orden.items || []).map(i => i.nombre).join(', '),
      terminosAceptados: true
    }).save()

    emitNotificacion(comisionistaId.toString(), {
      tipo: 'cotizacion',
      titulo: 'Nueva solicitud de cotización',
      mensaje: 'Un comprador te pidió cotización para un traslado.',
      enlace: '/comisionistas/mi-perfil'
    })

    return solicitud
  } catch (err) {
    if (err.code === 11000) throw new Error('Ya le pediste cotización a este comisionista por esta orden')
    throw err
  }
}

// Solicitudes que recibió un comisionista (para cotizar).
export async function cotizacionesRecibidas(comisionistaId) {
  return await SolicitudCotizacion.find({ comisionistaId })
    .sort({ createdAt: -1 })
    .populate('compradorId', 'nombre avatar')
    .populate('ordenId', 'total items')
    .lean()
}

// Solicitudes que envió un comprador.
export async function misCotizaciones(compradorId) {
  return await SolicitudCotizacion.find({ compradorId })
    .sort({ createdAt: -1 })
    .populate('comisionistaId', 'nombre avatar')
    .lean()
}

// El comisionista responde con un precio.
export async function responderCotizacion(comisionistaId, solicitudId, { monto, notas }) {
  const montoNum = Number(monto)
  if (!Number.isFinite(montoNum) || montoNum < 0) throw new Error('Monto inválido')

  const solicitud = await SolicitudCotizacion.findById(solicitudId)
  if (!solicitud) throw new Error('Solicitud no encontrada')
  if (solicitud.comisionistaId.toString() !== comisionistaId.toString()) throw new Error('No autorizado')
  if (!['pendiente', 'cotizada'].includes(solicitud.estado)) {
    throw new Error('Esta solicitud ya no admite cotización')
  }

  solicitud.cotizacion = { monto: montoNum, notas: notas || '', fecha: new Date() }
  solicitud.estado = 'cotizada'
  await solicitud.save()

  emitNotificacion(solicitud.compradorId.toString(), {
    tipo: 'cotizacion',
    titulo: 'Cotización recibida',
    mensaje: `Un comisionista te cotizó $${montoNum.toLocaleString('es-AR')} por el traslado.`,
    enlace: '/comisionistas/mis-cotizaciones'
  })
  return solicitud
}

// El comprador acepta la cotización: desbloquea la coordinación por chat.
export async function aceptarCotizacion(compradorId, solicitudId) {
  const solicitud = await SolicitudCotizacion.findById(solicitudId)
  if (!solicitud) throw new Error('Solicitud no encontrada')
  if (solicitud.compradorId.toString() !== compradorId.toString()) throw new Error('No autorizado')
  if (solicitud.estado !== 'cotizada') throw new Error('La solicitud todavía no fue cotizada')

  solicitud.estado = 'aceptada'
  await solicitud.save()

  emitNotificacion(solicitud.comisionistaId.toString(), {
    tipo: 'cotizacion',
    titulo: 'Cotización aceptada',
    mensaje: 'Un comprador aceptó tu cotización. Coordinen el traslado por chat.',
    enlace: '/comisionistas/mi-perfil'
  })
  return solicitud
}

// Rechazar/cancelar una cotización (cualquiera de las partes).
export async function cancelarCotizacion(usuarioId, solicitudId) {
  const solicitud = await SolicitudCotizacion.findById(solicitudId)
  if (!solicitud) throw new Error('Solicitud no encontrada')

  const esComprador = solicitud.compradorId.toString() === usuarioId.toString()
  const esComisionista = solicitud.comisionistaId.toString() === usuarioId.toString()
  if (!esComprador && !esComisionista) throw new Error('No autorizado')
  if (['rechazada', 'cancelada'].includes(solicitud.estado)) return solicitud

  solicitud.estado = esComisionista ? 'rechazada' : 'cancelada'
  await solicitud.save()

  const otraParte = esComprador ? solicitud.comisionistaId : solicitud.compradorId
  emitNotificacion(otraParte.toString(), {
    tipo: 'cotizacion',
    titulo: 'Cotización cancelada',
    mensaje: 'Una solicitud de cotización fue cancelada.',
    enlace: '/comisionistas/mis-cotizaciones'
  })
  return solicitud
}

/**
 * El comprador paga el traslado cotizado: crea la preferencia de MP con split
 * (el comisionista cobra, la plataforma retiene su fee). Devuelve el initPoint.
 */
export async function pagarTraslado(compradorId, solicitudId, compradorEmail) {
  const { crearPreferenciaTraslado } = await import('./mercadoPagoService.js')

  const solicitud = await SolicitudCotizacion.findById(solicitudId)
  if (!solicitud) throw new Error('Solicitud no encontrada')
  if (solicitud.compradorId.toString() !== compradorId.toString()) throw new Error('No autorizado')
  if (solicitud.estado !== 'aceptada') throw new Error('Tenés que aceptar la cotización antes de pagar')
  if (solicitud.pago?.estadoPago === 'pagado') throw new Error('Este traslado ya fue pagado')
  if (solicitud.cotizacion?.monto == null) throw new Error('La solicitud no tiene un monto cotizado')

  const perfil = await PerfilComisionista.findOne({ usuarioId: solicitud.comisionistaId })
  if (!perfil || !perfil.mpVinculado) {
    throw new Error('El comisionista todavía no vinculó su cuenta de Mercado Pago. Pedile que la vincule para poder pagar online.')
  }

  const { preferenceId, initPoint, marketplaceFee } = await crearPreferenciaTraslado({
    solicitud, perfilComisionista: perfil, compradorEmail
  })

  solicitud.pago = {
    ...solicitud.pago,
    mpPreferenceId: preferenceId,
    comisionPlataforma: marketplaceFee,
    estadoPago: 'pendiente_pago'
  }
  await solicitud.save()

  return { initPoint, preferenceId }
}

/**
 * Verifica el pago de un traslado consultando a MP por external_reference
 * (fallback al volver del checkout, por si el webhook no llegó). Best-effort.
 */
export async function verificarPagoTraslado(compradorId, solicitudId) {
  const solicitud = await SolicitudCotizacion.findById(solicitudId)
  if (!solicitud) throw new Error('Solicitud no encontrada')
  if (solicitud.compradorId.toString() !== compradorId.toString()) throw new Error('No autorizado')
  if (solicitud.pago?.estadoPago === 'pagado') return solicitud

  try {
    const { MercadoPagoConfig, Payment } = await import('mercadopago')
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || '' })
    const search = await new Payment(client).search({
      options: { external_reference: `cotizacion:${solicitudId}` }
    })
    const resultados = search?.results || []
    const aprobado = resultados.find(p => p.status === 'approved')
    if (aprobado) {
      return await marcarTrasladoPagado(solicitudId, aprobado.id)
    }
  } catch (e) {
    console.warn('verificarPagoTraslado: no se pudo consultar a MP:', e.message)
  }
  return solicitud
}

/**
 * Marca el traslado como pagado (lo invoca el webhook de MP). Idempotente.
 */
export async function marcarTrasladoPagado(solicitudId, mpPaymentId) {
  const solicitud = await SolicitudCotizacion.findById(solicitudId)
  if (!solicitud) return null
  if (solicitud.pago?.estadoPago === 'pagado') return solicitud // idempotencia

  solicitud.pago = { ...solicitud.pago, mpPaymentId: mpPaymentId?.toString() || '', estadoPago: 'pagado' }
  await solicitud.save()

  emitNotificacion(solicitud.comisionistaId.toString(), {
    tipo: 'cotizacion',
    titulo: 'Traslado pagado',
    mensaje: 'El comprador pagó el traslado. Ya podés coordinar el retiro.',
    enlace: '/comisionistas/mi-perfil'
  })
  emitNotificacion(solicitud.compradorId.toString(), {
    tipo: 'cotizacion',
    titulo: 'Pago del traslado confirmado',
    mensaje: 'Tu pago del traslado fue confirmado. Coordiná la entrega con el comisionista.',
    enlace: '/comisionistas/mis-cotizaciones'
  })
  return solicitud
}

/**
 * El comisionista reporta un incidente (rotura, accidente). MercadoLocal solo
 * deja constancia: el reintegro al comprador lo resuelve el vendedor con el
 * comisionista. Notifica a comprador y vendedor.
 */
export async function reportarIncidente(comisionistaId, solicitudId, descripcion) {
  const solicitud = await SolicitudCotizacion.findById(solicitudId)
  if (!solicitud) throw new Error('Solicitud no encontrada')
  if (solicitud.comisionistaId.toString() !== comisionistaId.toString()) throw new Error('No autorizado')

  solicitud.incidente = { reportado: true, descripcion: descripcion || '', fecha: new Date() }
  await solicitud.save()

  const aviso = {
    tipo: 'incidente',
    titulo: 'Incidente en el traslado',
    mensaje: 'El comisionista reportó un problema con el traslado. El vendedor coordina el reintegro.',
    enlace: '/comisionistas/mis-cotizaciones'
  }
  emitNotificacion(solicitud.compradorId.toString(), aviso)
  if (solicitud.vendedorId) emitNotificacion(solicitud.vendedorId.toString(), aviso)
  return solicitud
}
