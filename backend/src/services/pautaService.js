import Destacado from '../models/Destacado.js'
import Producto from '../models/Producto.js'
import Tienda from '../models/Tienda.js'
import ConfigSitio from '../models/ConfigSitio.js'
import { notificarClientesIdeales } from './targetingService.js'

/**
 * Servicio central de PAUTA PUBLICITARIA.
 *
 * El vendedor "destaca" un producto pagando un plan. Hay dos métodos de pago:
 *   - 'mercadopago': dinero real a la cuenta de la plataforma (ingreso fresco).
 *   - 'saldo': se descuenta de las ganancias acumuladas por sus ventas.
 *
 * Los precios de los planes son editables desde el panel de admin (se guardan
 * en ConfigSitio). El código define la ESTRUCTURA (qué incluye cada plan) y el
 * admin define los PRECIOS, sin tocar código ni redeploy.
 */

// Estructura base de los planes. Los precios acá son los valores por defecto;
// el admin puede sobrescribirlos desde el panel (se guardan en ConfigSitio).
const PLANES_DEFAULT = {
  basico: {
    nombre: 'Básico',
    ubicacion: ['catalogo', 'busqueda'],
    precios: { 3: 1500, 7: 3000, 15: 5500, 30: 9000 },
    descripcion: 'Tu producto aparece primero en el catálogo y búsquedas',
    permiteSegmentar: false
  },
  premium: {
    nombre: 'Premium',
    ubicacion: ['catalogo', 'busqueda', 'publicidad'],
    precios: { 3: 3000, 7: 6000, 15: 10000, 30: 17000 },
    descripcion: 'Catálogo + búsquedas + espacios publicitarios en la página principal',
    permiteSegmentar: true
  },
  elite: {
    nombre: 'Elite',
    ubicacion: ['catalogo', 'busqueda', 'publicidad', 'banner', 'home'],
    precios: { 3: 5000, 7: 9000, 15: 16000, 30: 28000 },
    descripcion: 'Máxima visibilidad: banner principal + destacado en la home + publicidad + catálogo + búsquedas',
    permiteSegmentar: true
  }
}

const CONFIG_CLAVE_PRECIOS = 'pauta_precios'

/**
 * Devuelve los planes con los precios efectivos (defaults + overrides del admin).
 * Nunca falla: si la config no existe o está corrupta, usa los defaults.
 */
