import PerfilComisionista from '../models/PerfilComisionista.js'
import Viaje from '../models/Viaje.js'
import EnvioComisionista from '../models/EnvioComisionista.js'
import ResenaComisionista from '../models/ResenaComisionista.js'
import SolicitudCotizacion from '../models/SolicitudCotizacion.js'
import Orden from '../models/Orden.js'
import Usuario from '../models/Usuario.js'
import { generarCodigoCanje, hashCodigoCanje } from '../utils/crypto.js'
import { emitNotificacion, emitEnvioVivoNuevo, emitEnvioVivoNuevoA, emitEnvioVivoCerrado, emitEnvioVivoActualizado } from './socketService.js'

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

// Normaliza un punto del rumbo {ciudad, lat, lng}. La ciudad es la fuente de
// verdad; lat/lng se aceptan solo si son números válidos dentro de rango (si no,
// quedan null y el mapa simplemente no dibuja ese punto). Defensivo contra
// strings, NaN y coordenadas fuera de rango.
function puntoGeo(p) {
  if (!p || typeof p !== 'object') return { ciudad: '', lat: null, lng: null }
  const ciudad = typeof p.ciudad === 'string' ? p.ciudad.trim() : ''
  const lat = Number(p.lat)
  const lng = Number(p.lng)
  const latOk = Number.isFinite(lat) && lat >= -90 && lat <= 90
  const lngOk = Number.isFinite(lng) && lng >= -180 && lng <= 180
  return {
    ciudad,
    lat: latOk ? lat : null,
    lng: lngOk ? lng : null
  }
}

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
    origen: puntoGeo(datos.origen),
    destino: puntoGeo(datos.destino),
    paradas: Array.isArray(datos.paradas)
      ? datos.paradas.map(puntoGeo).filter((p) => p.ciudad)
      : [],
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

/**
 * Cross-checkout: dada una orden paga del comprador, busca viajes programados
 * que vayan de la ciudad del vendedor a la ciudad de entrega de la orden, con
 * cupo disponible. Devuelve también las ciudades para mostrarlas en la UI.
 */
export async function viajesParaOrden(compradorId, ordenId) {
  const orden = await Orden.findById(ordenId)
  if (!orden) throw new Error('Orden no encontrada')
  if (orden.compradorId.toString() !== compradorId.toString()) throw new Error('No autorizado')

  // Ciudad de origen = ciudad de la tienda del primer item.
  let ciudadOrigen = ''
  const primerItem = orden.items?.[0]
  if (primerItem?.tiendaId) {
    const { default: Tienda } = await import('../models/Tienda.js')
    const tienda = await Tienda.findById(primerItem.tiendaId).select('ciudad').lean()
    ciudadOrigen = tienda?.ciudad || ''
  }
  const ciudadDestino = orden.ciudadEntrega || ''

  // Sin ciudades no podemos matchear: devolvemos vacío con el contexto.
  if (!ciudadOrigen || !ciudadDestino) {
    return { viajes: [], ciudadOrigen, ciudadDestino, yaAsignado: !!orden.envioComisionistaId }
  }

  // Match por origen exacto y destino que sea el destino del viaje O una parada.
  const norm = (s) => s.trim().toLowerCase()
  const viajes = await Viaje.find({
    estado: 'programado',
    fechaSalida: { $gte: new Date() },
    capacidadDisponible: { $gte: 1 },
    'origen.ciudad': new RegExp(`^${escaparRegex(ciudadOrigen)}$`, 'i')
  })
    .sort({ fechaSalida: 1 })
    .limit(20)
    .populate('comisionistaId', 'nombre avatar')

  // Filtra a los que llegan al destino (como destino final o como parada en el camino).
  const matchDestino = viajes.filter(v =>
    norm(v.destino.ciudad) === norm(ciudadDestino) ||
    (v.paradas || []).some(p => norm(p.ciudad) === norm(ciudadDestino))
  )

  return {
    viajes: matchDestino,
    ciudadOrigen,
    ciudadDestino,
    yaAsignado: !!orden.envioComisionistaId
  }
}

