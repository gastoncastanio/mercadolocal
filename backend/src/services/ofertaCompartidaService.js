import OfertaCompartida from '../models/OfertaCompartida.js'
import Producto from '../models/Producto.js'
import Tienda from '../models/Tienda.js'
import Notificacion from '../models/Notificacion.js'
import { emitNotificacion } from './socketService.js'

/**
 * Servicio de Ofertas Compartidas (descuentos coopérativos).
 *
 * Mecánica financiera:
 *   - El comprador paga `precioConDescuento`.
 *   - El vendedor recibe como si vendiera a (precioOriginal − aporteVendedor):
 *     la plataforma le "devuelve" su aporte reduciendo la comisión.
 *   - La plataforma absorbe `aportePlataforma` por unidad, descontándolo de
 *     `presupuestoPlataforma`. Con piso mínimo de comisión (Fase 0) nunca
 *     terminamos con margen negativo.
 */

// ===== Admin: crear propuesta =====
export async function proponerOferta(datos) {
  const { productoId, descuentoPorcentaje, aporteVendedorPct, presupuestoPlataforma, finEn, notaPlataforma } = datos

  const producto = await Producto.findById(productoId)
  if (!producto) throw new Error('Producto no encontrado')
  if (!producto.activo) throw new Error('El producto no está activo')

  const tienda = await Tienda.findById(producto.tiendaId).select('usuarioId nombre')
  if (!tienda) throw new Error('La tienda del producto no existe')

  // No permitir dos ofertas vivas (propuesta/activa) sobre el mismo producto.
  const existente = await OfertaCompartida.findOne({
    productoId,
    estado: { $in: ['propuesta', 'activa', 'pausada'] }
  })
  if (existente) throw new Error('Ya existe una oferta compartida en curso para este producto')

  const pct = Number(descuentoPorcentaje)
  if (!pct || pct < 1 || pct > 90) throw new Error('El descuento debe estar entre 1% y 90%')

  const fin = new Date(finEn)
  if (isNaN(fin.getTime()) || fin <= new Date()) throw new Error('La fecha de fin debe ser futura')

  const oferta = await OfertaCompartida.create({
    productoId,
    tiendaId: producto.tiendaId,
    vendedorId: tienda.usuarioId,
    precioOriginal: producto.precio,
    descuentoPorcentaje: pct,
    aporteVendedorPct: aporteVendedorPct != null ? Number(aporteVendedorPct) : 50,
    presupuestoPlataforma: Number(presupuestoPlataforma) || 0,
    finEn: fin,
    notaPlataforma: (notaPlataforma || '').slice(0, 300),
    estado: 'propuesta'
  })

  // Avisar al vendedor que tiene una propuesta para revisar.
  try {
    await new Notificacion({
      usuarioId: tienda.usuarioId,
      tipo: 'sistema',
      titulo: '🤝 Propuesta de Oferta Compartida',
      mensaje: `Te proponemos un ${pct}% de descuento en "${producto.nombre}" co-financiado por la plataforma. Revisalo en tu panel.`,
      enlace: '/mi-tienda/ofertas-compartidas'
    }).save()
    emitNotificacion(tienda.usuarioId.toString(), { tipo: 'oferta_compartida_propuesta', ofertaId: oferta._id })
  } catch (e) {
    console.error('Error notificando propuesta de oferta compartida:', e.message)
  }

  return oferta.toPublic()
}

// ===== Vendedor: aceptar propuesta (aplica el precio con descuento) =====
export async function aceptarOferta(vendedorId, ofertaId) {
  // Transición atómica propuesta → activa (previene doble click / carrera).
  const oferta = await OfertaCompartida.findOneAndUpdate(
    { _id: ofertaId, vendedorId, estado: 'propuesta' },
    { $set: { estado: 'activa', inicioEn: new Date() } },
    { new: true }
  )
  if (!oferta) throw new Error('La propuesta no existe o ya no está disponible')

  // Aplicar el precio con descuento al producto (visible en toda la app vía
  // el sistema de precio tachado existente).
  const precioConDescuento = oferta.precioConDescuento()
  await Producto.findByIdAndUpdate(oferta.productoId, {
    $set: { precio: precioConDescuento, precioAnterior: oferta.precioOriginal }
  })

  return oferta.toPublic()
}

// ===== Vendedor: rechazar propuesta =====
export async function rechazarOferta(vendedorId, ofertaId) {
  const oferta = await OfertaCompartida.findOneAndUpdate(
    { _id: ofertaId, vendedorId, estado: 'propuesta' },
    { $set: { estado: 'rechazada' } },
    { new: true }
  )
  if (!oferta) throw new Error('La propuesta no existe o ya no está disponible')
  return oferta.toPublic()
}

