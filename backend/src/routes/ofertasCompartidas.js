import { Router } from 'express'
import { verificarToken, soloAdmin } from '../middleware/auth.js'
import * as ofertaCompartidaService from '../services/ofertaCompartidaService.js'

const router = Router()

// ===== Admin =====

// POST /api/ofertas-compartidas/proponer - La plataforma propone una oferta a un vendedor
router.post('/proponer', verificarToken, soloAdmin, async (req, res) => {
  try {
    const oferta = await ofertaCompartidaService.proponerOferta(req.body)
    res.status(201).json(oferta)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/ofertas-compartidas/admin?estado= - Listado para el admin
router.get('/admin', verificarToken, soloAdmin, async (req, res) => {
  try {
    const lista = await ofertaCompartidaService.listarOfertas(req.query.estado)
    res.json(lista)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/ofertas-compartidas/finalizar/:id - Admin finaliza manualmente
router.post('/finalizar/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const oferta = await ofertaCompartidaService.finalizarOferta(req.params.id, 'finalizada')
    res.json(oferta)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ===== Vendedor =====

// GET /api/ofertas-compartidas/mias - Propuestas/ofertas del vendedor logueado
router.get('/mias', verificarToken, async (req, res) => {
  try {
    const lista = await ofertaCompartidaService.ofertasDelVendedor(req.usuario.id)
    res.json(lista)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PATCH /api/ofertas-compartidas/:id/aceptar - El vendedor acepta la propuesta
router.patch('/:id/aceptar', verificarToken, async (req, res) => {
  try {
    const oferta = await ofertaCompartidaService.aceptarOferta(req.usuario.id, req.params.id)
    res.json(oferta)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PATCH /api/ofertas-compartidas/:id/rechazar - El vendedor rechaza la propuesta
router.patch('/:id/rechazar', verificarToken, async (req, res) => {
  try {
    const oferta = await ofertaCompartidaService.rechazarOferta(req.usuario.id, req.params.id)
    res.json(oferta)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