// Escapa metacaracteres para usar un string como literal en RegExp.
function escaparRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

  // Cross-checkout: si el envío nace de una compra (ordenId), validamos que la
  // orden sea del contratante y esté paga, y que no tenga ya un envío ligado.
  let orden = null
  if (datos.ordenId) {
    orden = await Orden.findById(datos.ordenId)
    if (!orden) throw new Error('Orden no encontrada')
    if (orden.compradorId.toString() !== contratanteId.toString()) throw new Error('No autorizado sobre esta orden')
    if (orden.estado === 'pendiente') throw new Error('La orden todavía no está paga')
    if (orden.envioComisionistaId) throw new Error('Esta orden ya tiene un envío asignado')
  }

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
      ordenId: orden?._id || null,
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

  // Cross-checkout: ligar el envío a la orden (idempotente; solo si no tenía uno).
  if (orden) {
    const ordenLigada = await Orden.findOneAndUpdate(
      { _id: orden._id, envioComisionistaId: null },
      { $set: { envioComisionistaId: envio._id, comisionistaId: viaje.comisionistaId } },
      { new: true }
    )
    // Carrera: otro envío ganó la orden entre la validación y acá. Revertimos.
    if (!ordenLigada) {
      await EnvioComisionista.findByIdAndDelete(envio._id)
      await Viaje.findByIdAndUpdate(viajeId, { $inc: { capacidadDisponible: cantidad } })
      throw new Error('Esta orden ya tiene un envío asignado')
    }
  }

  emitNotificacion(viaje.comisionistaId.toString(), {
    tipo: 'envio',
    titulo: 'Nueva reserva en tu viaje',
    mensaje: `Te reservaron ${cantidad} bulto(s) ${tamano} de ${viaje.origen.ciudad} a ${viaje.destino.ciudad}.`,
    enlace: '/comisionistas/panel'
  })

  return { envio, codigoEntrega: codigo }
}

/**
 * El contratante paga un envío reservado: crea la preferencia de MP con split
 * al comisionista. El envío pasa a estado 'pendiente_pago'.
 */
export async function pagarEnvio(contratanteId, envioId, compradorEmail) {
  const { crearPreferenciaEnvio } = await import('./mercadoPagoService.js')

  const envio = await EnvioComisionista.findById(envioId)
  if (!envio) throw new Error('Envío no encontrado')
  if (envio.contratanteId.toString() !== contratanteId.toString()) throw new Error('No autorizado')
  if (envio.estado !== 'pendiente') throw new Error('El envío ya fue procesado o cancelado')
  if (envio.pago?.estadoPago === 'pagado') throw new Error('Este envío ya fue pagado')

  const viaje = await Viaje.findById(envio.viajeId)
  if (!viaje) throw new Error('Viaje no encontrado')

  const comisionista = await PerfilComisionista.findOne({ usuarioId: envio.comisionistaId })
  if (!comisionista || !comisionista.mpVinculado) {
    throw new Error('El comisionista todavía no vinculó su cuenta de Mercado Pago. Pedile que la vincule para poder pagar online.')
  }

  const { preferenceId, initPoint, marketplaceFee } = await crearPreferenciaEnvio({
    envio, viaje, comisionista, compradorEmail
  })

  envio.pago = {
    ...envio.pago,
    mpPreferenceId: preferenceId,
    comisionPlataforma: marketplaceFee,
    estadoPago: 'pendiente_pago'
  }
  await envio.save()

  return { initPoint, preferenceId }
}

/**
 * Verifica el pago de un envío consultando a MP por external_reference
 * (fallback al volver del checkout, por si el webhook no llegó).
 */
export async function verificarPagoEnvio(contratanteId, envioId) {
  const envio = await EnvioComisionista.findById(envioId)
  if (!envio) throw new Error('Envío no encontrado')
  if (envio.contratanteId.toString() !== contratanteId.toString()) throw new Error('No autorizado')
  if (envio.pago?.estadoPago === 'pagado') return envio

  try {
    const { MercadoPagoConfig, Payment } = await import('mercadopago')
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || '' })
    const search = await new Payment(client).search({
      options: { external_reference: `envio:${envioId}` }
    })
    const resultados = search?.results || []
    const aprobado = resultados.find(p => p.status === 'approved')
    if (aprobado) {
      return await marcarEnvioPagado(envioId, aprobado.id)
    }
  } catch (e) {
    console.warn('verificarPagoEnvio: no se pudo consultar a MP:', e.message)
  }
  return envio
}

/**
 * Marca el envío como pagado (lo invoca el webhook de MP). Idempotente.
 */
