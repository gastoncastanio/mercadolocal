import PerfilComisionista from '../models/PerfilComisionista.js'
import ViajeRemis from '../models/ViajeRemis.js'
import ResenaComisionista from '../models/ResenaComisionista.js'
import { emitNotificacion } from './socketService.js'

/**
 * remisService — lógica del vertical "MercadoLocal Remis": traslado de personas
 * estilo app. Reutiliza el PerfilComisionista (conductor verificado, vehículo,
 * MP vinculado, toggle "estoy trabajando") y el patrón de split de pago.
 */

// ===== Tarifas del conductor =====

/**
 * El conductor activa/desactiva el remis y configura sus tarifas. Requiere tener
 * el documento del vehículo verificado para poder ofrecer remis (igual que para
 * trabajar como comisionista).
 */
export async function configurarRemis(usuarioId, { ofreceRemis, tarifasRemis }) {
  const perfil = await PerfilComisionista.findOne({ usuarioId })
  if (!perfil) throw new Error('Necesitás un perfil de comisionista para ofrecer remis')

  if (ofreceRemis && perfil.estadoDocumento !== 'verificado') {
    throw new Error('Necesitás tener el documento del vehículo verificado para ofrecer remis')
  }

  if (ofreceRemis !== undefined) perfil.ofreceRemis = !!ofreceRemis

  if (tarifasRemis && typeof tarifasRemis === 'object') {
    const num = (v) => {
      const n = Number(v)
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
    }
    perfil.tarifasRemis = {
      banderita: num(tarifasRemis.banderita),
      porKm: num(tarifasRemis.porKm),
      porHoraEspera: num(tarifasRemis.porHoraEspera),
      minimo: num(tarifasRemis.minimo)
    }
  }

  await perfil.save()
  await perfil.populate('usuarioId', 'nombre avatar')
  return perfil.toPublic()
}

/**
 * Calcula el precio de un viaje de remis a partir de las tarifas del conductor.
 * precio = banderita + (km * porKm) + (horasEspera * porHoraEspera), nunca menor
 * al mínimo configurado.
 */
export function calcularPrecioRemis(tarifas, { distanciaKm = 0, horasEspera = 0 } = {}) {
  if (!tarifas) return 0
  const km = Math.max(0, Number(distanciaKm) || 0)
  const horas = Math.max(0, Number(horasEspera) || 0)
  const base = (tarifas.banderita || 0) + km * (tarifas.porKm || 0) + horas * (tarifas.porHoraEspera || 0)
  return Math.max(Math.round(base), tarifas.minimo || 0)
}

/**
 * Remiseros disponibles AHORA: ofrecen remis, están trabajando, documento
 * verificado y MP vinculado (para poder cobrar). Si se pasa ciudad, prioriza a
 * los que la tienen entre sus zonas habituales. Incluye un precio estimado por
 * conductor si se pasan km/horas.
 */
export async function remiserosDisponibles({ ciudad, distanciaKm = 0, horasEspera = 0 } = {}) {
  const perfiles = await PerfilComisionista.find({
    ofreceRemis: true,
    estaTrabajandoHoy: true,
    activo: true,
    estadoDocumento: 'verificado'
  })
    .sort({ calificacion: -1, totalViajes: -1 })
    .limit(50)
    .populate('usuarioId', 'nombre avatar')

  let resultado = perfiles.map(p => {
    const pub = p.toPublic()
    return {
      ...pub,
      precioEstimado: calcularPrecioRemis(p.tarifasRemis, { distanciaKm, horasEspera })
    }
  })

  if (ciudad) {
    const norm = ciudad.trim().toLowerCase()
    resultado = resultado
      .map(p => ({
        ...p,
        cubreCiudad: (p.zonasHabituales || []).some(z => z.trim().toLowerCase() === norm)
      }))
      .sort((a, b) => Number(b.cubreCiudad) - Number(a.cubreCiudad))
  }

  return resultado
}

// ===== Pedido de remis (pasajero) =====

/**
 * El pasajero pide un remis. Puede dirigirlo a un conductor puntual
 * (comisionistaIdPreferido) o dejarlo abierto a que cualquier remisero disponible
 * lo tome (modelo broadcast estilo app). El precio estimado se calcula con las
 * tarifas del conductor elegido, o queda en 0 si es abierto (se confirma al tomar).
 */
