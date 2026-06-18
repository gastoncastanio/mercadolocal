import PerfilInteres from '../models/PerfilInteres.js'
import Producto from '../models/Producto.js'
import Destacado from '../models/Destacado.js'
import Notificacion from '../models/Notificacion.js'
import Tienda from '../models/Tienda.js'
import { emitNotificacion } from './socketService.js'
import { enviarPush } from './pushService.js'

/**
 * targetingService — el cerebro de la PAUTA INTELIGENTE.
 *
 * 1) Registra señales de interés (vistas, búsquedas, favoritos, compras) y arma
 *    un perfil por cliente (logueado o anónimo).
 * 2) Calcula la relevancia de un producto para un perfil, para ordenar la pauta
 *    por afinidad (no solo por plan).
 * 3) Detecta "clientes ideales" para un producto recién promocionado y les avisa
 *    por notificación + push, con un timer de enfriamiento para no molestar.
 *
 * Privacidad: solo categorías, ciudades y rangos de precio. Nada personal.
 */

// ---- Parámetros del algoritmo (ajustables) ----
const MAX_VISTAS = 50            // historial de vistas que guardamos por cliente
const MAX_BUSQUEDAS = 30
const MAX_CATEGORIAS = 25        // top categorías que mantenemos por perfil
const PESO_VISTA = 1
const PESO_BUSQUEDA = 1.5
const PESO_FAVORITO = 3
const PESO_COMPRA = 5
const DECAY = 0.985              // decaimiento suave por evento (lo viejo pesa menos)

// Notificaciones inteligentes
const COOLDOWN_NOTIF_MS = 8 * 60 * 60 * 1000  // no más de 1 cada 8 horas
const NAVEGANDO_MS = 5 * 60 * 1000            // si está navegando ahora, no lo molestamos
const UMBRAL_INTERES = PESO_FAVORITO          // interés mínimo en la categoría para considerarlo "ideal"
const MAX_DESTINATARIOS = 40                  // tope de avisos por campaña (anti-spam y carga)

// ---------------------------------------------------------------------------
// Identidad
// ---------------------------------------------------------------------------

/**
 * Resuelve la identidad del cliente a partir del request.
 * Logueado => { usuarioId }. Anónimo => { anonId } (header 'x-anon-id').
 * Devuelve {} si no hay forma de identificarlo (no se trackea).
 */
export function resolverIdentidad(req) {
  if (req.usuario && req.usuario.id) return { usuarioId: req.usuario.id }
  const anon = req.headers['x-anon-id']
  if (anon && typeof anon === 'string' && anon.length >= 8 && anon.length <= 64) {
    return { anonId: anon.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) }
  }
  return {}
}

function filtroIdentidad(identity) {
  if (identity.usuarioId) return { usuarioId: identity.usuarioId }
  if (identity.anonId) return { anonId: identity.anonId }
  return null
}

// ---------------------------------------------------------------------------
// Helpers de Map (categorias/ciudades)
// ---------------------------------------------------------------------------

function bump(perfil, campo, claveRaw, peso) {
  const clave = sanitizarClave(claveRaw)
  if (!clave) return
  const mapa = perfil[campo]
  // Decaimiento global suave para que lo reciente pese más
  for (const [k, v] of mapa) mapa.set(k, v * DECAY)
  mapa.set(clave, (mapa.get(clave) || 0) + peso)

  // Podar para no crecer infinito
  if (mapa.size > MAX_CATEGORIAS) {
    const ordenadas = [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_CATEGORIAS)
    perfil[campo] = new Map(ordenadas)
  }
}

// ---------------------------------------------------------------------------
// Registro de señales (todo fire-and-forget; nunca debe romper el flujo)
// ---------------------------------------------------------------------------

async function getOrCreate(identity) {
  const filtro = filtroIdentidad(identity)
  if (!filtro) return null
  let perfil = await PerfilInteres.findOne(filtro)
  if (!perfil) perfil = new PerfilInteres(filtro)
  return perfil
}

