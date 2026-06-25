/**
 * ANALISTA DE DATOS — la fuente de verdad para los agentes IA.
 *
 * Antes de pedirle a un agente que opine, le pasamos los datos REALES
 * del marketplace que son relevantes para esa decisión.
 *
 * Esto es lo que evita las alucinaciones: si el agente no tiene datos,
 * no puede inventar. Si dice "vi 3 casos esta semana", esos 3 casos
 * vienen de acá, con sus IDs reales.
 *
 * REGLA INVIOLABLE: este servicio NO escribe nada. Solo lee. Los agentes
 * tampoco escriben — solo proponen y vos decidís.
 */

import Producto from '../models/Producto.js'
import Orden from '../models/Orden.js'
import Moderacion from '../models/Moderacion.js'
import Ticket from '../models/Ticket.js'
import Tienda from '../models/Tienda.js'
import Usuario from '../models/Usuario.js'
import MensajeOrganizacion from '../models/MensajeOrganizacion.js'

/**
 * Snapshot de los datos del marketplace del último período.
 * Es lo que el agente "ve" cuando lo invocamos para analizar.
 */
export async function obtenerSnapshotMercado(horasAtras = 24) {
  const desde = new Date(Date.now() - horasAtras * 60 * 60 * 1000)

  const [
    productosNuevos,
    productosTotales,
    ordenesPeriodo,
    moderacionesPeriodo,
    ticketsPeriodo,
    ticketsEscalados,
    tiendasActivas,
    usuariosNuevos
  ] = await Promise.all([
    Producto.find({ createdAt: { $gte: desde } })
      .select('nombre precio categorias moderacion tiendaId imagenes')
      .populate('tiendaId', 'nombre mpVinculado calificacion totalVentas')
      .lean(),
    Producto.countDocuments({ activo: true, 'moderacion.estado': { $ne: 'rechazado' } }),
    Orden.find({ createdAt: { $gte: desde } })
      .select('estado total comision createdAt items')
      .lean(),
    Moderacion.find({ createdAt: { $gte: desde } })
      .select('decision confianza banderas snapshot')
      .lean(),
    Ticket.find({ createdAt: { $gte: desde } })
      .select('estado prioridad asunto tags')
      .lean(),
    Ticket.find({ estado: 'escalado' })
      .select('asunto prioridad createdAt usuarioId')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    Tienda.countDocuments({ activo: true, mpVinculado: true }),
    Usuario.countDocuments({ createdAt: { $gte: desde } })
  ])

  // Agregaciones útiles
  const ventas = ordenesPeriodo.filter(o => o.estado !== 'cancelada')
  const totalVentas = ventas.reduce((s, o) => s + (o.total || 0), 0)
  const totalComisiones = ventas.reduce((s, o) => s + (o.comision || 0), 0)

  const moderacionPorDecision = moderacionesPeriodo.reduce((acc, m) => {
    acc[m.decision] = (acc[m.decision] || 0) + 1
    return acc
  }, {})

  const banderasTop = {}
  moderacionesPeriodo.forEach(m => {
    (m.banderas || []).forEach(b => { banderasTop[b] = (banderasTop[b] || 0) + 1 })
  })

  const ticketsPorAsunto = ticketsPeriodo.reduce((acc, t) => {
    acc[t.asunto || 'otro'] = (acc[t.asunto || 'otro'] || 0) + 1
    return acc
  }, {})

  const productosSospechosos = productosNuevos.filter(p =>
    p.moderacion?.estado === 'revision' ||
    p.moderacion?.estado === 'rechazado' ||
    (p.moderacion?.confianza < 70)
  )

  return {
    periodoHoras: horasAtras,
    desde: desde.toISOString(),
    ahora: new Date().toISOString(),

    // Mercado en general
    catalogo: {
      totalProductos: productosTotales,
      nuevosEnPeriodo: productosNuevos.length,
      tiendasActivas
    },

    // Ventas y dinero
    ventas: {
      total: ventas.length,
      monto: totalVentas,
      comisiones: totalComisiones,
      ticketsPromedio: ventas.length > 0 ? Math.round(totalVentas / ventas.length) : 0
    },

    // Moderación (la sala de Sofía)
    moderacion: {
      total: moderacionesPeriodo.length,
      porDecision: moderacionPorDecision,
      banderasTop: Object.entries(banderasTop)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([k, v]) => ({ bandera: k, count: v })),
      productosSospechosos: productosSospechosos.slice(0, 10).map(p => ({
        id: p._id.toString(),
        nombre: p.nombre,
        precio: p.precio,
        categoria: p.categorias?.[0] || 'sin_categoria',
        tienda: p.tiendaId?.nombre || 'tienda desconocida',
        confianzaModeracion: p.moderacion?.confianza,
        estadoModeracion: p.moderacion?.estado
      }))
    },

    // Soporte (la sala de Tomás)
    soporte: {
      ticketsNuevos: ticketsPeriodo.length,
      porAsunto: ticketsPorAsunto,
      escaladosAbiertos: ticketsEscalados.length,
      ejemplosEscalados: ticketsEscalados.slice(0, 5).map(t => ({
        id: t._id.toString(),
        asunto: t.asunto || 'sin_asunto',
        prioridad: t.prioridad,
        hace: Math.round((Date.now() - new Date(t.createdAt).getTime()) / 3600000) + ' horas'
      }))
    },

    // Crecimiento
    crecimiento: {
      usuariosNuevos
    }
  }
}

