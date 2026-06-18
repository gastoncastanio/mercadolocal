import Comprobante from '../models/Comprobante.js'
import Contador from '../models/Contador.js'
import ConfigSitio from '../models/ConfigSitio.js'
import Tienda from '../models/Tienda.js'
import Usuario from '../models/Usuario.js'
import { solicitarCAE } from './arcaService.js'

/**
 * SERVICIO DE FACTURACIÓN
 *
 * Centraliza la emisión de los comprobantes del marketplace. Hoy genera
 * comprobantes INTERNOS (Factura C de la plataforma, sin CAE todavía). El día
 * que se integre ARCA o un proveedor (TusFacturas/Facturante), sólo hay que
 * implementar `solicitarCAE()` y completar `cae`/`caeVencimiento`/`pdfUrl`:
 * el resto del flujo (numeración, datos, panel, disparadores) ya queda armado.
 *
 * Todas las emisiones son IDEMPOTENTES vía `claveIdempotencia`: si el comprobante
 * ya existe se devuelve el existente, nunca se duplica (clave para webhooks).
 */

const CONFIG_CLAVE_FISCAL = 'datos_fiscales_plataforma'
const PUNTO_VENTA = 1

// Datos fiscales por defecto de la plataforma (Monotributo → Factura C).
// El admin los edita desde el panel; acá van placeholders hasta que se carguen
// los reales (CUIT, domicilio, etc.).
const DATOS_FISCALES_DEFAULT = {
  nombre: 'Mercado Local',
  cuit: '',
  docTipo: 'CUIT',
  condicionIVA: 'Monotributo',
  domicilio: '',
  ingresosBrutos: '',
  inicioActividades: '',
  email: ''
}

/**
 * Datos fiscales de la plataforma (emisor de las facturas de pauta y comisión).
 * Lee overrides del admin desde ConfigSitio; nunca falla.
 */
export async function obtenerDatosFiscalesPlataforma() {
  const datos = { ...DATOS_FISCALES_DEFAULT }
  try {
    const cfg = await ConfigSitio.findOne({ clave: CONFIG_CLAVE_FISCAL }).lean()
    if (cfg && cfg.valor) Object.assign(datos, JSON.parse(cfg.valor))
  } catch (e) {
    console.warn('No se pudieron leer los datos fiscales de la plataforma:', e.message)
  }
  return datos
}

/**
 * Guarda (admin) los datos fiscales de la plataforma.
 */
export async function guardarDatosFiscalesPlataforma(datos = {}) {
  const limpio = { ...DATOS_FISCALES_DEFAULT }
  for (const k of Object.keys(DATOS_FISCALES_DEFAULT)) {
    if (datos[k] !== undefined) limpio[k] = String(datos[k]).slice(0, 200)
  }
  await ConfigSitio.findOneAndUpdate(
    { clave: CONFIG_CLAVE_FISCAL },
    {
      clave: CONFIG_CLAVE_FISCAL,
      valor: JSON.stringify(limpio),
      tipo: 'html',
      categoria: 'facturacion',
      descripcion: 'Datos fiscales de la plataforma (emisor de facturas de pauta y comisión)'
    },
    { upsert: true, new: true }
  )
  return limpio
}

/**
 * Numeración correlativa por letra y punto de venta. Atómica (sin huecos).
 * Devuelve { numero, numeroFormateado }.
 */
async function numerar(letra) {
  const numero = await Contador.siguiente(`comprobante:${letra}:${PUNTO_VENTA}`)
  const numeroFormateado = `${letra} ${String(PUNTO_VENTA).padStart(4, '0')}-${String(numero).padStart(8, '0')}`
  return { numero, numeroFormateado }
}

/**
 * Datos fiscales del vendedor como RECEPTOR (de las facturas que le emitimos).
 * Toma lo que haya cargado en su tienda; si falta el CUIT queda en blanco
 * (se completa cuando el vendedor cargue sus datos fiscales).
 */
function receptorDesdeTienda(tienda, usuario) {
  const df = tienda?.datosFiscales || {}
  return {
    nombre: df.razonSocial || tienda?.nombre || usuario?.nombre || '',
    cuit: df.cuit || '',
    docTipo: df.cuit ? 'CUIT' : 'DNI',
    condicionIVA: df.condicionIVA || '',
    domicilio: [tienda?.ciudad].filter(Boolean).join(', '),
    email: usuario?.email || ''
  }
}