export async function registrarVista(identity, producto) {
  try {
    if (!producto) return
    const perfil = await getOrCreate(identity)
    if (!perfil) return

    const categoria = (producto.categorias && producto.categorias[0]) || ''
    bump(perfil, 'categorias', categoria, PESO_VISTA)
    if (producto.ciudad) bump(perfil, 'ciudades', producto.ciudad, PESO_VISTA)

    perfil.vistasRecientes.unshift({
      productoId: producto._id,
      categoria,
      precio: producto.precio,
      ts: new Date()
    })
    if (perfil.vistasRecientes.length > MAX_VISTAS) {
      perfil.vistasRecientes = perfil.vistasRecientes.slice(0, MAX_VISTAS)
    }

    if (producto.precio > 0) {
      perfil.precioSum += producto.precio
      perfil.precioCount += 1
    }
    perfil.totalVistas += 1
    perfil.ultimaActividad = new Date()
    await perfil.save()
  } catch (e) {
    console.warn('registrarVista falló:', e.message)
  }
}

export async function registrarBusqueda(identity, termino, categoria) {
  try {
    const perfil = await getOrCreate(identity)
    if (!perfil) return
    const t = String(termino || '').trim().slice(0, 80)
    if (categoria) bump(perfil, 'categorias', categoria, PESO_BUSQUEDA)
    if (t) {
      perfil.busquedasRecientes.unshift({ termino: t, categoria: categoria || '', ts: new Date() })
      if (perfil.busquedasRecientes.length > MAX_BUSQUEDAS) {
        perfil.busquedasRecientes = perfil.busquedasRecientes.slice(0, MAX_BUSQUEDAS)
      }
    }
    perfil.totalBusquedas += 1
    perfil.ultimaActividad = new Date()
    await perfil.save()
  } catch (e) {
    console.warn('registrarBusqueda falló:', e.message)
  }
}

export async function registrarFavorito(identity, producto) {
  try {
    if (!producto) return
    const perfil = await getOrCreate(identity)
    if (!perfil) return
    const categoria = (producto.categorias && producto.categorias[0]) || ''
    bump(perfil, 'categorias', categoria, PESO_FAVORITO)
    if (producto.ciudad) bump(perfil, 'ciudades', producto.ciudad, PESO_FAVORITO)
    perfil.totalFavoritos += 1
    perfil.ultimaActividad = new Date()
    await perfil.save()
  } catch (e) {
    console.warn('registrarFavorito falló:', e.message)
  }
}

export async function registrarCompra(usuarioId, items) {
  try {
    if (!usuarioId || !Array.isArray(items)) return
    const perfil = await getOrCreate({ usuarioId })
    if (!perfil) return
    for (const it of items) {
      // item de orden trae productoId; buscamos su categoría
      const prod = await Producto.findById(it.productoId).select('categorias ciudad precio').lean()
      if (!prod) continue
      const categoria = (prod.categorias && prod.categorias[0]) || ''
      bump(perfil, 'categorias', categoria, PESO_COMPRA)
      if (prod.ciudad) bump(perfil, 'ciudades', prod.ciudad, PESO_COMPRA)
    }
    perfil.totalCompras += 1
    perfil.ultimaActividad = new Date()
    await perfil.save()
  } catch (e) {
    console.warn('registrarCompra falló:', e.message)
  }
}

// ---------------------------------------------------------------------------
// Lectura del perfil + relevancia
// ---------------------------------------------------------------------------

export async function obtenerPerfil(identity) {
  const filtro = filtroIdentidad(identity)
  if (!filtro) return null
  return await PerfilInteres.findOne(filtro).lean()
}

/**
 * Relevancia de un producto para un perfil. Devuelve 0..~1.
 * Combina afinidad de categoría (lo más importante), ciudad, precio y la señal
 * de intención reciente (si miró esa categoría hace poco).
 */
