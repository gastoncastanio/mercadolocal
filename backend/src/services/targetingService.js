import PerfilInteres from '../models/PerfilInteres.js'
import Producto from '../models/Producto.js'
import Destacado from '../models/Destacado.js'
import Notificacion from '../models/Notificacion.js'
import Tienda from '../models/Tienda.js'
import Coocurrencia from '../models/Coocurrencia.js'
import { emitNotificacion } from './socketService.js'
import { enviarPush } from './pushService.js'

/**
 * targetingService — el MOTOR DE PROPENSIÓN de Mercado Local.
 * La carta bajo la manga: predice quién va a comprar qué, y cuándo.
 *
 * Capas:
 *  1) SEÑALES. Registra vistas, búsquedas, favoritos y compras y arma un perfil
 *     por cliente (logueado o anónimo), con marca temporal por categoría.
 *  2) DECAIMIENTO TEMPORAL. La intención de compra se enfría: un interés de hoy
 *     pesa mucho más que el de hace un mes (vida media).
 *  3) FUNNEL DE INTENCIÓN. Detecta la etapa del cliente (frío → tibio → caliente
 *     → hirviendo) según repetición y recencia de señales.
 *  4) FILTRADO COLABORATIVO. "Quien mira X también mira Y": expande el interés del
 *     cliente con patrones aprendidos de toda la comunidad.
 *  5) MOMENTUM. Mide la velocidad del interés (varias señales en una sesión =
 *     comprador inminente).
 *  6) SUBASTA CON APRENDIZAJE (bandit / Thompson sampling). El ranking de la pauta
 *     combina propensión personalizada × plan × CTR real aprendido. Un anuncio que
 *     la gente realmente clickea sube; uno que nadie toca baja, aunque pague más.
 *     Así la pauta vende de verdad y el vendedor vuelve a pagar.
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

// Decaimiento temporal: la intención de compra se "enfría" con el tiempo.
// Vida media: a los VIDA_MEDIA_DIAS el evento pesa la mitad.
const VIDA_MEDIA_DIAS = 14       // un interés se reduce a la mitad cada 2 semanas
const DIA_MS = 24 * 60 * 60 * 1000
const SESION_MS = 36 * 60 * 60 * 1000   // ventana de "sesión/momentum" (36 h)

// Filtrado colaborativo
const PESO_COLABORATIVO = 0.18   // cuánto aporta la afinidad aprendida de la comunidad
const TOP_COLAB_ANCLAS = 5       // cuántas categorías del perfil expandimos
const TOP_COLAB_VECINAS = 6      // cuántas vecinas traemos por ancla

// Pesos de la propensión (suman 1.0)
const W_CATEGORIA = 0.42
const W_COLAB = 0.18
const W_INTENCION = 0.22
const W_MOMENTUM = 0.08
const W_PRECIO = 0.06
const W_CIUDAD = 0.04

// Subasta / bandit
const PESO_PLAN = { elite: 1, premium: 0.62, basico: 0.34 }
const CTR_PRIOR = 0.05           // CTR esperado a priori (5%)
const FUERZA_PRIOR = 6           // evidencia previa (en "impresiones equivalentes")
const PRIOR_PLAN_BOOST = { elite: 1.25, premium: 1.1, basico: 1 } // confianza inicial por plan

// Notificaciones inteligentes
const COOLDOWN_NOTIF_MS = 8 * 60 * 60 * 1000  // no más de 1 cada 8 horas
const NAVEGANDO_MS = 5 * 60 * 1000            // si está navegando ahora, no lo molestamos
const UMBRAL_PROPENSION_BASE = 0.45           // propensión mínima para considerarlo "ideal"
const MAX_DESTINATARIOS = 40                  // tope de avisos por campaña (anti-spam y carga)

/**
 * Peso temporal de un evento según su antigüedad (decaimiento exponencial por
 * vida media). Un evento de hoy vale 1; uno de hace VIDA_MEDIA_DIAS vale 0.5;
 * el doble de días, 0.25; etc. Así la INTENCIÓN RECIENTE manda sobre lo viejo.
 */