/**
 * Crea el comprobante de forma idempotente. Si ya existe (misma clave), lo
 * devuelve sin duplicar. Acá es donde, a futuro, se llamará a ARCA para el CAE.
 */
async function emitir({ tipo, claveIdempotencia, letra, emisor, receptor, items, total, refs }) {
  // Idempotencia: si ya existe, devolverlo
  const existente = await Comprobante.findOne({ claveIdempotencia }).lean()
  if (existente) return existente

  const { numero, numeroFormateado } = await numerar(letra)

  // ===== Punto de conexión fiscal (ARCA / proveedor) =====
  // Hoy `solicitarCAE` devuelve { autorizado:false } → comprobante interno.
  // Cuando se conecte (FACTURACION_FISCAL=on + adaptador implementado), el
  // mismo flujo pasa a emitir comprobantes fiscales con CAE, sin tocar nada acá.
  let fiscalData = { autorizado: false }
  try {
    fiscalData = await solicitarCAE({ tipo, letra, puntoVenta: PUNTO_VENTA, numero, emisor, receptor, items, total })
  } catch (e) {
    console.warn('Solicitud de CAE falló, se emite como interno:', e.message)
  }
  const autorizado = !!fiscalData.autorizado

  try {
    const comprobante = await new Comprobante({
      tipo,
      claveIdempotencia,
      letra,
      puntoVenta: PUNTO_VENTA,
      numero,
      numeroFormateado,
      emisor,
      receptor,
      items,
      neto: total,   // Factura C: neto = total (IVA no se discrimina)
      iva: 0,
      total,
      ...refs,
      origen: autorizado ? 'arca' : 'interno',
      fiscal: autorizado,                       // true sólo si ARCA autorizó (CAE)
      cae: autorizado ? (fiscalData.cae || '') : '',
      caeVencimiento: autorizado ? (fiscalData.caeVencimiento || null) : null,
      pdfUrl: autorizado ? (fiscalData.pdfUrl || '') : '',
      estado: 'emitido',
      fechaEmision: new Date()
    }).save()
    return comprobante.toObject()
  } catch (err) {
    // Si dos procesos corrieron en paralelo, el índice único de claveIdempotencia
    // hace fallar al segundo: devolvemos el que sí se guardó.
    if (err.code === 11000) {
      return await Comprobante.findOne({ claveIdempotencia }).lean()
    }
    throw err
  }
}

/**
 * Factura C de PAUTA: la plataforma le factura al vendedor el plan publicitario.
 * Se dispara cuando la pauta queda activa (pago con saldo o MP aprobado).
 */
export async function emitirComprobantePauta(destacado) {
  try {
    if (!destacado || !destacado._id) return null
    const tienda = await Tienda.findById(destacado.tiendaId).lean()
    const usuario = tienda ? await Usuario.findById(tienda.usuarioId).lean() : null
    const emisor = await obtenerDatosFiscalesPlataforma()

    const total = destacado.precioTotal
    const items = [{
      descripcion: `Pauta publicitaria — Plan ${destacado.plan} (${destacado.duracionDias} días)`,
      cantidad: 1,
      precioUnitario: total,
      importe: total
    }]

    return await emitir({
      tipo: 'pauta',
      claveIdempotencia: `pauta:${destacado._id}`,
      letra: 'C',
      emisor,
      receptor: receptorDesdeTienda(tienda, usuario),
      items,
      total,
      refs: {
        destacadoId: destacado._id,
        tiendaId: destacado.tiendaId,
        vendedorId: destacado.vendedorId || tienda?.usuarioId || null
      }
    })
  } catch (err) {
    console.error('Error emitiendo comprobante de pauta:', err.message)
    return null
  }
}

/**
 * Factura C de COMISIÓN: la plataforma le factura al vendedor la comisión por la
 * venta. Una por (orden, tienda), porque una orden puede tener varias tiendas.
 * Se dispara cuando la orden queda pagada.
 */