export function scoreRelevancia(producto, perfil) {
  if (!perfil) return 0
  let score = 0

  // --- Categoría (peso 0.6) ---
  const cats = perfil.categorias || {}
  const valores = Object.values(cats)
  const maxCat = valores.length ? Math.max(...valores) : 0
  if (maxCat > 0 && Array.isArray(producto.categorias)) {
    let mejor = 0
    for (const c of producto.categorias) {
      const v = cats[c] || 0
      if (v > mejor) mejor = v
    }
    score += 0.6 * (mejor / maxCat)
  }

  // --- Ciudad (peso 0.2) ---
  const ciu = perfil.ciudades || {}
  const valoresCiu = Object.values(ciu)
  const maxCiu = valoresCiu.length ? Math.max(...valoresCiu) : 0
  if (maxCiu > 0 && producto.ciudad && ciu[producto.ciudad]) {
    score += 0.2 * (ciu[producto.ciudad] / maxCiu)
  }

  // --- Afinidad de precio (peso 0.1) ---
  if (perfil.precioCount > 0 && producto.precio > 0) {
    const prom = perfil.precioSum / perfil.precioCount
    if (prom > 0) {
      const ratio = producto.precio / prom
      // Más cerca del promedio que suele mirar => más afinidad
      const cercania = Math.max(0, 1 - Math.abs(Math.log(ratio)) / Math.log(4))
      score += 0.1 * cercania
    }
  }

  // --- Intención reciente (peso 0.1): miró esa categoría en sus últimas vistas ---
  if (Array.isArray(perfil.vistasRecientes) && Array.isArray(producto.categorias)) {
    const recientes = perfil.vistasRecientes.slice(0, 10)
    const matchReciente = recientes.some(v => producto.categorias.includes(v.categoria))
    if (matchReciente) score += 0.1
  }

  return Math.min(1, score)
}

/**
 * Ordena una lista de destacados (con productoId poblado) por relevancia para el
 * perfil, combinando con el peso del plan. El que paga aparece, pero priorizamos
 * mostrarlo a quien tiene más chance de comprarlo.
 *
 * Devuelve los destacados ordenados y marca `_scoreRelevancia` en cada uno.
 */
const PESO_PLAN = { elite: 1, premium: 0.6, basico: 0.3 }

export function ordenarDestacadosPorRelevancia(destacados, perfil) {
  const conScore = destacados.map(d => {
    const prod = d.productoId && typeof d.productoId === 'object' ? d.productoId : null
    const rel = prod ? scoreRelevancia(prod, perfil) : 0
    const plan = PESO_PLAN[d.plan] || 0.3
    // La relevancia manda (×6), el plan desempata y da un piso de visibilidad (×2)
    const final = rel * 6 + plan * 2
    return { d, rel, final }
  })
  conScore.sort((a, b) => b.final - a.final)
  return conScore.map(x => {
    if (x.d && typeof x.d === 'object') x.d._scoreRelevancia = Number(x.rel.toFixed(3))
    return x.d
  })
}

// ---------------------------------------------------------------------------
// Audiencia (métricas para el vendedor)
// ---------------------------------------------------------------------------

/**
 * Cuando alguien hace clic en un anuncio, sumamos su categoría/ciudad dominante
 * a la audiencia agregada del destacado (para que el vendedor vea a quién llega).
 */
export async function registrarAudienciaClick(destacadoId, identity) {
  try {
    const perfil = await obtenerPerfil(identity)
    if (!perfil) return
    const inc = {}
    const topCat = topClave(perfil.categorias)
    const topCiu = topClave(perfil.ciudades)
    if (topCat) inc[`audiencia.categorias.${sanitizarClave(topCat)}`] = 1
    if (topCiu) inc[`audiencia.ciudades.${sanitizarClave(topCiu)}`] = 1
    if (Object.keys(inc).length) {
      await Destacado.updateOne({ _id: destacadoId }, { $inc: inc })
    }
  } catch (e) {
    console.warn('registrarAudienciaClick falló:', e.message)
  }
}

