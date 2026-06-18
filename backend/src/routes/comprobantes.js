import { Router } from 'express'
import { verificarToken, soloTieneVendedor, soloAdmin } from '../middleware/auth.js'
import Comprobante from '../models/Comprobante.js'
import Orden from '../models/Orden.js'
import Tienda from '../models/Tienda.js'
import {
  comprobantesDelVendedor,
  emitirFacturaVenta,
  obtenerDatosFiscalesPlataforma,
  guardarDatosFiscalesPlataforma
} from '../services/facturacionService.js'

const router = Router()

// GET /api/comprobantes/mios
// Comprobantes que la plataforma le emitió al vendedor logueado (pauta + comisión).
router.get('/mios', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    const comprobantes = await comprobantesDelVendedor(req.usuario.id)
    res.json(comprobantes)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/comprobantes/datos-fiscales
// Datos fiscales cargados en la tienda del vendedor (para el formulario).
router.get('/datos-fiscales', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    const tienda = await Tienda.findOne({ usuarioId: req.usuario.id }).select('datosFiscales').lean()
    res.json(tienda?.datosFiscales || {})
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/comprobantes/datos-fiscales
// El vendedor carga/edita sus datos fiscales (emisor de sus facturas de venta y
// receptor de las nuestras).
router.put('/datos-fiscales', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    const { razonSocial, cuit, condicionIVA, domicilio } = req.body
    const condicionesValidas = ['', 'Monotributo', 'Responsable Inscripto', 'Exento', 'Consumidor Final']
    const datosFiscales = {
      razonSocial: String(razonSocial || '').slice(0, 200),
      cuit: String(cuit || '').replace(/[^\d]/g, '').slice(0, 11),
      condicionIVA: condicionesValidas.includes(condicionIVA) ? condicionIVA : '',
      domicilio: String(domicilio || '').slice(0, 200)
    }
    const tienda = await Tienda.findOneAndUpdate(
      { usuarioId: req.usuario.id },
      { $set: { datosFiscales } },
      { new: true }
    ).select('datosFiscales')
    if (!tienda) return res.status(404).json({ error: 'Tienda no encontrada' })
    res.json(tienda.datosFiscales)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/comprobantes/plataforma  (admin)
// Datos fiscales de la plataforma (emisor de pauta/comisión).
router.get('/plataforma', verificarToken, soloAdmin, async (_req, res) => {
  try {
    res.json(await obtenerDatosFiscalesPlataforma())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/comprobantes/plataforma  (admin)
router.put('/plataforma', verificarToken, soloAdmin, async (req, res) => {
  try {
    res.json(await guardarDatosFiscalesPlataforma(req.body || {}))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/comprobantes/venta/:ordenId
// Factura(s) de venta de una orden. Visible para el comprador y los vendedores.
router.get('/venta/:ordenId', verificarToken, async (req, res) => {
  try {
    const orden = await Orden.findById(req.params.ordenId).lean()
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })

    const esComprador = orden.compradorId.toString() === req.usuario.id
    const tiendasUsuario = await Tienda.find({ usuarioId: req.usuario.id }).select('_id').lean()
    const idsTienda = new Set(tiendasUsuario.map(t => t._id.toString()))
    const esVendedor = (orden.items || []).some(i => idsTienda.has(i.tiendaId?.toString()))

    if (!esComprador && !esVendedor && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' })
    }

    const facturas = await Comprobante.find({ ordenId: orden._id, tipo: 'venta' })
      .sort({ fechaEmision: -1 }).lean()
    res.json(facturas)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/comprobantes/venta/:ordenId
// El vendedor emite (o sube) la factura de venta a su comprador.
// Body opcional: { pdfUrl } si sube su propio PDF de AFIP/ARCA.
router.post('/venta/:ordenId', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    const orden = await Orden.findById(req.params.ordenId).lean()
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })

    if (!['pagada', 'enviada', 'completada'].includes(orden.estado)) {
      return res.status(400).json({ error: 'La orden todavía no está pagada' })
    }

    const tienda = await Tienda.findOne({ usuarioId: req.usuario.id }).lean()
    if (!tienda) return res.status(404).json({ error: 'Tienda no encontrada' })

    const tieneItems = (orden.items || []).some(i => i.tiendaId?.toString() === tienda._id.toString())
    if (!tieneItems) {
      return res.status(403).json({ error: 'Esta orden no incluye productos de tu tienda' })
    }

    const comp = await emitirFacturaVenta(orden, tienda._id, { pdfUrl: req.body?.pdfUrl })
    res.status(201).json(comp)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/comprobantes/:id
// Datos de un comprobante para la vista imprimible. Acceso restringido a las
// partes (emisor/receptor) y admin.
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const comp = await Comprobante.findById(req.params.id).lean()
    if (!comp) return res.status(404).json({ error: 'Comprobante no encontrado' })

    const uid = req.usuario.id
    const esVendedor = comp.vendedorId && comp.vendedorId.toString() === uid
    const esComprador = comp.compradorId && comp.compradorId.toString() === uid
    if (!esVendedor && !esComprador && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' })
    }
    res.json(comp)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
