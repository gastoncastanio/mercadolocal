import Disputa from '../models/Disputa.js'
import Orden from '../models/Orden.js'
import Tienda from '../models/Tienda.js'
import { emitNotificacion } from './socketService.js'

// Crear disputa
export async function crearDisputa(compradorId, { ordenId, motivo, descripcion }) {
  const orden = await Orden.findById(ordenId)
  if (!orden) throw new Error('Orden no encontrada')
  if (orden.compradorId.toString() !== compradorId.toString()) {
    throw new Error('Esta orden no te pertenece')
  }

  // Obtener vendedor desde la tienda del primer item
  const tienda = await Tienda.findById(orden.items[0].tiendaId)
  if (!tienda) throw new Error('Tienda no encontrada')

  const disputa = new Disputa({
    ordenId,
    compradorId,
    vendedorId: tienda.usuarioId,
    motivo,
    descripcion
  })

  await disputa.save()

  // Aviso CRÍTICO al vendedor: tiene que responder (en disputa, el silencio
  // suele resolverse a favor del comprador). Y confirmación al comprador.
  const ref = `#${ordenId.toString().slice(-8).toUpperCase()}`
  emitNotificacion(tienda.usuarioId.toString(), {
    tipo: 'disputa',
    titulo: 'Se abrió una disputa en tu venta',
    mensaje: `El comprador abrió una disputa por la orden ${ref} (motivo: ${motivo}). Respondé cuanto antes con tu evidencia.`,
    enlace: '/disputas'
  })
  emitNotificacion(compradorId.toString(), {
    tipo: 'disputa',
    titulo: 'Disputa iniciada',
    mensaje: `Registramos tu disputa por la orden ${ref}. Te avisamos cuando haya novedades.`,
    enlace: '/disputas'
  })

  return disputa
}

// Disputas del comprador
export async function disputasDelComprador(compradorId) {
  return await Disputa.find({ compradorId })
    .populate('ordenId')
    .populate('vendedorId', 'nombre email')
    .sort({ createdAt: -1 })
}

// Disputas del vendedor
export async function disputasDelVendedor(vendedorId) {
  return await Disputa.find({ vendedorId })
    .populate('ordenId')
    .populate('compradorId', 'nombre email')
    .sort({ createdAt: -1 })
}

// Resolver disputa (admin)
export async function resolverDisputa(disputaId, resolucion, estadoFinal) {
  const disputa = await Disputa.findById(disputaId)
  if (!disputa) throw new Error('Disputa no encontrada')

  const estadosValidos = ['resuelta_comprador', 'resuelta_vendedor', 'cerrada']
  if (!estadosValidos.includes(estadoFinal)) {
    throw new Error('Estado final no valido')
  }

  disputa.resolucion = resolucion
  disputa.estado = estadoFinal
  await disputa.save()

  // Avisar a ambas partes del resultado.
  const ref = `#${disputa.ordenId.toString().slice(-8).toUpperCase()}`
  const favorComprador = estadoFinal === 'resuelta_comprador'
  const detalle = estadoFinal === 'cerrada'
    ? 'La disputa se cerró sin cambios.'
    : favorComprador
      ? 'Se resolvió a favor del comprador.'
      : 'Se resolvió a favor del vendedor.'
  for (const uid of [disputa.compradorId, disputa.vendedorId]) {
    emitNotificacion(uid.toString(), {
      tipo: 'disputa',
      titulo: `Disputa resuelta (orden ${ref})`,
      mensaje: `${detalle}${resolucion ? ` ${resolucion}` : ''}`,
      enlace: '/disputas'
    })
  }

  return disputa
}

// Disputas pendientes (admin)
export async function disputasPendientes() {
  return await Disputa.find({ estado: { $in: ['abierta', 'en_revision'] } })
    .populate('ordenId')
    .populate('compradorId', 'nombre email')
    .populate('vendedorId', 'nombre email')
    .sort({ createdAt: -1 })
}