export async function pedirRemis(pasajeroId, datos) {
  const {
    origen, destino, tipoServicio = 'traslado',
    distanciaKm = 0, horasEspera = 0, pasajeros = 1,
    notas = '', programadoPara = null, comisionistaIdPreferido = null
  } = datos

  if (!origen?.direccion || !destino?.direccion) {
    throw new Error('Origen y destino son obligatorios')
  }
  if (!['traslado', 'ida_vuelta', 'dia_compras'].includes(tipoServicio)) {
    throw new Error('Tipo de servicio inválido')
  }

  // Evitar que el pasajero se pida remis a sí mismo si dirige a un conductor.
  if (comisionistaIdPreferido && comisionistaIdPreferido.toString() === pasajeroId.toString()) {
    throw new Error('No podés pedirte un remis a vos mismo')
  }

  // Precio estimado: si hay conductor preferido, con sus tarifas.
  let precioEstimado = 0
  if (comisionistaIdPreferido) {
    const perfil = await PerfilComisionista.findOne({ usuarioId: comisionistaIdPreferido })
    if (!perfil || !perfil.ofreceRemis) throw new Error('Ese conductor no ofrece remis')
    precioEstimado = calcularPrecioRemis(perfil.tarifasRemis, { distanciaKm, horasEspera })
  }

  const limpiar = (p) => ({
    direccion: (p.direccion || '').trim(),
    ciudad: (p.ciudad || '').trim(),
    referencia: (p.referencia || '').trim(),
    lat: Number.isFinite(Number(p.lat)) ? Number(p.lat) : null,
    lng: Number.isFinite(Number(p.lng)) ? Number(p.lng) : null
  })

  const viaje = await new ViajeRemis({
    pasajeroId,
    origen: limpiar(origen),
    destino: limpiar(destino),
    tipoServicio,
    distanciaKm: Math.max(0, Number(distanciaKm) || 0),
    horasEspera: Math.max(0, Number(horasEspera) || 0),
    pasajeros: Math.max(1, Number(pasajeros) || 1),
    precioEstimado,
    notas: (notas || '').slice(0, 500),
    programadoPara: programadoPara ? new Date(programadoPara) : null,
    estado: 'buscando'
  }).save()

  // Notificar: a un conductor puntual, o a todos los remiseros disponibles.
  if (comisionistaIdPreferido) {
    emitNotificacion(comisionistaIdPreferido.toString(), {
      tipo: 'remis',
      titulo: 'Nuevo pedido de remis',
      mensaje: `Te pidieron un remis de ${viaje.origen.direccion} a ${viaje.destino.direccion}.`,
      enlace: '/remis/conductor'
    })
  } else {
    await notificarRemiserosDisponibles(viaje)
  }

  return viaje
}

// Avisa a los remiseros disponibles que hay un pedido abierto en su ciudad.
async function notificarRemiserosDisponibles(viaje) {
  const ciudad = viaje.origen.ciudad
  const disponibles = await PerfilComisionista.find({
    ofreceRemis: true,
    estaTrabajandoHoy: true,
    activo: true,
    estadoDocumento: 'verificado'
  }).select('usuarioId zonasHabituales').lean()

  const norm = (s) => (s || '').trim().toLowerCase()
  for (const p of disponibles) {
    // Si el pedido tiene ciudad, priorizar a quienes la cubren; si no, a todos.
    const cubre = !ciudad || (p.zonasHabituales || []).some(z => norm(z) === norm(ciudad))
    if (!cubre) continue
    emitNotificacion(p.usuarioId.toString(), {
      tipo: 'remis',
      titulo: 'Pedido de remis disponible',
      mensaje: `Hay un pedido de remis${ciudad ? ` en ${ciudad}` : ''}. ¡Tomalo antes que otro!`,
      enlace: '/remis/conductor'
    })
  }
}

// Pedidos abiertos que un conductor disponible puede tomar (cola del conductor).
export async function pedidosAbiertos(comisionistaId) {
  const perfil = await PerfilComisionista.findOne({ usuarioId: comisionistaId }).select('zonasHabituales ofreceRemis')
  if (!perfil || !perfil.ofreceRemis) return []

  const viajes = await ViajeRemis.find({ estado: 'buscando' })
    .sort({ createdAt: -1 })
    .limit(30)
    .populate('pasajeroId', 'nombre avatar')

  return viajes.map(v => v.toPublic())
}

// ===== Tomar / gestionar el viaje (conductor) =====

/**
 * El conductor toma un pedido abierto. Claim ATÓMICO buscando→aceptado: si dos
 * conductores tocan "Aceptar" al mismo tiempo, solo uno gana (el otro recibe
 * "ya fue tomado"). Requiere ser remisero disponible y verificado.
 */