function topClave(mapaObj) {
  if (!mapaObj) return null
  const entries = mapaObj instanceof Map ? [...mapaObj.entries()] : Object.entries(mapaObj)
  if (!entries.length) return null
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

// Las claves de Map no pueden tener puntos en Mongo
function sanitizarClave(k) {
  return String(k).replace(/\./g, '_').slice(0, 60)
}

// ---------------------------------------------------------------------------
// Notificaciones inteligentes
// ---------------------------------------------------------------------------

/**
 * Detecta clientes IDEALES para un producto recién promocionado y les avisa.
 * - Solo clientes logueados (los anónimos no tienen a quién notificar).
 * - Solo si su interés en la categoría supera el umbral (cliente ideal).
 * - Con timer de enfriamiento: no si recibió un aviso hace < COOLDOWN.
 * - No si está navegando ahora mismo (ya le servimos la pauta en pantalla).
 *
 * Es async y se llama SIN await (no debe frenar la activación de la pauta).
 *
 * @param {Object} destacado - destacado activo
 * @param {Object} opts - { motivo: 'nuevo'|'oferta', detalle?: string }
 */
export async function notificarClientesIdeales(destacado, opts = {}) {
  try {
    const producto = await Producto.findById(destacado.productoId)
      .select('nombre categorias ciudad precio precioAnterior imagenes tiendaId')
      .lean()
    if (!producto) return

    const categoria = (producto.categorias && producto.categorias[0]) || ''
    if (!categoria) return

    // Vendedor dueño (para no notificarse a sí mismo)
    let vendedorUsuarioId = null
    try {
      const tienda = await Tienda.findById(destacado.tiendaId).select('usuarioId').lean()
      vendedorUsuarioId = tienda?.usuarioId?.toString() || null
    } catch { /* noop */ }

    const ahora = Date.now()
    const campoCat = `categorias.${sanitizarClave(categoria)}`

    // Candidatos: perfiles logueados con interés alto en la categoría,
    // fuera de enfriamiento y que no estén navegando ahora.
    const candidatos = await PerfilInteres.find({
      usuarioId: { $ne: null },
      [campoCat]: { $gte: UMBRAL_INTERES },
      $or: [
        { ultimaNotifPublicidad: null },
        { ultimaNotifPublicidad: { $lt: new Date(ahora - COOLDOWN_NOTIF_MS) } }
      ],
      ultimaActividad: { $lt: new Date(ahora - NAVEGANDO_MS) }
    })
      .sort({ [campoCat]: -1 })
      .limit(MAX_DESTINATARIOS)

    const enOferta = producto.precioAnterior && producto.precioAnterior > producto.precio
    const titulo = enOferta ? '🔥 Bajó algo que estabas mirando' : '✨ Nuevo para vos en lo que te interesa'
    const off = enOferta ? Math.round((1 - producto.precio / producto.precioAnterior) * 100) : 0
    const mensaje = enOferta
      ? `${producto.nombre} ahora $${producto.precio.toLocaleString('es-AR')} (${off}% OFF). Stock limitado en tu zona.`
      : `${producto.nombre} — $${producto.precio.toLocaleString('es-AR')}. Apareció en una categoría que venís buscando.`

    let enviadas = 0
    for (const perfil of candidatos) {
      if (vendedorUsuarioId && perfil.usuarioId?.toString() === vendedorUsuarioId) continue
      try {
        const notif = await new Notificacion({
          usuarioId: perfil.usuarioId,
          tipo: 'sistema',
          titulo,
          mensaje,
          enlace: `/producto/${producto._id}`
        }).save()
        emitNotificacion(perfil.usuarioId.toString(), notif)
        enviarPush(perfil.usuarioId.toString(), {
          title: titulo,
          body: mensaje,
          url: `/producto/${producto._id}`
        }).catch(() => {})

        perfil.ultimaNotifPublicidad = new Date()
        await perfil.save()
        enviadas++
      } catch (e) {
        // seguir con el resto
      }
    }

    if (enviadas > 0) {
      // Contabilizamos como impresiones relevantes (la pauta salió a buscar comprador)
      await Destacado.updateOne(
        { _id: destacado._id },
        { $inc: { impresionesRelevantes: enviadas } }
      ).catch(() => {})
      console.log(`🎯 Pauta inteligente: ${enviadas} clientes ideales notificados para "${producto.nombre}"`)
    }
  } catch (e) {
    console.warn('notificarClientesIdeales falló:', e.message)
  }
}