export async function emitirComprobanteComision(orden, tiendaId) {
  try {
    if (!orden || !orden._id) return null
    const tienda = await Tienda.findById(tiendaId).lean()
    const usuario = tienda ? await Usuario.findById(tienda.usuarioId).lean() : null
    const emisor = await obtenerDatosFiscalesPlataforma()

    // Comisión correspondiente a los items de ESTA tienda en la orden
    const itemsTienda = (orden.items || []).filter(i => i.tiendaId?.toString() === tiendaId.toString())
    const subtotalTienda = itemsTienda.reduce((s, i) => s + i.subtotal, 0)
    const pct = orden.porcentajeComision || 10
    const comision = Math.round(subtotalTienda * pct / 100 * 100) / 100
    if (comision <= 0) return null

    const items = [{
      descripcion: `Comisión por venta (${pct}%) — Orden #${orden._id.toString().slice(-8)}`,
      cantidad: 1,
      precioUnitario: comision,
      importe: comision
    }]

    return await emitir({
      tipo: 'comision',
      claveIdempotencia: `comision:${orden._id}:${tiendaId}`,
      letra: 'C',
      emisor,
      receptor: receptorDesdeTienda(tienda, usuario),
      items,
      total: comision,
      refs: {
        ordenId: orden._id,
        tiendaId,
        vendedorId: tienda?.usuarioId || null
      }
    })
  } catch (err) {
    console.error('Error emitiendo comprobante de comisión:', err.message)
    return null
  }
}

/**
 * Letra de comprobante que emite el VENDEDOR según su condición fiscal.
 * Responsable Inscripto → B (venta a consumidor final). Monotributo/Exento → C.
 */
function letraSegunCondicion(condicionIVA) {
  return condicionIVA === 'Responsable Inscripto' ? 'B' : 'C'
}

/**
 * Factura de VENTA: el vendedor le factura a su comprador el producto.
 * La letra depende de la condición fiscal del vendedor. Una por (orden, tienda).
 *
 * @param {Object} orden
 * @param {string} tiendaId
 * @param {Object} [opts] - { pdfUrl } si el vendedor sube su propia factura.
 */
export async function emitirFacturaVenta(orden, tiendaId, opts = {}) {
  if (!orden || !orden._id) throw new Error('Orden inválida')
  const tienda = await Tienda.findById(tiendaId).lean()
  if (!tienda) throw new Error('Tienda no encontrada')
  const usuarioVendedor = await Usuario.findById(tienda.usuarioId).lean()
  const comprador = await Usuario.findById(orden.compradorId).lean()

  const df = tienda.datosFiscales || {}
  const letra = letraSegunCondicion(df.condicionIVA)

  const itemsTienda = (orden.items || []).filter(i => i.tiendaId?.toString() === tiendaId.toString())
  const total = itemsTienda.reduce((s, i) => s + i.subtotal, 0)
  const items = itemsTienda.map(i => ({
    descripcion: i.nombre,
    cantidad: i.cantidad,
    precioUnitario: i.precioUnitario,
    importe: i.subtotal
  }))

  const emisor = {
    nombre: df.razonSocial || tienda.nombre || usuarioVendedor?.nombre || '',
    cuit: df.cuit || '',
    docTipo: df.cuit ? 'CUIT' : 'DNI',
    condicionIVA: df.condicionIVA || '',
    domicilio: df.domicilio || tienda.ciudad || '',
    email: usuarioVendedor?.email || ''
  }
  const receptor = {
    nombre: orden.nombreComprador || comprador?.nombre || 'Consumidor Final',
    cuit: '',
    docTipo: 'CF',
    condicionIVA: 'Consumidor Final',
    domicilio: orden.direccionEntrega || '',
    email: comprador?.email || ''
  }

  const comp = await emitir({
    tipo: 'venta',
    claveIdempotencia: `venta:${orden._id}:${tiendaId}`,
    letra,
    emisor,
    receptor,
    items,
    total,
    refs: {
      ordenId: orden._id,
      tiendaId,
      vendedorId: tienda.usuarioId,
      compradorId: orden.compradorId
    }
  })

  // Si el vendedor subió su propio PDF, lo asociamos.
  if (opts.pdfUrl && comp && !comp.pdfUrl) {
    await Comprobante.updateOne(
      { _id: comp._id },
      { $set: { pdfUrl: opts.pdfUrl, origen: 'manual' } }
    )
    comp.pdfUrl = opts.pdfUrl
    comp.origen = 'manual'
  }
  return comp
}

/**
 * Comprobantes que la plataforma le emitió a un vendedor (pauta + comisión).
 */
export async function comprobantesDelVendedor(vendedorId) {
  return await Comprobante.find({
    vendedorId,
    tipo: { $in: ['pauta', 'comision'] }
  }).sort({ fechaEmision: -1 }).lean()
}

/**
 * Factura de venta asociada a una orden (la que el vendedor le hace al comprador).
 */
export async function facturaDeVenta(ordenId) {
  return await Comprobante.findOne({ ordenId, tipo: 'venta' }).lean()
}