// ===== Finalizar oferta y revertir el precio del producto =====
export async function finalizarOferta(ofertaId, motivo = 'finalizada') {
  const oferta = await OfertaCompartida.findById(ofertaId)
  if (!oferta) return null
  if (['finalizada', 'rechazada'].includes(oferta.estado)) return oferta.toPublic()

  oferta.estado = 'finalizada'
  await oferta.save()

  // Revertir el precio del producto al original (solo si sigue con el precio
  // de la oferta, para no pisar un cambio manual del vendedor).
  const producto = await Producto.findById(oferta.productoId)
  if (producto && producto.precio === oferta.precioConDescuento()) {
    producto.precio = oferta.precioOriginal
    producto.precioAnterior = null
    await producto.save()
  }

  try {
    await new Notificacion({
      usuarioId: oferta.vendedorId,
      tipo: 'sistema',
      titulo: 'Oferta Compartida finalizada',
      mensaje: motivo === 'presupuesto_agotado'
        ? 'Se agotó el presupuesto co-financiado. El precio volvió al original.'
        : 'Tu oferta compartida terminó. El precio volvió al original.',
      enlace: '/mi-tienda/ofertas-compartidas'
    }).save()
  } catch { /* no bloquea */ }

  return oferta.toPublic()
}

// ===== Cálculo del aporte de la plataforma para una orden =====
// Devuelve el total en ARS que la plataforma absorbe por las ofertas activas
// presentes en los items de la orden. Lo usa crearPreferencia (para reducir el
// marketplace_fee) y el webhook (para registrar el gasto).
export async function calcularAportePlataformaOrden(orden) {
  const ahora = new Date()
  let aporteTotal = 0
  const detalle = [] // { ofertaId, unidades, aporteUnidad }

  for (const item of orden.items) {
    const oferta = await OfertaCompartida.findOne({
      productoId: item.productoId,
      estado: 'activa'
    })
    if (!oferta || !oferta.estaVigente(ahora)) continue

    const aporteUnidad = oferta.aportePlataforma()
    // Limitar al presupuesto restante (no gastar de más).
    const maxUnidadesCubiertas = aporteUnidad > 0
      ? Math.floor(oferta.presupuestoRestante() / aporteUnidad)
      : item.cantidad
    const unidades = Math.min(item.cantidad, maxUnidadesCubiertas)
    if (unidades <= 0) continue

    const aporteItem = aporteUnidad * unidades
    aporteTotal += aporteItem
    detalle.push({ ofertaId: oferta._id, unidades, aporteUnidad, aporteItem })
  }

  return { aporteTotal, detalle }
}

// ===== Registrar consumo de presupuesto cuando una orden se paga =====
// Idempotencia: se llama desde el webhook tras confirmar el pago. Descuenta el
// presupuesto y finaliza la oferta si se agotó.
export async function registrarVentaConOferta(orden) {
  const { detalle } = await calcularAportePlataformaOrden(orden)
  for (const d of detalle) {
    const oferta = await OfertaCompartida.findByIdAndUpdate(
      d.ofertaId,
      { $inc: { gastado: d.aporteItem, ventasGeneradas: d.unidades } },
      { new: true }
    )
    if (oferta && oferta.presupuestoRestante() < oferta.aportePlataforma()) {
      await finalizarOferta(oferta._id, 'presupuesto_agotado')
    }
  }
}

// ===== Consultas =====

// Vendedor: sus propuestas/ofertas (todas o por estado).
export async function ofertasDelVendedor(vendedorId) {
  const lista = await OfertaCompartida.find({ vendedorId })
    .populate('productoId', 'nombre imagenes precio')
    .sort({ createdAt: -1 })
  return lista.map(o => ({ ...o.toPublic(), producto: o.productoId }))
}

// Admin: listar todas (con filtro opcional de estado).
export async function listarOfertas(estado) {
  const filtro = estado ? { estado } : {}
  const lista = await OfertaCompartida.find(filtro)
    .populate('productoId', 'nombre imagenes precio')
    .populate('tiendaId', 'nombre')
    .sort({ createdAt: -1 })
  return lista.map(o => ({ ...o.toPublic(), producto: o.productoId, tienda: o.tiendaId }))
}

// Barrido de ofertas vencidas (para cron / llamada perezosa).
export async function finalizarVencidas() {
  const vencidas = await OfertaCompartida.find({
    estado: 'activa',
    finEn: { $lt: new Date() }
  }).select('_id')
  for (const o of vencidas) {
    await finalizarOferta(o._id, 'finalizada')
  }
  return vencidas.length
}