export async function obtenerPlanes() {
  // Clonado profundo de los defaults para no mutar la constante
  const planes = JSON.parse(JSON.stringify(PLANES_DEFAULT))
  try {
    const cfg = await ConfigSitio.findOne({ clave: CONFIG_CLAVE_PRECIOS }).lean()
    if (cfg && cfg.valor) {
      const overrides = JSON.parse(cfg.valor)
      for (const key of Object.keys(planes)) {
        if (overrides[key] && typeof overrides[key] === 'object') {
          // Solo sobreescribimos precios de duraciones ya válidas para el plan
          for (const dias of Object.keys(planes[key].precios)) {
            const v = Number(overrides[key][dias])
            if (Number.isFinite(v) && v > 0) {
              planes[key].precios[dias] = Math.round(v)
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('No se pudo leer config de precios de pauta, usando defaults:', e.message)
  }
  return planes
}

/**
 * Guarda los precios editados por el admin. Recibe un objeto:
 *   { basico: {3,7,15,30}, premium: {...}, elite: {...} }
 * Valida que sean números positivos. Devuelve los planes resultantes.
 */
export async function guardarPrecios(nuevosPrecios) {
  const limpio = {}
  for (const key of Object.keys(PLANES_DEFAULT)) {
    const entrada = nuevosPrecios?.[key]
    if (!entrada) continue
    limpio[key] = {}
    for (const dias of Object.keys(PLANES_DEFAULT[key].precios)) {
      const v = Number(entrada[dias])
      if (Number.isFinite(v) && v > 0) {
        limpio[key][dias] = Math.round(v)
      }
    }
  }
  await ConfigSitio.findOneAndUpdate(
    { clave: CONFIG_CLAVE_PRECIOS },
    {
      clave: CONFIG_CLAVE_PRECIOS,
      valor: JSON.stringify(limpio),
      tipo: 'html',
      categoria: 'pauta',
      descripcion: 'Precios de los planes de pauta publicitaria (editable desde el panel)'
    },
    { upsert: true, new: true }
  )
  return obtenerPlanes()
}

/**
 * Valida la solicitud de pauta y devuelve los datos calculados (plan, precio,
 * fechaFin, ubicaciones). NO crea nada todavía. Lanza Error con .code en fallos.
 */
export async function prepararPauta({ usuarioId, productoId, plan, duracionDias, segmentoCiudad, segmentoCategoria }) {
  const planes = await obtenerPlanes()
  const planInfo = planes[plan]
  if (!planInfo) {
    const e = new Error('Plan no válido'); e.code = 'PLAN_INVALIDO'; throw e
  }

  const dias = Number(duracionDias)
  if (!planInfo.precios[dias]) {
    const e = new Error('Duración no disponible para este plan'); e.code = 'DURACION_INVALIDA'; throw e
  }

  const tienda = await Tienda.findOne({ usuarioId })
  if (!tienda) {
    const e = new Error('Tienda no encontrada'); e.code = 'SIN_TIENDA'; throw e
  }

  const producto = await Producto.findOne({ _id: productoId, tiendaId: tienda._id, activo: true })
  if (!producto) {
    const e = new Error('Producto no encontrado o no te pertenece'); e.code = 'PRODUCTO_INVALIDO'; throw e
  }

  // Una sola promoción activa o pendiente de pago por producto
  const promoExistente = await Destacado.findOne({
    productoId,
    estado: { $in: ['activo', 'pendiente'] },
    fechaFin: { $gt: new Date() }
  })
  if (promoExistente) {
    const e = new Error('Este producto ya tiene una promoción activa o pendiente de pago')
    e.code = 'YA_PROMOCIONADO'
    throw e
  }

  const precioTotal = planInfo.precios[dias]
  const fechaFin = new Date()
  fechaFin.setDate(fechaFin.getDate() + dias)

  // La segmentación solo se respeta si el plan la permite
  const segCiudad = planInfo.permiteSegmentar ? String(segmentoCiudad || '').trim() : ''
  const segCategoria = planInfo.permiteSegmentar ? String(segmentoCategoria || '').trim() : ''

  return { tienda, producto, planInfo, dias, precioTotal, fechaFin, segCiudad, segCategoria }
}

/**
 * Crea una pauta pendiente de pago con Mercado Pago.
 * Devuelve { destacado, initPoint } — el front redirige a initPoint.
 */
export async function crearPautaMercadoPago(args) {
  const { usuarioId, productoId, plan } = args
  const { tienda, producto, planInfo, dias, precioTotal, fechaFin, segCiudad, segCategoria } =
    await prepararPauta(args)

  const destacado = await new Destacado({
    productoId,
    tiendaId: tienda._id,
    vendedorId: usuarioId,
    plan,
    ubicacion: planInfo.ubicacion,
    segmentoCiudad: segCiudad,
    segmentoCategoria: segCategoria,
    duracionDias: dias,
    precioTotal,
    metodoPago: 'mercadopago',
    fechaFin,                 // provisional: se recalcula al aprobarse el pago
    estado: 'pendiente',
    activo: false
  }).save()

  // Import dinámico para evitar ciclo de dependencias con mercadoPagoService
  const { crearPreferenciaPauta } = await import('./mercadoPagoService.js')
  let preferencia
  try {
    preferencia = await crearPreferenciaPauta({ destacado, producto, planInfo })
  } catch (err) {
    // Si MP rechaza, no dejamos basura: borramos la pauta pendiente
    await Destacado.findByIdAndDelete(destacado._id).catch(() => {})
    throw err
  }

  destacado.mpPreferenceId = preferencia.preferenceId
  await destacado.save()

  return { destacado, initPoint: preferencia.initPoint }
}

/**
 * Crea una pauta pagando con el SALDO acumulado (ganancias). Activa al instante.
 */
export async function crearPautaSaldo(args) {
  const { usuarioId, productoId, plan } = args
  const { tienda, producto, planInfo, dias, precioTotal, fechaFin, segCiudad, segCategoria } =
    await prepararPauta(args)

  if ((tienda.ganancias || 0) < precioTotal) {
    const e = new Error(
      `Saldo insuficiente. Tenés $${(tienda.ganancias || 0).toLocaleString('es-AR')} y el plan cuesta $${precioTotal.toLocaleString('es-AR')}. Podés pagarlo con Mercado Pago.`
    )
    e.code = 'SALDO_INSUFICIENTE'
    throw e
  }

  const destacado = await new Destacado({
    productoId,
    tiendaId: tienda._id,
    vendedorId: usuarioId,
    plan,
    ubicacion: planInfo.ubicacion,
    segmentoCiudad: segCiudad,
    segmentoCategoria: segCategoria,
    duracionDias: dias,
    precioTotal,
    metodoPago: 'saldo',
    fechaFin,
    estado: 'activo',
    activo: true
  }).save()

  try {
    await Tienda.findByIdAndUpdate(tienda._id, { $inc: { ganancias: -precioTotal } })
  } catch (errDescuento) {
    await Destacado.findByIdAndDelete(destacado._id).catch(() => {})
    const e = new Error('No se pudo procesar la promoción. Intentá de nuevo.')
    e.code = 'ERROR_DESCUENTO'
    throw e
  }

  console.log(`⭐ Pauta (saldo): ${producto.nombre} - ${plan} (${dias}d) - $${precioTotal}`)
  // Pauta inteligente: avisar a los clientes ideales (async, no bloquea)
  notificarClientesIdeales(destacado, { motivo: 'nuevo' }).catch(() => {})
  return { destacado, producto, planInfo }
}

/**
 * Activa una pauta pendiente cuando Mercado Pago confirma el pago.
 * Es IDEMPOTENTE: si ya fue activada con ese paymentId, no hace nada.
 * Recibe el objeto `pago` de la API de Mercado Pago.
 */
export async function activarPautaDesdePago(pago) {
  // external_reference viene como "pauta:<destacadoId>"
  const ref = String(pago.external_reference || '')
  const destacadoId = ref.startsWith('pauta:') ? ref.slice('pauta:'.length) : null
  if (!destacadoId) return { ok: false, motivo: 'ref_invalida' }

  const destacado = await Destacado.findById(destacadoId)
  if (!destacado) return { ok: false, motivo: 'no_encontrada' }

  // Idempotencia
  if (destacado.mpPaymentId && destacado.mpPaymentId === String(pago.id)) {
    return { ok: true, motivo: 'duplicado' }
  }

  if (pago.status === 'approved') {
    // Activación atómica: solo si sigue pendiente (evita doble webhook)
    const ahora = new Date()
    const fechaFin = new Date(ahora)
    fechaFin.setDate(fechaFin.getDate() + destacado.duracionDias)

    const actualizada = await Destacado.findOneAndUpdate(
      { _id: destacadoId, estado: 'pendiente' },
      {
        $set: {
          estado: 'activo',
          activo: true,
          mpPaymentId: String(pago.id),
          mpStatus: pago.status,
          fechaInicio: ahora,
          fechaFin
        }
      },
      { new: true }
    )
    if (!actualizada) return { ok: true, motivo: 'ya_procesada' }
    console.log(`💰 Pauta PAGADA con MP: destacado ${destacadoId} | $${actualizada.precioTotal}`)
    return { ok: true, motivo: 'activada', destacado: actualizada }
  }

  if (pago.status === 'rejected' || pago.status === 'cancelled') {
    await Destacado.findOneAndUpdate(
      { _id: destacadoId, estado: 'pendiente' },
      { $set: { estado: 'cancelado', activo: false, mpPaymentId: String(pago.id), mpStatus: pago.status } }
    )
    return { ok: true, motivo: 'rechazada' }
  }

  // pending / in_process: solo registramos el estado
  destacado.mpStatus = pago.status
  await destacado.save()
  return { ok: true, motivo: 'pendiente' }
}

/**
 * ¿Este pago corresponde a una pauta? (para que el webhook sepa rutearlo)
 */
export function esPagoDePauta(pago) {
  return String(pago?.external_reference || '').startsWith('pauta:')
}