export async function aceptarRemis(comisionistaId, viajeRemisId) {
  const perfil = await PerfilComisionista.findOne({ usuarioId: comisionistaId })
  if (!perfil) throw new Error('No tenés perfil de comisionista')
  if (!perfil.ofreceRemis) throw new Error('No tenés activado el servicio de remis')
  if (perfil.estadoDocumento !== 'verificado') {
    throw new Error('Necesitás el documento del vehículo verificado para tomar remises')
  }

  const viajePrevio = await ViajeRemis.findById(viajeRemisId)
  if (!viajePrevio) throw new Error('Pedido de remis no encontrado')
  if (viajePrevio.pasajeroId.toString() === comisionistaId.toString()) {
    throw new Error('No podés tomar tu propio pedido')
  }

  // Precio: si el pedido era abierto (sin conductor), lo recalculamos con las
  // tarifas de quien lo toma.
  const precioEstimado = viajePrevio.precioEstimado > 0
    ? viajePrevio.precioEstimado
    : calcularPrecioRemis(perfil.tarifasRemis, {
        distanciaKm: viajePrevio.distanciaKm,
        horasEspera: viajePrevio.horasEspera
      })

  const viaje = await ViajeRemis.findOneAndUpdate(
    { _id: viajeRemisId, estado: 'buscando' },
    {
      $set: {
        estado: 'aceptado',
        comisionistaId,
        aceptadoEn: new Date(),
        precioEstimado
      }
    },
    { new: true }
  )
  if (!viaje) throw new Error('Este pedido ya fue tomado o cancelado')

  emitNotificacion(viaje.pasajeroId.toString(), {
    tipo: 'remis',
    titulo: 'Remis confirmado',
    mensaje: 'Un conductor tomó tu viaje. Coordiná el punto de encuentro por chat.',
    enlace: '/remis/mis-viajes'
  })

  await viaje.populate('comisionistaId', 'nombre avatar')
  await viaje.populate('pasajeroId', 'nombre avatar')
  return viaje
}

// Transiciones de estado del conductor: aceptado→en_camino→a_bordo→finalizado.
const TRANSICIONES_REMIS = {
  aceptado: ['en_camino'],
  en_camino: ['a_bordo'],
  a_bordo: ['finalizado']
}

const AVISO_ESTADO = {
  en_camino: { titulo: 'Tu remis está en camino', mensaje: 'El conductor va hacia el punto de encuentro.' },
  a_bordo: { titulo: 'Viaje en curso', mensaje: 'Subiste al remis. ¡Buen viaje!' },
  finalizado: { titulo: 'Viaje finalizado', mensaje: 'Tu viaje terminó. ¡Gracias por usar MercadoLocal Remis!' }
}

/**
 * El conductor avanza el estado del viaje. Al finalizar puede confirmar el
 * precio final (por si el día de compras se extendió). Suma al historial.
 */
export async function avanzarEstadoRemis(comisionistaId, viajeRemisId, nuevoEstado, { precioFinal } = {}) {
  const viaje = await ViajeRemis.findById(viajeRemisId)
  if (!viaje) throw new Error('Viaje no encontrado')
  if (!viaje.comisionistaId || viaje.comisionistaId.toString() !== comisionistaId.toString()) {
    throw new Error('No autorizado')
  }
  const permitidos = TRANSICIONES_REMIS[viaje.estado] || []
  if (!permitidos.includes(nuevoEstado)) {
    throw new Error(`No se puede pasar de "${viaje.estado}" a "${nuevoEstado}"`)
  }

  const update = { estado: nuevoEstado }
  if (nuevoEstado === 'finalizado') {
    update.finalizadoEn = new Date()
    if (precioFinal != null && Number.isFinite(Number(precioFinal)) && Number(precioFinal) >= 0) {
      update.precioFinal = Math.round(Number(precioFinal))
    } else {
      update.precioFinal = viaje.precioEstimado
    }
  }

  const actualizado = await ViajeRemis.findOneAndUpdate(
    { _id: viajeRemisId, estado: viaje.estado },
    { $set: update },
    { new: true }
  )
  if (!actualizado) throw new Error('El viaje ya fue procesado')

  if (nuevoEstado === 'finalizado') {
    await PerfilComisionista.findOneAndUpdate({ usuarioId: comisionistaId }, { $inc: { totalViajes: 1 } })
  }

  const aviso = AVISO_ESTADO[nuevoEstado]
  if (aviso) {
    emitNotificacion(actualizado.pasajeroId.toString(), {
      tipo: 'remis',
      titulo: aviso.titulo,
      mensaje: aviso.mensaje,
      enlace: '/remis/mis-viajes'
    })
  }

  return actualizado
}