function pesoTemporal(ts) {
  if (!ts) return 0.4
  const edadDias = (Date.now() - new Date(ts).getTime()) / DIA_MS
  if (edadDias <= 0) return 1
  return Math.pow(0.5, edadDias / VIDA_MEDIA_DIAS)
}

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

  // Marca temporal de la categoría (clave del decaimiento temporal)
  if (campo === 'categorias' && perfil.categoriasTs) {
    perfil.categoriasTs.set(clave, new Date())
  }

  // Podar para no crecer infinito
  if (mapa.size > MAX_CATEGORIAS) {
    const ordenadas = [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_CATEGORIAS)
    perfil[campo] = new Map(ordenadas)
    if (campo === 'categorias' && perfil.categoriasTs) {
      // mantener solo los ts de las categorías que sobreviven
      const vivas = new Set(ordenadas.map(e => e[0]))
      for (const k of [...perfil.categoriasTs.keys()]) {
        if (!vivas.has(k)) perfil.categoriasTs.delete(k)
      }
    }
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
    // Señal fuerte: alimenta el filtrado colaborativo de la comunidad.
    actualizarCoocurrencia(categoria, perfil).catch(() => {})
  } catch (e) {
    console.warn('registrarFavorito falló:', e.message)
  }
}

export async function registrarCompra(usuarioId, items) {
  try {
    if (!usuarioId || !Array.isArray(items)) return
    const perfil = await getOrCreate({ usuarioId })
    if (!perfil) return
    const categoriasCompradas = []
    for (const it of items) {
      // item de orden trae productoId; buscamos su categoría
      const prod = await Producto.findById(it.productoId).select('categorias ciudad precio').lean()
      if (!prod) continue
      const categoria = (prod.categorias && prod.categorias[0]) || ''
      bump(perfil, 'categorias', categoria, PESO_COMPRA)
      if (prod.ciudad) bump(perfil, 'ciudades', prod.ciudad, PESO_COMPRA)
      if (categoria) categoriasCompradas.push(categoria)
    }
    perfil.totalCompras += 1
    perfil.ultimaActividad = new Date()
    await perfil.save()
    // La compra es la señal más fuerte: conecta categorías en el colaborativo.
    for (const cat of categoriasCompradas) {
      actualizarCoocurrencia(cat, perfil).catch(() => {})
    }
  } catch (e) {
    console.warn('registrarCompra falló:', e.message)
  }
}

// ---------------------------------------------------------------------------
// Filtrado colaborativo (co-ocurrencia de categorías)
// ---------------------------------------------------------------------------

/**
 * Conecta la categoría ancla (donde el cliente mostró interés fuerte) con sus
 * otras categorías de interés. Construye, a lo largo de la comunidad, el mapa
 * "quien mira X también mira Y". Fire-and-forget.
 */
async function actualizarCoocurrencia(anclaRaw, perfilDoc) {
  try {
    const ancla = sanitizarClave(anclaRaw)
    if (!ancla) return
    // Top categorías del perfil (excluida la propia ancla)
    const cats = perfilDoc.categorias instanceof Map
      ? [...perfilDoc.categorias.entries()]
      : Object.entries(perfilDoc.categorias || {})
    const vecinas = cats
      .map(([k, v]) => [sanitizarClave(k), v])
      .filter(([k]) => k && k !== ancla)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_COLAB_ANCLAS)
    if (!vecinas.length) return

    const inc = { total: 1 }
    for (const [vecina] of vecinas) inc[`relacionadas.${vecina}`] = 1
    await Coocurrencia.updateOne({ categoria: ancla }, { $inc: inc }, { upsert: true })

    // Simétrico: cada vecina también gana a la ancla (peso menor para no inflar)
    for (const [vecina] of vecinas) {
      await Coocurrencia.updateOne(
        { categoria: vecina },
        { $inc: { [`relacionadas.${ancla}`]: 1 } },
        { upsert: true }
      )
    }
  } catch (e) {
    console.warn('actualizarCoocurrencia falló:', e.message)
  }
}

/**
 * Dado el perfil, devuelve un objeto {categoria: scoreColaborativo 0..1} con las
 * categorías recomendadas por la comunidad a partir de lo que el cliente ya mira.
 */