/**
 * Devuelve el snapshot formateado en texto para inyectar al prompt
 * de un agente. Le da contexto real para decidir.
 */
export async function snapshotComoTexto(horasAtras = 24) {
  const s = await obtenerSnapshotMercado(horasAtras)

  const lineas = [
    `📊 SNAPSHOT REAL del marketplace — últimas ${s.periodoHoras}h`,
    '',
    `🏪 CATÁLOGO: ${s.catalogo.totalProductos} productos activos, ${s.catalogo.nuevosEnPeriodo} nuevos en el período, ${s.catalogo.tiendasActivas} tiendas con MP vinculado.`,
    '',
    `💰 VENTAS DEL PERÍODO: ${s.ventas.total} órdenes, $${s.ventas.monto.toLocaleString('es-AR')} ARS facturados, $${s.ventas.comisiones.toLocaleString('es-AR')} de comisión. Ticket promedio: $${s.ventas.ticketsPromedio.toLocaleString('es-AR')}.`,
    '',
    `🛡️ MODERACIÓN: ${s.moderacion.total} productos revisados (${JSON.stringify(s.moderacion.porDecision)}).`
  ]

  if (s.moderacion.banderasTop.length > 0) {
    lineas.push(`   Banderas más frecuentes: ${s.moderacion.banderasTop.map(b => `${b.bandera}(${b.count})`).join(', ')}`)
  }

  if (s.moderacion.productosSospechosos.length > 0) {
    lineas.push(`   PRODUCTOS QUE NECESITAN ATENCIÓN (${s.moderacion.productosSospechosos.length}):`)
    s.moderacion.productosSospechosos.slice(0, 5).forEach(p => {
      lineas.push(`   - "${p.nombre}" $${p.precio.toLocaleString('es-AR')} | tienda: ${p.tienda} | estado: ${p.estadoModeracion} (${p.confianzaModeracion}% conf)`)
    })
  }

  lineas.push('')
  lineas.push(`💬 SOPORTE: ${s.soporte.ticketsNuevos} tickets nuevos, ${s.soporte.escaladosAbiertos} escalados abiertos.`)
  if (Object.keys(s.soporte.porAsunto).length > 0) {
    lineas.push(`   Por asunto: ${JSON.stringify(s.soporte.porAsunto)}`)
  }
  if (s.soporte.ejemplosEscalados.length > 0) {
    lineas.push(`   Ejemplos escalados: ${s.soporte.ejemplosEscalados.map(t => `${t.asunto} (${t.prioridad}, ${t.hace})`).join('; ')}`)
  }

  lineas.push('')
  lineas.push(`🌱 USUARIOS NUEVOS: ${s.crecimiento.usuariosNuevos} en el período.`)

  return lineas.join('\n')
}

/**
 * Datos específicos por agente — cada uno mira lo que le compete.
 */
