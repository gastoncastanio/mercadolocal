import Disputa from '../models/Disputa.js'
import Orden from '../models/Orden.js'
import Tienda from '../models/Tienda.js'

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