async function expandirColaborativo(perfilDoc) {
  try {
    const catsObj = perfilDoc.categorias || {}
    const entries = Object.entries(catsObj)
    if (!entries.length) return {}
    const maxCat = Math.max(...entries.map(e => e[1]))
    if (maxCat <= 0) return {}

    // Top anclas del usuario, ponderadas por su interés normalizado
    const anclas = entries
      .map(([k, v]) => [sanitizarClave(k), v / maxCat])
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_COLAB_ANCLAS)

    const docs = await Coocurrencia.find({ categoria: { $in: anclas.map(a => a[0]) } }).lean()
    if (!docs.length) return {}
    const porAncla = new Map(docs.map(d => [d.categoria, d]))

    const acumulado = {}
    for (const [ancla, pesoAncla] of anclas) {
      const doc = porAncla.get(ancla)
      if (!doc || !doc.relacionadas || !doc.total) continue
      const vecinas = Object.entries(doc.relacionadas)
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_COLAB_VECINAS)
      for (const [vecina, cuenta] of vecinas) {
        // confianza P(vecina | ancla) ponderada por cuánto le importa la ancla al user
        const confianza = cuenta / doc.total
        acumulado[vecina] = Math.max(acumulado[vecina] || 0, confianza * pesoAncla)
      }
    }
    // No recomendar lo que ya mira fuerte (evita redundancia)
    for (const [k] of anclas) delete acumulado[k]
    return acumulado
  } catch (e) {
    console.warn('expandirColaborativo falló:', e.message)
    return {}
  }
}

// ---------------------------------------------------------------------------
// Lectura del perfil + enriquecimiento (decay temporal + colaborativo)
// ---------------------------------------------------------------------------

/**
 * Precalcula sobre el perfil (lean) los campos derivados que usa el scoring:
 *  - _catTemporal: {categoria: score×pesoTemporal}  (interés "fresco")
 *  - _maxCatTemporal
 *  - _colab: {categoria: score colaborativo 0..1}
 *  - _maxCiu
 * Hacerlo una vez por request evita recomputar por cada producto.
 */
async function enriquecerPerfil(perfilDoc) {
  if (!perfilDoc) return null
  const cats = perfilDoc.categorias || {}
  const ts = perfilDoc.categoriasTs || {}
  const catTemporal = {}
  let maxTemp = 0
  for (const [k, v] of Object.entries(cats)) {
    const w = v * pesoTemporal(ts[k])
    catTemporal[k] = w
    if (w > maxTemp) maxTemp = w
  }
  perfilDoc._catTemporal = catTemporal
  perfilDoc._maxCatTemporal = maxTemp

  const ciu = perfilDoc.ciudades || {}
  const valoresCiu = Object.values(ciu)
  perfilDoc._maxCiu = valoresCiu.length ? Math.max(...valoresCiu) : 0

  perfilDoc._colab = await expandirColaborativo(perfilDoc)
  return perfilDoc
}

export async function obtenerPerfil(identity) {
  const filtro = filtroIdentidad(identity)
  if (!filtro) return null
  const perfil = await PerfilInteres.findOne(filtro).lean()
  if (!perfil) return null
  return await enriquecerPerfil(perfil)
}

// ---------------------------------------------------------------------------
// Scoring de propensión
// ---------------------------------------------------------------------------

/** Asegura que el perfil tenga los campos derivados (fallback si no se enriqueció). */
function asegurarDerivados(perfil) {
  if (perfil._catTemporal) return
  const cats = perfil.categorias || {}
  const ts = perfil.categoriasTs || {}
  const catTemporal = {}
  let maxTemp = 0
  for (const [k, v] of Object.entries(cats)) {
    const w = v * pesoTemporal(ts[k])
    catTemporal[k] = w
    if (w > maxTemp) maxTemp = w
  }
  perfil._catTemporal = catTemporal
  perfil._maxCatTemporal = maxTemp
  const ciu = perfil.ciudades || {}
  const valoresCiu = Object.values(ciu)
  perfil._maxCiu = valoresCiu.length ? Math.max(...valoresCiu) : 0
  perfil._colab = perfil._colab || {}
}

/**
 * Detecta la etapa del FUNNEL de intención para la(s) categoría(s) del producto,
 * usando el historial reciente ponderado por tiempo. Devuelve 0..1.
 *
 *  - vio/buscó la categoría hace poco  → tibio
 *  - la tocó varias veces (repetición) → caliente
 *  - vio el MISMO producto              → hirviendo (máxima intención)
 */