/** Cancelar un viaje de remis (pasajero o conductor) antes de finalizar. */
export async function cancelarRemis(usuarioId, viajeRemisId) {
  const viaje = await ViajeRemis.findById(viajeRemisId)
  if (!viaje) throw new Error('Viaje no encontrado')

  const esPasajero = viaje.pasajeroId.toString() === usuarioId.toString()
  const esConductor = viaje.comisionistaId && viaje.comisionistaId.toString() === usuarioId.toString()
  if (!esPasajero && !esConductor) throw new Error('No autorizado')
  if (['finalizado', 'cancelado'].includes(viaje.estado)) {
    throw new Error('Este viaje ya no se puede cancelar')
  }

  const actualizado = await ViajeRemis.findOneAndUpdate(
    { _id: viajeRemisId, estado: { $nin: ['finalizado', 'cancelado'] } },
    { $set: { estado: 'cancelado', canceladoPor: esPasajero ? 'pasajero' : 'comisionista' } },
    { new: true }
  )
  if (!actualizado) throw new Error('El viaje ya fue procesado')

  // Avisar a la otra parte (si ya había conductor asignado).
  const otra = esPasajero ? viaje.comisionistaId : viaje.pasajeroId
  if (otra) {
    emitNotificacion(otra.toString(), {
      tipo: 'remis',
      titulo: 'Remis cancelado',
      mensaje: `El ${esPasajero ? 'pasajero' : 'conductor'} canceló el viaje.`,
      enlace: '/remis/mis-viajes'
    })
  }
  return actualizado
}

// ===== Listados =====