export async function datosParaAgente(slug, horasAtras = 24) {
  const desde = new Date(Date.now() - horasAtras * 60 * 60 * 1000)

  if (slug === 'sofia_cmo') {
    // Sofía ve moderaciones, productos sospechosos, banderas
    const [moderaciones, productosSospechosos] = await Promise.all([
      Moderacion.find({ createdAt: { $gte: desde } })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Producto.find({
        createdAt: { $gte: desde },
        $or: [
          { 'moderacion.estado': 'revision' },
          { 'moderacion.estado': 'rechazado' },
          { 'moderacion.confianza': { $lt: 70 } }
        ]
      })
        .populate('tiendaId', 'nombre createdAt totalVentas calificacion')
        .limit(20)
        .lean()
    ])
    return { moderaciones, productosSospechosos, periodo: `${horasAtras}h` }
  }

  if (slug === 'tomas_cto') {
    // Tomás ve tickets, sus tags, sus prioridades, casos escalados
    const [tickets, escalados] = await Promise.all([
      Ticket.find({ createdAt: { $gte: desde } })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Ticket.find({ estado: 'escalado' })
        .populate('usuarioId', 'nombre rol')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
    ])
    return { tickets, escalados, periodo: `${horasAtras}h` }
  }

  if (slug === 'diego_ceo') {
    // Diego ve todo agregado — el snapshot completo
    return await obtenerSnapshotMercado(horasAtras)
  }

  return { mensaje: 'no hay datos específicos para este agente' }
}

// ============================================================
// DATOS PARA EL ESTUDIO CREATIVO (Valentina CGO + críticos)
// ============================================================
//
// El motor creativo NO puede inventar qué mostrar. Antes de generar un
// prompt para nano banana, Valentina necesita saber QUÉ se mueve de verdad
// en el marketplace: qué rubros tienen oferta, cuántos usados hay (el motor
// de tráfico), qué tiendas destacar, en qué ciudad y en qué estación del año
// estamos. Así el prompt es oportuno y específico, no un cliché atemporal.

// Nombres lindos para los IDs de categoría (mismo set que categoriasMeta.js)
const ETIQUETA_CATEGORIA = {
  construccion: 'construcción', hogar: 'hogar', electrodomesticos: 'electrodomésticos',
  electronica: 'electrónica', ropa: 'ropa', belleza: 'belleza', alimentos: 'alimentos',
  deportes: 'deportes', juguetes: 'juguetes', mascotas: 'mascotas', automotor: 'automotor',
  agro: 'agro', herramientas: 'herramientas', jardin: 'jardín', arte: 'arte', libros: 'libros'
}

// Estación del hemisferio SUR (Argentina) según el mes (0-11).
function estacionDelSur(mes) {
  if (mes === 11 || mes === 0 || mes === 1) return 'verano'
  if (mes >= 2 && mes <= 4) return 'otoño'
  if (mes >= 5 && mes <= 7) return 'invierno'
  return 'primavera'
}

// Eventos comerciales argentinos por mes (para anclar la creatividad al calendario).
function ganchoDelMes(mes) {
  const ganchos = {
    0: 'vuelta de las vacaciones, liquidaciones de verano',
    1: 'previa a la vuelta al cole, San Valentín',
    2: 'vuelta al cole y al laburo, otoño',
    3: 'otoño, Pascuas',
    4: 'Día del Trabajador, Día de la Madre se acerca (3er domingo de octubre, lejos), frío que empieza',
    5: 'Día del Padre, frío, inicio de invierno',
    6: 'vacaciones de invierno, frío fuerte',
    7: 'Día del Niño/de las Infancias (3er domingo), invierno',
    8: 'primavera que arranca, Día del Estudiante/Primavera (21)',
    9: 'Día de la Madre (3er domingo), primavera plena',
    10: 'previa a las Fiestas, Black Friday / Cyber Monday',
    11: 'Fiestas (Navidad y Año Nuevo), aguinaldo, verano'
  }
  return ganchos[mes] || ''
}

/**
 * Reúne los datos REALES del marketplace que alimentan al Estudio Creativo.
 * Se le pasa a Valentina (genera) y a los críticos (verifican) para que la
 * pieza hable de lo que de verdad está pasando en la app, no de un genérico.
 *
 * @param {number} horasAtras - ventana de tiempo (default 7 días)
 */