function scoreIntencion(producto, perfil) {
  const cats = Array.isArray(producto.categorias) ? producto.categorias : []
  if (!cats.length) return 0
  const setCats = new Set(cats.map(sanitizarClave))
  const prodId = producto._id ? producto._id.toString() : null

  let señal = 0
  let vioMismoProducto = false
  let toques = 0

  const vistas = Array.isArray(perfil.vistasRecientes) ? perfil.vistasRecientes : []
  for (const v of vistas) {
    const pt = pesoTemporal(v.ts)
    if (prodId && v.productoId && v.productoId.toString() === prodId) {
      vioMismoProducto = true
      señal += 1.5 * pt
      toques++
    } else if (setCats.has(sanitizarClave(v.categoria))) {
      señal += 0.6 * pt
      toques++
    }
  }
  const busquedas = Array.isArray(perfil.busquedasRecientes) ? perfil.busquedasRecientes : []
  for (const b of busquedas) {
    if (b.categoria && setCats.has(sanitizarClave(b.categoria))) {
      señal += 0.9 * pesoTemporal(b.ts)
      toques++
    }
  }

  if (!toques) return 0
  // Saturación suave: 1 toque fresco ya cuenta; varios escalan hacia 1.
  let s = 1 - Math.exp(-señal)
  // Bonus por repetición (caliente) y por ver el mismo producto (hirviendo)
  if (toques >= 2) s = Math.min(1, s + 0.1)
  if (vioMismoProducto) s = Math.min(1, s + 0.25)
  return Math.min(1, s)
}

/**
 * MOMENTUM: cuánta intención acumuló en la "sesión" reciente (últimas ~36 h) en
 * la categoría del producto. Varias señales juntas = comprador inminente. 0..1.
 */
function scoreMomentum(producto, perfil) {
  const cats = new Set((producto.categorias || []).map(sanitizarClave))
  if (!cats.size) return 0
  const corte = Date.now() - SESION_MS
  let n = 0
  for (const v of (perfil.vistasRecientes || [])) {
    if (new Date(v.ts).getTime() >= corte && cats.has(sanitizarClave(v.categoria))) n++
  }
  for (const b of (perfil.busquedasRecientes || [])) {
    if (b.categoria && new Date(b.ts).getTime() >= corte && cats.has(sanitizarClave(b.categoria))) n++
  }
  if (!n) return 0
  return Math.min(1, n / 4)   // 4+ señales en la sesión => momentum máximo
}

/**
 * PROPENSIÓN de compra de un producto para un perfil (0..1). Combina, con pesos:
 *   categoría (decay temporal) + colaborativo + intención de funnel + momentum +
 *   afinidad de precio + ciudad.
 *
 * (Se mantiene el nombre `scoreRelevancia` por compatibilidad con los callers.)
 */
export function scoreRelevancia(producto, perfil) {
  if (!perfil) return 0
  asegurarDerivados(perfil)
  let score = 0

  // --- Categoría con decaimiento temporal (W_CATEGORIA) ---
  const catTemp = perfil._catTemporal || {}
  const maxTemp = perfil._maxCatTemporal || 0
  if (maxTemp > 0 && Array.isArray(producto.categorias)) {
    let mejor = 0
    for (const c of producto.categorias) {
      const v = catTemp[sanitizarClave(c)] || 0
      if (v > mejor) mejor = v
    }
    score += W_CATEGORIA * (mejor / maxTemp)
  }

  // --- Filtrado colaborativo (W_COLAB) ---
  const colab = perfil._colab || {}
  if (Array.isArray(producto.categorias)) {
    let mejorColab = 0
    for (const c of producto.categorias) {
      const v = colab[sanitizarClave(c)] || 0
      if (v > mejorColab) mejorColab = v
    }
    score += W_COLAB * Math.min(1, mejorColab)
  }

  // --- Intención de funnel (W_INTENCION) ---
  score += W_INTENCION * scoreIntencion(producto, perfil)

  // --- Momentum (W_MOMENTUM) ---
  score += W_MOMENTUM * scoreMomentum(producto, perfil)

  // --- Afinidad de precio (W_PRECIO) ---
  if (perfil.precioCount > 0 && producto.precio > 0) {
    const prom = perfil.precioSum / perfil.precioCount
    if (prom > 0) {
      const ratio = producto.precio / prom
      // Asimétrico: que sea MÁS CARO de lo que suele mirar penaliza más que más barato.
      const l = Math.log(ratio)
      const tolerancia = l >= 0 ? Math.log(3) : Math.log(5)  // tolera barato, castiga caro
      const cercania = Math.max(0, 1 - Math.abs(l) / tolerancia)
      score += W_PRECIO * cercania
    }
  }

  // --- Ciudad (W_CIUDAD) ---
  const ciu = perfil.ciudades || {}
  const maxCiu = perfil._maxCiu || 0
  if (maxCiu > 0 && producto.ciudad && ciu[producto.ciudad]) {
    score += W_CIUDAD * (ciu[producto.ciudad] / maxCiu)
  }

  return Math.min(1, score)
}