export async function marcarEnvioPagado(envioId, mpPaymentId) {
  const envio = await EnvioComisionista.findById(envioId)
  if (!envio) return null
  if (envio.pago?.estadoPago === 'pagado') return envio // idempotencia

  envio.pago = { ...envio.pago, mpPaymentId: mpPaymentId?.toString() || '', estadoPago: 'pagado' }
  await envio.save()

  emitNotificacion(envio.comisionistaId.toString(), {
    tipo: 'envio',
    titulo: 'Envío pagado',
    mensaje: 'El contratante pagó el envío. Ya podés coordinar la entrega.',
    enlace: '/comisionistas/envios-recibidos'
  })
  emitNotificacion(envio.contratanteId.toString(), {
    tipo: 'envio',
    titulo: 'Pago del envío confirmado',
    mensaje: 'Tu pago del envío fue confirmado. Coordiná la entrega con el comisionista por chat.',
    enlace: '/comisionistas/mis-envios'
  })
  return envio
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

  // Cross-checkout: desvincular la orden para que el comprador pueda elegir otro viaje.
  if (envio.ordenId) {
    await Orden.findOneAndUpdate(
      { _id: envio.ordenId, envioComisionistaId: envio._id },
      { $set: { envioComisionistaId: null, comisionistaId: null } }
    )
  }

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

    // Aviso TEMPRANO al vendedor: que NO despache por correo, porque el comprador
    // está gestionando el retiro con un comisionista en vivo. Se confirma recién
    // cuando el comprador acepte y pague una cotización.
    if (vendedorId) {
      emitNotificacion(vendedorId.toString(), {
        tipo: 'venta',
        titulo: 'Retiro por comisionista en vivo',
        mensaje: `El comprador de tu venta #${ordenId.toString().slice(-8).toUpperCase()} está buscando un comisionista que pase a retirar. No la despaches por correo todavía; te avisamos cuando se confirme.`,
        enlace: '/pedidos-vendedor'
      })
    }

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

/**
 * Cotizaciones "en vivo" que afectan a las ventas de un vendedor. Le permite ver,
 * por cada orden, que el retiro lo hace un comisionista (y en qué estado está) en
 * vez de despacharla él. Solo las que ya tienen un comisionista en juego
 * (estado distinto de cancelada/rechazada) para no ensuciar el panel.
 */
export async function cotizacionesDeMisVentas(vendedorId) {
  return await SolicitudCotizacion.find({
    vendedorId,
    estado: { $nin: ['rechazada', 'cancelada'] }
  })
    .sort({ createdAt: -1 })
    .populate('comisionistaId', 'nombre avatar')
    .populate('compradorId', 'nombre avatar')
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
    mensaje: 'Un comprador aceptó tu cotización. Coordiná el retiro con el vendedor y la entrega con el comprador por chat.',
    enlace: '/comisionistas/mi-perfil'
  })

  // El vendedor YA tiene certeza: este pedido lo retira un comisionista, no lo
  // despacha él. Le pasamos el nombre del comisionista para que lo reconozca al
  // retirar, y se desbloquea el chat vendedor↔comisionista para coordinar.
  if (solicitud.vendedorId) {
    const comisionista = await Usuario.findById(solicitud.comisionistaId).select('nombre').lean()
    const nombreCom = comisionista?.nombre || 'un comisionista'
    emitNotificacion(solicitud.vendedorId.toString(), {
      tipo: 'venta',
      titulo: 'Retiro confirmado por comisionista',
      mensaje: `${nombreCom} va a pasar a retirar tu venta #${solicitud.ordenId.toString().slice(-8).toUpperCase()}. Prepará el paquete; coordiná el retiro por chat.`,
      enlace: '/pedidos-vendedor'
    })
  }

  // Si la orden estaba en "subasta" en vivo: adjudicarla y CERRAR la competencia.
  // Las otras ofertas pasan a rechazada y se les avisa a esos comisionistas que
  // el envío ya fue tomado (no quedan esperando).
  await adjudicarEnvioEnVivo(solicitud.ordenId, solicitud._id)

  return solicitud
}

/** Rechaza las ofertas perdedoras de una orden y les avisa. Idempotente. */
async function rechazarOfertasPerdedoras(ordenId, solicitudGanadoraId) {
  const perdedoras = await SolicitudCotizacion.find({
    ordenId,
    _id: { $ne: solicitudGanadoraId },
    estado: { $in: ['pendiente', 'cotizada'] }
  })
  for (const p of perdedoras) {
    p.estado = 'rechazada'
    await p.save()
    emitNotificacion(p.comisionistaId.toString(), {
      tipo: 'cotizacion',
      titulo: 'Envío tomado por otro comisionista',
      mensaje: 'Otro comisionista se quedó con este envío. ¡Seguí atento, que vienen más!',
      enlace: '/comisionistas/mi-perfil'
    })
  }
}

/**
 * Cierra la subasta en vivo de una orden: marca la orden como adjudicada y
 * rechaza las ofertas perdedoras. Idempotente.
 */