export async function datosParaCreativa(horasAtras = 168) {
  const desde = new Date(Date.now() - horasAtras * 60 * 60 * 1000)
  const ahora = new Date()
  const mes = ahora.getMonth()

  const [
    totalProductos,
    totalUsados,
    rubrosAgg,
    tiendasDestacadas,
    ciudadesAgg,
    nuevosEnPeriodo
  ] = await Promise.all([
    // Catálogo público vigente
    Producto.countDocuments({ activo: true, 'moderacion.estado': { $ne: 'rechazado' } }),
    // Usados activos — el motor de tráfico (comisión 0%)
    Producto.countDocuments({ activo: true, condicion: 'usado', 'moderacion.estado': { $ne: 'rechazado' } }),
    // Rubros con más oferta (qué se está moviendo)
    Producto.aggregate([
      { $match: { activo: true, 'moderacion.estado': { $ne: 'rechazado' } } },
      { $unwind: '$categorias' },
      { $group: { _id: '$categorias', total: { $sum: 1 }, precioProm: { $avg: '$precio' } } },
      { $sort: { total: -1 } },
      { $limit: 6 }
    ]),
    // Tiendas para destacar (oficiales y con más ventas, ya con MP vinculado)
    Tienda.find({ activo: true, mpVinculado: true })
      .select('nombre ciudad oficial totalVentas calificacion')
      .sort({ oficial: -1, totalVentas: -1, calificacion: -1 })
      .limit(8)
      .lean(),
    // Ciudades con catálogo (para multi-ciudad / saber dónde hay vida)
    Producto.aggregate([
      { $match: { activo: true, ciudad: { $nin: ['', null] }, 'moderacion.estado': { $ne: 'rechazado' } } },
      { $group: { _id: '$ciudad', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 6 }
    ]),
    Producto.countDocuments({ createdAt: { $gte: desde }, activo: true })
  ])

  const rubros = rubrosAgg.map(r => ({
    id: r._id,
    nombre: ETIQUETA_CATEGORIA[r._id] || r._id || 'sin_categoría',
    total: r.total,
    precioPromedio: Math.round(r.precioProm || 0)
  }))

  const usadosRatio = totalProductos > 0 ? Math.round((totalUsados / totalProductos) * 100) : 0

  return {
    periodoHoras: horasAtras,
    ahora: ahora.toISOString(),
    temporada: {
      mes: ahora.toLocaleString('es-AR', { month: 'long' }),
      estacion: estacionDelSur(mes),
      gancho: ganchoDelMes(mes)
    },
    catalogo: {
      totalProductos,
      nuevosEnPeriodo,
      totalUsados,
      usadosRatio
    },
    rubros,
    tiendasDestacadas: tiendasDestacadas.map(t => ({
      nombre: t.nombre,
      ciudad: t.ciudad || '',
      oficial: !!t.oficial,
      totalVentas: t.totalVentas || 0,
      calificacion: t.calificacion || 0
    })),
    ciudades: ciudadesAgg.map(c => ({ ciudad: c._id, total: c.total }))
  }
}

/**
 * Render del paquete de datos creativos como bloque de texto para inyectar
 * en el system prompt de Valentina y los críticos.
 */
export async function datosCreativaComoTexto(horasAtras = 168) {
  const d = await datosParaCreativa(horasAtras)

  const lineas = [
    `# 📦 DATOS REALES del marketplace (para anclar la pieza, no inventes nada fuera de esto)`,
    '',
    `🗓️ MOMENTO: estamos en ${d.temporada.mes} (${d.temporada.estacion} en Argentina). Gancho de calendario: ${d.temporada.gancho || 'sin evento marcado'}.`,
    `🏪 CATÁLOGO: ${d.catalogo.totalProductos} productos publicados, ${d.catalogo.nuevosEnPeriodo} nuevos esta semana.`,
    `♻️ USADOS: ${d.catalogo.totalUsados} usados activos (${d.catalogo.usadosRatio}% del catálogo). Es el MOTOR DE TRÁFICO (comisión 0%): si la función es de usados, esto es lo que hay que activar.`
  ]

  if (d.rubros.length > 0) {
    lineas.push('')
    lineas.push('🔝 RUBROS QUE SE MUEVEN (usá productos concretos de estos rubros, no genéricos):')
    d.rubros.forEach(r => {
      lineas.push(`   - ${r.nombre}: ${r.total} productos (precio prom. $${r.precioPromedio.toLocaleString('es-AR')})`)
    })
  }

  if (d.tiendasDestacadas.length > 0) {
    lineas.push('')
    lineas.push('⭐ TIENDAS REALES para destacar (si la función lo pide, nombrá el tipo de comercio, no inventes marcas):')
    d.tiendasDestacadas.slice(0, 5).forEach(t => {
      lineas.push(`   - ${t.nombre}${t.ciudad ? ` (${t.ciudad})` : ''}${t.oficial ? ' [oficial]' : ''} — ${t.totalVentas} ventas`)
    })
  }

  if (d.ciudades.length > 0) {
    lineas.push('')
    lineas.push(`🌎 CIUDADES con catálogo: ${d.ciudades.map(c => `${c.ciudad} (${c.total})`).join(', ')}.`)
  }

  return lineas.join('\n')
}