// ---------------------------------------------------------------------------
// Subasta con aprendizaje (Thompson sampling sobre el CTR real del anuncio)
// ---------------------------------------------------------------------------

/** Muestra de una Gamma(k,1) — Marsaglia & Tsang. */
function gammaSample(k) {
  if (k < 1) {
    // Boost: Gamma(k) = Gamma(k+1) · U^(1/k)
    return gammaSample(k + 1) * Math.pow(Math.random() || 1e-9, 1 / k)
  }
  const d = k - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  while (true) {
    let x, v
    do {
      // Normal estándar por Box-Muller
      const u1 = Math.random() || 1e-9
      const u2 = Math.random()
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = Math.random()
    if (u < 1 - 0.0331 * x * x * x * x) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

/** Muestra de una Beta(a,b). */
function betaSample(a, b) {
  const x = gammaSample(a)
  const y = gammaSample(b)
  return x / (x + y)
}

/**
 * CTR muestreado (Thompson sampling) a partir de las métricas reales del anuncio
 * más un prior bayesiano por plan. Anuncios nuevos → alta varianza → exploración;
 * anuncios con historia → el muestreo converge a su CTR real → explotación.
 */
function ctrThompson(clicks, impresiones, plan) {
  const cl = Math.max(0, clicks || 0)
  const imp = Math.max(cl, impresiones || 0)
  const boost = PRIOR_PLAN_BOOST[plan] || 1
  const alpha0 = CTR_PRIOR * FUERZA_PRIOR * boost
  const beta0 = (1 - CTR_PRIOR) * FUERZA_PRIOR
  const alpha = alpha0 + cl
  const beta = beta0 + (imp - cl)
  return betaSample(alpha, beta)
}

/**
 * Ordena destacados (con productoId poblado) por VALOR ESPERADO para la
 * plataforma y el comprador, estilo subasta:
 *
 *   score = puja(plan) × CTR_muestreado × (0.2 + 0.8 × propensión)
 *
 *  - puja(plan): el que paga más tiene piso de visibilidad.
 *  - CTR muestreado: aprende qué anuncios realmente funcionan (bandit).
 *  - propensión: personaliza por cliente (lo lleva al comprador ideal).
 *
 * Marca `_scoreRelevancia` (propensión 0..1) en cada destacado para métricas.
 */
export function ordenarDestacadosPorRelevancia(destacados, perfil) {
  if (perfil) asegurarDerivados(perfil)
  const conScore = destacados.map(d => {
    const prod = d.productoId && typeof d.productoId === 'object' ? d.productoId : null
    const rel = prod ? scoreRelevancia(prod, perfil) : 0
    const puja = PESO_PLAN[d.plan] || 0.34
    const ctr = ctrThompson(d.clicks, d.impresiones, d.plan)
    const final = puja * ctr * (0.2 + 0.8 * rel)
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
    const filtro = filtroIdentidad(identity)
    if (!filtro) return
    const perfil = await PerfilInteres.findOne(filtro).lean()
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
  return String(k || '').replace(/\./g, '_').slice(0, 60)
}

// ---------------------------------------------------------------------------
// Notificaciones inteligentes
// ---------------------------------------------------------------------------

/**
 * Umbral de propensión adaptativo. Los clientes muy activos reciben un umbral más
 * alto (les llega solo lo MUY relevante, no spam); los poco activos, uno más bajo
 * (no perdemos la oportunidad de engancharlos). 0.40..0.60.
 */
function umbralAdaptativo(perfil) {
  const nivel =
    (perfil.totalVistas || 0) +
    (perfil.totalBusquedas || 0) * 1.5 +
    (perfil.totalFavoritos || 0) * 3 +
    (perfil.totalCompras || 0) * 5
  return Math.max(0.40, Math.min(0.60, UMBRAL_PROPENSION_BASE + nivel / 2500))
}

/**
 * Detecta clientes IDEALES para un producto recién promocionado y les avisa.
 * - Solo clientes logueados (los anónimos no tienen a quién notificar).
 * - Candidatos: interés directo en la categoría O afinidad colaborativa con ella.
 * - Se rankean por PROPENSIÓN real (no por score crudo) y se filtra por umbral
 *   adaptativo: el aviso llega a quien de verdad está por comprar.
 * - Timer de enfriamiento + no molestar a quien navega ahora.
 *
 * Es async y se llama SIN await (no debe frenar la activación de la pauta).
 */
export async function notificarClientesIdeales(destacado, opts = {}) {
  try {
    const producto = await Producto.findById(destacado.productoId)
      .select('nombre categorias ciudad precio precioAnterior imagenes tiendaId')
      .lean()
    if (!producto) return

    const categoria = (producto.categorias && producto.categorias[0]) || ''
    if (!categoria) return
    const catKey = sanitizarClave(categoria)

    // Vendedor dueño (para no notificarse a sí mismo)
    let vendedorUsuarioId = null
    try {
      const tienda = await Tienda.findById(destacado.tiendaId).select('usuarioId').lean()
      vendedorUsuarioId = tienda?.usuarioId?.toString() || null
    } catch { /* noop */ }

    const ahora = Date.now()

    // Categorías "puerta de entrada": la directa + las que la comunidad asocia con
    // ella (quien mira esas, probablemente quiera esto). Ampliamos el alcance sin
    // perder precisión, porque después filtramos por propensión real.
    const puertas = new Set([catKey])
    try {
      const doc = await Coocurrencia.findOne({ categoria: catKey }).lean()
      if (doc && doc.relacionadas && doc.total) {
        Object.entries(doc.relacionadas)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .forEach(([k]) => puertas.add(k))
      }
    } catch { /* noop */ }

    const orFiltros = [...puertas].map(k => ({ [`categorias.${k}`]: { $gt: 0 } }))

    // Candidatos logueados, fuera de enfriamiento y que no estén navegando ahora.
    const candidatos = await PerfilInteres.find({
      usuarioId: { $ne: null },
      $and: [
        { $or: orFiltros },
        {
          $or: [
            { ultimaNotifPublicidad: null },
            { ultimaNotifPublicidad: { $lt: new Date(ahora - COOLDOWN_NOTIF_MS) } }
          ]
        }
      ],
      ultimaActividad: { $lt: new Date(ahora - NAVEGANDO_MS) }
    }).limit(MAX_DESTINATARIOS * 4).lean()

    // Rankear por PROPENSIÓN real y quedarnos con los verdaderamente ideales.
    const rankeados = []
    for (const perfil of candidatos) {
      if (vendedorUsuarioId && perfil.usuarioId?.toString() === vendedorUsuarioId) continue
      asegurarDerivados(perfil)
      const prop = scoreRelevancia(producto, perfil)
      if (prop >= umbralAdaptativo(perfil)) rankeados.push({ perfil, prop })
    }
    rankeados.sort((a, b) => b.prop - a.prop)
    const elegidos = rankeados.slice(0, MAX_DESTINATARIOS)
    if (!elegidos.length) return

    const enOferta = producto.precioAnterior && producto.precioAnterior > producto.precio
    const titulo = enOferta ? '🔥 Bajó algo que estabas mirando' : '✨ Nuevo para vos en lo que te interesa'
    const off = enOferta ? Math.round((1 - producto.precio / producto.precioAnterior) * 100) : 0
    const mensaje = enOferta
      ? `${producto.nombre} ahora $${producto.precio.toLocaleString('es-AR')} (${off}% OFF). Stock limitado en tu zona.`
      : `${producto.nombre} — $${producto.precio.toLocaleString('es-AR')}. Apareció en una categoría que venís buscando.`

    let enviadas = 0
    for (const { perfil } of elegidos) {
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

        await PerfilInteres.updateOne(
          { _id: perfil._id },
          { $set: { ultimaNotifPublicidad: new Date() } }
        )
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
