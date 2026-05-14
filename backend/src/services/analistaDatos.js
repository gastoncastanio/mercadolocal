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