export async function misViajesPasajero(pasajeroId) {
  const viajes = await ViajeRemis.find({ pasajeroId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('comisionistaId', 'nombre avatar')
  return viajes.map(v => v.toPublic())
}

export async function misViajesConductor(comisionistaId) {
  const viajes = await ViajeRemis.find({ comisionistaId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('pasajeroId', 'nombre avatar')
  return viajes.map(v => v.toPublic())
}

export async function obtenerViajeRemis(usuarioId, viajeRemisId) {
  const viaje = await ViajeRemis.findById(viajeRemisId)
    .populate('comisionistaId', 'nombre avatar')
    .populate('pasajeroId', 'nombre avatar')
  if (!viaje) throw new Error('Viaje no encontrado')
  const partes = [viaje.pasajeroId?._id?.toString(), viaje.comisionistaId?._id?.toString()]
  if (!partes.includes(usuarioId.toString())) throw new Error('No autorizado')
  return viaje.toPublic()
}

// ===== Pago (split al conductor) =====

/**
 * El pasajero paga el viaje finalizado con split al conductor. Reutiliza el
 * patrón de mercadoPagoService. Devuelve el initPoint de MP.
 */
export async function pagarRemis(pasajeroId, viajeRemisId, pasajeroEmail) {
  const { crearPreferenciaRemis } = await import('./mercadoPagoService.js')

  const viaje = await ViajeRemis.findById(viajeRemisId)
  if (!viaje) throw new Error('Viaje no encontrado')
  if (viaje.pasajeroId.toString() !== pasajeroId.toString()) throw new Error('No autorizado')
  if (viaje.estado !== 'finalizado') throw new Error('Solo podés pagar viajes finalizados')
  if (viaje.pago?.estadoPago === 'pagado') throw new Error('Este viaje ya fue pagado')

  const monto = viaje.precioFinal != null ? viaje.precioFinal : viaje.precioEstimado
  if (!monto || monto <= 0) throw new Error('El viaje no tiene un precio válido')

  const perfil = await PerfilComisionista.findOne({ usuarioId: viaje.comisionistaId })
  if (!perfil || !perfil.mpVinculado) {
    throw new Error('El conductor todavía no vinculó su Mercado Pago. Pedile que lo vincule para poder pagar online.')
  }

  const { preferenceId, initPoint, marketplaceFee } = await crearPreferenciaRemis({
    viaje, perfilComisionista: perfil, pasajeroEmail, monto
  })

  viaje.pago = {
    ...viaje.pago,
    mpPreferenceId: preferenceId,
    comisionPlataforma: marketplaceFee,
    estadoPago: 'pendiente_pago'
  }
  await viaje.save()

  return { initPoint, preferenceId }
}

/** Verifica el pago consultando a MP (fallback al volver del checkout). */
export async function verificarPagoRemis(pasajeroId, viajeRemisId) {
  const viaje = await ViajeRemis.findById(viajeRemisId)
  if (!viaje) throw new Error('Viaje no encontrado')
  if (viaje.pasajeroId.toString() !== pasajeroId.toString()) throw new Error('No autorizado')
  if (viaje.pago?.estadoPago === 'pagado') return viaje.toPublic()

  try {
    const { MercadoPagoConfig, Payment } = await import('mercadopago')
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || '' })
    const search = await new Payment(client).search({
      options: { external_reference: `remis:${viajeRemisId}` }
    })
    const aprobado = (search?.results || []).find(p => p.status === 'approved')
    if (aprobado) {
      return (await marcarRemisPagado(viajeRemisId, aprobado.id))?.toPublic()
    }
  } catch (e) {
    console.warn('verificarPagoRemis: no se pudo consultar a MP:', e.message)
  }
  return viaje.toPublic()
}

/** Marca el viaje como pagado (lo invoca el webhook de MP). Idempotente. */
export async function marcarRemisPagado(viajeRemisId, mpPaymentId) {
  const viaje = await ViajeRemis.findById(viajeRemisId)
  if (!viaje) return null
  if (viaje.pago?.estadoPago === 'pagado') return viaje // idempotencia

  viaje.pago = { ...viaje.pago, mpPaymentId: mpPaymentId?.toString() || '', estadoPago: 'pagado' }
  await viaje.save()

  emitNotificacion(viaje.comisionistaId.toString(), {
    tipo: 'remis',
    titulo: 'Viaje pagado',
    mensaje: 'El pasajero pagó el viaje de remis.',
    enlace: '/remis/conductor'
  })
  return viaje
}

// ===== Reseña del conductor de remis =====

/**
 * El pasajero reseña al conductor tras finalizar el viaje. Reutiliza
 * ResenaComisionista (con viajeRemisId en vez de envioId) y recalcula el promedio.
 */
export async function reseñarRemis(pasajeroId, viajeRemisId, { calificacion, comentario = '' }) {
  const cal = Number(calificacion)
  if (!Number.isInteger(cal) || cal < 1 || cal > 5) {
    throw new Error('La calificación debe ser un número del 1 al 5')
  }

  const viaje = await ViajeRemis.findById(viajeRemisId)
  if (!viaje) throw new Error('Viaje no encontrado')
  if (viaje.pasajeroId.toString() !== pasajeroId.toString()) throw new Error('No autorizado')
  if (viaje.estado !== 'finalizado') throw new Error('Solo podés reseñar viajes finalizados')

  const yaResenado = await ResenaComisionista.findOne({ contratanteId: pasajeroId, viajeRemisId }).select('_id')
  if (yaResenado) throw new Error('Ya reseñaste este viaje')

  const resena = await new ResenaComisionista({
    contratanteId: pasajeroId,
    comisionistaId: viaje.comisionistaId,
    viajeRemisId,
    calificacion: cal,
    comentario: (comentario || '').slice(0, 1000)
  }).save()

  await recalcularCalificacion(viaje.comisionistaId)

  emitNotificacion(viaje.comisionistaId.toString(), {
    tipo: 'remis',
    titulo: 'Nueva reseña',
    mensaje: `Recibiste una reseña de ${cal}★ por un viaje de remis.`,
    enlace: '/remis/conductor'
  })

  return resena
}

async function recalcularCalificacion(comisionistaId) {
  const resenas = await ResenaComisionista.find({ comisionistaId }).select('calificacion')
  if (resenas.length === 0) {
    await PerfilComisionista.findOneAndUpdate({ usuarioId: comisionistaId }, { calificacion: 0 })
    return
  }
  const suma = resenas.reduce((acc, r) => acc + r.calificacion, 0)
  const promedio = Math.round((suma / resenas.length) * 10) / 10
  await PerfilComisionista.findOneAndUpdate({ usuarioId: comisionistaId }, { calificacion: promedio })
}

/** IDs de viajes de remis que el pasajero ya reseñó (para ocultar el botón). */
export async function viajesRemisReseñadosPor(pasajeroId) {
  const resenas = await ResenaComisionista.find({ contratanteId: pasajeroId, viajeRemisId: { $ne: null } }).select('viajeRemisId')
  return resenas.map(r => r.viajeRemisId.toString())
}