async function adjudicarEnvioEnVivo(ordenId, solicitudGanadoraId) {
  const orden = await Orden.findById(ordenId).select('entregaEnVivo')
  if (!orden || !orden.entregaEnVivo?.activa) return
  if (orden.entregaEnVivo.estado === 'adjudicado') return

  await Orden.updateOne({ _id: ordenId }, { $set: { 'entregaEnVivo.estado': 'adjudicado' } })
  emitEnvioVivoCerrado(ordenId)  // desaparece de los paneles en vivo
  await rechazarOfertasPerdedoras(ordenId, solicitudGanadoraId)
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

  // Si el comprador canceló y la orden estaba adjudicada en una subasta en vivo,
  // la REABRIMOS para que otros comisionistas vuelvan a competir (no se pierde).
  if (esComprador && solicitud.ordenId) {
    await reabrirEnvioEnVivo(solicitud.ordenId).catch(() => {})
  }
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
  if (solicitud.vendedorId) {
    emitNotificacion(solicitud.vendedorId.toString(), {
      tipo: 'venta',
      titulo: 'Traslado pagado — preparar retiro',
      mensaje: `El traslado de tu venta #${solicitud.ordenId.toString().slice(-8).toUpperCase()} ya está pagado. Tené el paquete listo para cuando pase el comisionista.`,
      enlace: '/pedidos-vendedor'
    })
  }
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

// ===== Reseñas de comisionista =====

/**
 * Recalcula la calificación promedio del comisionista a partir de TODAS sus
 * reseñas. Fuente única de verdad de PerfilComisionista.calificacion.
 */
async function recalcularCalificacionComisionista(comisionistaId) {
  const resenas = await ResenaComisionista.find({ comisionistaId }).select('calificacion')
  if (resenas.length === 0) {
    await PerfilComisionista.findOneAndUpdate({ usuarioId: comisionistaId }, { calificacion: 0 })
    return
  }
  const suma = resenas.reduce((acc, r) => acc + r.calificacion, 0)
  const promedio = Math.round((suma / resenas.length) * 10) / 10
  await PerfilComisionista.findOneAndUpdate({ usuarioId: comisionistaId }, { calificacion: promedio })
}

/**
 * El contratante reseña al comisionista tras un envío entregado. Valida:
 * - el envío existe y es del contratante
 * - el envío está 'entregado'
 * - no reseñó antes (índice unique + chequeo explícito para mensaje claro)
 */
export async function reseñarComisionista(contratanteId, envioId, { calificacion, comentario = '' }) {
  const cal = Number(calificacion)
  if (!Number.isInteger(cal) || cal < 1 || cal > 5) {
    throw new Error('La calificación debe ser un número del 1 al 5')
  }

  const envio = await EnvioComisionista.findById(envioId)
  if (!envio) throw new Error('Envío no encontrado')
  if (envio.contratanteId.toString() !== contratanteId.toString()) throw new Error('No autorizado')
  if (envio.estado !== 'entregado') throw new Error('Solo podés reseñar envíos ya entregados')

  const yaResenado = await ResenaComisionista.findOne({ contratanteId, envioId }).select('_id')
  if (yaResenado) throw new Error('Ya reseñaste este envío')

  const resena = await new ResenaComisionista({
    contratanteId,
    comisionistaId: envio.comisionistaId,
    envioId,
    calificacion: cal,
    comentario: (comentario || '').slice(0, 1000)
  }).save()

  await recalcularCalificacionComisionista(envio.comisionistaId)

  emitNotificacion(envio.comisionistaId.toString(), {
    tipo: 'envio',
    titulo: 'Nueva reseña',
    mensaje: `Recibiste una reseña de ${cal}★ por un envío.`,
    enlace: '/comisionistas/mi-perfil'
  })

  return resena
}

/** Reseñas públicas de un comisionista (para mostrar en su perfil). */
export async function resenasComisionista(comisionistaId, { skip = 0, limit = 20 } = {}) {
  const resenas = await ResenaComisionista.find({ comisionistaId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('contratanteId', 'nombre avatar')
  const total = await ResenaComisionista.countDocuments({ comisionistaId })
  return { resenas, total }
}

/** IDs de envíos que el contratante ya reseñó (para que el front oculte el botón). */
export async function enviosReseñadosPor(contratanteId) {
  const resenas = await ResenaComisionista.find({ contratanteId }).select('envioId')
  return resenas.map(r => r.envioId.toString())
}

// ===== Envío "comisionista en vivo" — SUBASTA / BROADCAST competitivo =====
//
// Cuando el comprador elige "comisionista en vivo" en el checkout y paga, se hace
// un BROADCAST a los comisionistas trabajando: compiten ofertando precio y el
// comprador elige. Reusa SolicitudCotizacion (una oferta por comisionista, índice
// único ordenId+comisionistaId). Reusa también aceptar/pagar/chat/código.

const VENTANA_EN_VIVO_MIN = 30  // minutos que dura la "subasta" antes de expirar

// Deriva vendedor + ciudades de una orden (para el retiro y el match geográfico).
async function contextoEntregaOrden(orden) {
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
  return { vendedorId, ciudadOrigen, ciudadDestino: orden.ciudadEntrega || '' }
}

/**
 * Abre la subasta en vivo de una orden paga y NOTIFICA a los comisionistas
 * elegibles (trabajando + verificados, priorizando los que cubren el destino).
 * Idempotente: si ya está en 'buscando'/'adjudicado' no hace nada.
 * Se llama desde el webhook al confirmarse el pago.
 */
export async function abrirEnvioEnVivo(orden) {
  if (!orden?.entregaEnVivo?.activa) return { ok: false, motivo: 'no_aplica' }
  if (['buscando', 'adjudicado'].includes(orden.entregaEnVivo.estado)) {
    return { ok: false, motivo: 'ya_abierta' }
  }

  const { ciudadDestino, ciudadOrigen } = await contextoEntregaOrden(orden)
  const expiraEn = new Date(Date.now() + VENTANA_EN_VIVO_MIN * 60 * 1000)
  await Orden.updateOne(
    { _id: orden._id },
    { $set: { 'entregaEnVivo.estado': 'buscando', 'entregaEnVivo.expiraEn': expiraEn } }
  )

  // Elegibles: trabajando ahora + documento verificado (comisionistasEnVivo ya
  // los ordena por reputación/viajes y prioriza a los que cubren el destino).
  const elegibles = await comisionistasEnVivo({ ciudadDestino })
  const ref = `#${orden._id.toString().slice(-8).toUpperCase()}`
  const payload = {
    ordenId: orden._id.toString(),
    compradorId: orden.compradorId.toString(),  // para que el cliente filtre su propia compra
    ref,
    ciudadOrigen,
    ciudadDestino,
    descripcionCarga: (orden.items || []).map(i => i.nombre).join(', '),
    totalProductos: (orden.items || []).reduce((n, i) => n + i.cantidad, 0),
    ofertasActuales: 0,
    expiraEn
  }
  const mensajePush = {
    tipo: 'envio',
    titulo: '🔥 Nuevo envío en vivo — ¡agarralo!',
    mensaje: `Retiro en ${ciudadOrigen || 'tu zona'} → entrega en ${ciudadDestino || 'destino'} (orden ${ref}). Tomalo antes que otro.`,
    enlace: '/comisionistas/mi-perfil'
  }

  // ACCESO ANTICIPADO (#2): los TOP de la lista (mejor reputación/viajes, o que
  // cubren el destino) reciben el envío YA; el resto unos segundos después. Es el
  // premio por estar bien calificado y activo.
  const DELAY_RESTO_MS = 8000
  const TOP = 3
  const top = elegibles.slice(0, TOP)
  const resto = elegibles.slice(TOP)
  const uidDe = (c) => (c.usuarioId || c.usuario?._id)?.toString()

  for (const c of top) {
    const uid = uidDe(c)
    if (!uid) continue
    emitNotificacion(uid, mensajePush)        // push + persistido (app cerrada)
    emitEnvioVivoNuevoA(uid, payload)         // aparece YA en su panel
  }
  // El resto: tras el delay (si la subasta sigue abierta).
  if (resto.length > 0) {
    setTimeout(() => {
      for (const c of resto) {
        const uid = uidDe(c)
        if (uid) emitNotificacion(uid, mensajePush)
      }
      // Difusión general al panel para cualquier comisionista conectado.
      emitEnvioVivoNuevo(payload)
    }, DELAY_RESTO_MS)
  }

  return { ok: true, avisados: elegibles.length, expiraEn }
}

/**
 * Lista las órdenes con subasta en vivo ABIERTA para que un comisionista las vea
 * y compita. Excluye las que ese comisionista ya ofertó. Incluye un contador de
 * ofertas actuales (señal de competencia → "apurate").
 */
export async function enviosEnVivoAbiertos(comisionistaId) {
  const ahora = new Date()
  const ordenes = await Orden.find({
    'entregaEnVivo.activa': true,
    'entregaEnVivo.estado': 'buscando',
    'entregaEnVivo.expiraEn': { $gt: ahora }
  })
    .sort({ 'entregaEnVivo.expiraEn': 1 })
    .limit(50)
    .lean()

  const resultado = []
  for (const orden of ordenes) {
    // El comisionista no puede ofertar a su propia compra.
    if (orden.compradorId.toString() === comisionistaId.toString()) continue

    const yaOferto = await SolicitudCotizacion.findOne({
      ordenId: orden._id, comisionistaId
    }).select('_id estado').lean()
    if (yaOferto) continue

    const { ciudadOrigen, ciudadDestino } = await contextoEntregaOrden(orden)
    const totalOfertas = await SolicitudCotizacion.countDocuments({
      ordenId: orden._id, estado: { $in: ['pendiente', 'cotizada'] }
    })
    resultado.push({
      ordenId: orden._id,
      ref: `#${orden._id.toString().slice(-8).toUpperCase()}`,
      ciudadOrigen,
      ciudadDestino,
      descripcionCarga: (orden.items || []).map(i => i.nombre).join(', '),
      totalProductos: (orden.items || []).reduce((n, i) => n + i.cantidad, 0),
      ofertasActuales: totalOfertas,
      expiraEn: orden.entregaEnVivo.expiraEn
    })
  }
  return resultado
}

/**
 * Un comisionista OFERTA por un envío en vivo (compite). Crea una
 * SolicitudCotizacion ya cotizada (con su precio). El comprador la verá junto a
 * las demás y elige. Valida elegibilidad, ventana y que no haya ofertado ya.
 */
export async function ofertarEnvioEnVivo(comisionistaId, ordenId, { monto, tiempoEstimado }) {
  const montoNum = Number(monto)
  if (!Number.isFinite(montoNum) || montoNum <= 0) throw new Error('Ingresá un precio válido')

  const orden = await Orden.findById(ordenId)
  if (!orden) throw new Error('Orden no encontrada')
  if (!orden.entregaEnVivo?.activa || orden.entregaEnVivo.estado !== 'buscando') {
    throw new Error('Este envío ya no está disponible')
  }
  if (orden.entregaEnVivo.expiraEn && orden.entregaEnVivo.expiraEn < new Date()) {
    throw new Error('La ventana para ofertar expiró')
  }
  if (orden.compradorId.toString() === comisionistaId.toString()) {
    throw new Error('No podés ofertar a tu propia compra')
  }

  // El comisionista debe estar activo y verificado.
  const perfil = await PerfilComisionista.findOne({ usuarioId: comisionistaId })
  if (!perfil || !perfil.activo || perfil.estadoDocumento !== 'verificado') {
    throw new Error('Necesitás estar verificado y activo para ofertar')
  }

  const { vendedorId, ciudadOrigen, ciudadDestino } = await contextoEntregaOrden(orden)
  const notas = tiempoEstimado ? `Tiempo estimado: ${tiempoEstimado}` : ''

  let solicitud
  try {
    solicitud = await new SolicitudCotizacion({
      ordenId,
      compradorId: orden.compradorId,
      comisionistaId,
      vendedorId,
      ciudadOrigen,
      ciudadDestino,
      descripcionCarga: (orden.items || []).map(i => i.nombre).join(', '),
      terminosAceptados: true,  // el comprador aceptó el deslinde al elegir "en vivo"
      estado: 'cotizada',
      cotizacion: { monto: montoNum, notas, fecha: new Date() }
    }).save()
  } catch (err) {
    if (err.code === 11000) throw new Error('Ya ofertaste por este envío')
    throw err
  }

  // Avisar al comprador que tiene una oferta (y cuántos están compitiendo).
  const totalOfertas = await SolicitudCotizacion.countDocuments({
    ordenId, estado: { $in: ['pendiente', 'cotizada'] }
  })
  emitNotificacion(orden.compradorId.toString(), {
    tipo: 'cotizacion',
    titulo: '🔥 Tenés una oferta para tu envío',
    mensaje: totalOfertas > 1
      ? `${totalOfertas} comisionistas se están peleando por tu envío. Mirá las ofertas y elegí la mejor.`
      : `Un comisionista te ofertó $${montoNum.toLocaleString('es-AR')}. Mirá la oferta y aceptá si te sirve.`,
    enlace: '/comisionistas/mis-cotizaciones'
  })

  // Tiempo real: actualiza el contador de competidores en los paneles.
  emitEnvioVivoActualizado(ordenId, totalOfertas)

  return solicitud
}

/**
 * Cron: expira las subastas en vivo sin adjudicar pasada la ventana y le avisa
 * al comprador para que use envío estándar (no queda colgado).
 */
export async function expirarEnviosEnVivo() {
  const ahora = new Date()
  const vencidas = await Orden.find({
    'entregaEnVivo.activa': true,
    'entregaEnVivo.estado': 'buscando',
    'entregaEnVivo.expiraEn': { $lt: ahora }
  }).select('_id compradorId entregaEnVivo').limit(100)

  let cerradas = 0
  for (const orden of vencidas) {
    await Orden.updateOne({ _id: orden._id }, { $set: { 'entregaEnVivo.estado': 'expirado' } })
    emitEnvioVivoCerrado(orden._id)  // sacarlo de los paneles en vivo
    const tieneOfertas = await SolicitudCotizacion.countDocuments({
      ordenId: orden._id, estado: { $in: ['pendiente', 'cotizada'] }
    })
    emitNotificacion(orden.compradorId.toString(), {
      tipo: 'envio',
      titulo: tieneOfertas > 0 ? 'Tus ofertas de envío están por vencer' : 'No hubo comisionistas disponibles',
      mensaje: tieneOfertas > 0
        ? 'Todavía tenés ofertas para tu envío: elegí una antes de que se enfríen.'
        : 'Por ahora no hay comisionistas en vivo para tu compra. El vendedor puede despacharla por envío estándar.',
      enlace: '/comisionistas/mis-cotizaciones'
    })
    cerradas++
  }
  return cerradas
}

/**
 * "AGARRAR YA" — el comisionista toma el envío al instante (primero que llega se
 * lo lleva). Adjudicación ATÓMICA: si dos tocan a la vez, solo uno gana. Crea la
 * cotización YA ACEPTADA (con su precio) y solo falta que el comprador pague el
 * traslado para confirmar. Es la vía más rápida del modo tiburón.
 */
export async function tomarEnvioEnVivo(comisionistaId, ordenId, { monto, tiempoEstimado }) {
  const montoNum = Number(monto)
  if (!Number.isFinite(montoNum) || montoNum <= 0) throw new Error('Ingresá un precio válido')

  const perfil = await PerfilComisionista.findOne({ usuarioId: comisionistaId })
  if (!perfil || !perfil.activo || perfil.estadoDocumento !== 'verificado') {
    throw new Error('Necesitás estar verificado y activo para tomar envíos')
  }

  // Claim atómico: solo adjudica si sigue 'buscando' y dentro de la ventana.
  const orden = await Orden.findOneAndUpdate(
    {
      _id: ordenId,
      'entregaEnVivo.activa': true,
      'entregaEnVivo.estado': 'buscando',
      'entregaEnVivo.expiraEn': { $gt: new Date() }
    },
    { $set: { 'entregaEnVivo.estado': 'adjudicado' } },
    { new: true }
  )
  if (!orden) throw new Error('Otro comisionista se adelantó o el envío ya cerró')

  if (orden.compradorId.toString() === comisionistaId.toString()) {
    await Orden.updateOne({ _id: ordenId }, { $set: { 'entregaEnVivo.estado': 'buscando' } })
    throw new Error('No podés tomar tu propia compra')
  }

  const { vendedorId, ciudadOrigen, ciudadDestino } = await contextoEntregaOrden(orden)
  const notas = tiempoEstimado ? `Tiempo estimado: ${tiempoEstimado}` : ''

  // Si ya tenía una oferta abierta para esta orden, la promovemos a aceptada;
  // si no, creamos una nueva ya aceptada. (Respeta el índice único ordenId+comisionista.)
  let solicitud = await SolicitudCotizacion.findOne({ ordenId, comisionistaId })
  try {
    if (solicitud) {
      solicitud.estado = 'aceptada'
      solicitud.cotizacion = { monto: montoNum, notas, fecha: new Date() }
      await solicitud.save()
    } else {
      solicitud = await new SolicitudCotizacion({
        ordenId,
        compradorId: orden.compradorId,
        comisionistaId,
        vendedorId,
        ciudadOrigen,
        ciudadDestino,
        descripcionCarga: (orden.items || []).map(i => i.nombre).join(', '),
        terminosAceptados: true,
        estado: 'aceptada',
        cotizacion: { monto: montoNum, notas, fecha: new Date() }
      }).save()
    }
  } catch (err) {
    await Orden.updateOne({ _id: ordenId }, { $set: { 'entregaEnVivo.estado': 'buscando' } })
    throw err
  }

  emitEnvioVivoCerrado(ordenId)
  await rechazarOfertasPerdedoras(ordenId, solicitud._id)

  // Avisar al comprador: ya tiene comisionista; solo falta pagar el traslado.
  const com = await Usuario.findById(comisionistaId).select('nombre').lean()
  const ref = `#${ordenId.toString().slice(-8).toUpperCase()}`
  emitNotificacion(orden.compradorId.toString(), {
    tipo: 'cotizacion',
    titulo: '🦈 Un comisionista tomó tu envío',
    mensaje: `${com?.nombre || 'Un comisionista'} se quedó con tu envío ${ref} por $${montoNum.toLocaleString('es-AR')}. Pagá el traslado para confirmar (o cancelá si no te sirve).`,
    enlace: '/comisionistas/mis-cotizaciones'
  })
  // Avisar al vendedor (preparar retiro) + desbloquear chat vendedor↔comisionista.
  if (vendedorId) {
    emitNotificacion(vendedorId.toString(), {
      tipo: 'venta',
      titulo: 'Retiro confirmado por comisionista',
      mensaje: `${com?.nombre || 'Un comisionista'} va a pasar a retirar tu venta ${ref}. Prepará el paquete; coordiná el retiro por chat.`,
      enlace: '/pedidos-vendedor'
    })
  }
  emitNotificacion(comisionistaId.toString(), {
    tipo: 'envio',
    titulo: '✅ ¡Te quedaste con el envío!',
    mensaje: `Tomaste el envío ${ref}. Coordiná el retiro con el vendedor y la entrega con el comprador por chat.`,
    enlace: '/comisionistas/mi-perfil'
  })

  return solicitud
}

/**
 * Reabre la subasta de un envío en vivo (ej: el comprador canceló la oferta
 * adjudicada). Vuelve a 'buscando' con ventana nueva y reaparece en los paneles.
 */
async function reabrirEnvioEnVivo(ordenId) {
  const orden = await Orden.findById(ordenId)
  if (!orden || !orden.entregaEnVivo?.activa) return
  if (orden.entregaEnVivo.estado !== 'adjudicado') return
  // ¿Queda alguna oferta viva? Si el comprador canceló todas, reabrimos.
  const vivas = await SolicitudCotizacion.countDocuments({
    ordenId, estado: { $in: ['pendiente', 'cotizada', 'aceptada'] }
  })
  if (vivas > 0) return

  const expiraEn = new Date(Date.now() + VENTANA_EN_VIVO_MIN * 60 * 1000)
  await Orden.updateOne(
    { _id: ordenId },
    { $set: { 'entregaEnVivo.estado': 'buscando', 'entregaEnVivo.expiraEn': expiraEn } }
  )
  const { ciudadOrigen, ciudadDestino } = await contextoEntregaOrden(orden)
  emitEnvioVivoNuevo({
    ordenId: orden._id.toString(),
    compradorId: orden.compradorId.toString(),
    ref: `#${orden._id.toString().slice(-8).toUpperCase()}`,
    ciudadOrigen,
    ciudadDestino,
    descripcionCarga: (orden.items || []).map(i => i.nombre).join(', '),
    totalProductos: (orden.items || []).reduce((n, i) => n + i.cantidad, 0),
    ofertasActuales: 0,
    expiraEn
  })
}

/**
 * "DÍA RENTABLE": resumen del día del comisionista (ganancias + cantidad), para
 * el contador motivacional del panel. Suma traslados en vivo y envíos de viajes
 * pagados hoy.
 */
export async function resumenDiaComisionista(comisionistaId) {
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)

  const [traslados, envios] = await Promise.all([
    SolicitudCotizacion.find({
      comisionistaId,
      'pago.estadoPago': 'pagado',
      updatedAt: { $gte: inicio }
    }).select('cotizacion.monto').lean(),
    EnvioComisionista.find({
      comisionistaId,
      'pago.estadoPago': 'pagado',
      updatedAt: { $gte: inicio }
    }).select('precio').lean()
  ])

  const totalTraslados = traslados.reduce((s, t) => s + (t.cotizacion?.monto || 0), 0)
  const totalEnvios = envios.reduce((s, e) => s + (e.precio || 0), 0)
  const cantidad = traslados.length + envios.length

  return {
    ganancia: totalTraslados + totalEnvios,
    cantidad,
    // Cuántos envíos en vivo están abiertos AHORA (oportunidades para sumar).
    oportunidades: await Orden.countDocuments({
      'entregaEnVivo.activa': true,
      'entregaEnVivo.estado': 'buscando',
      'entregaEnVivo.expiraEn': { $gt: new Date() }
    })
  }
}
