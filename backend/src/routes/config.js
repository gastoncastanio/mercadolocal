import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import {
  obtenerTodasConfig,
  obtenerConfigPorCategoria,
  obtenerConfigPublica,
  actualizarConfig,
  actualizarMultiplesConfig,
  inicializarConfig
} from '../services/configService.js'

const router = Router()

// GET /api/config/publica - Obtener configs públicas (sin auth)
router.get('/publica', async (req, res) => {
  try {
    const claves = [
      'sitio_nombre', 'sitio_descripcion', 'sitio_logo',
      'sitio_color_primario', 'sitio_color_secundario',
      'landing_titulo', 'landing_subtitulo', 'landing_cta_comprador', 'landing_cta_vendedor',
      'landing_banner_imagen',
      'contacto_whatsapp', 'contacto_instagram', 'contacto_email',
      'seo_titulo', 'seo_descripcion', 'seo_keywords',
      'func_chat_activo', 'func_disputas_activo', 'func_resenas_activo',
      'func_registro_vendedor', 'func_mantenimiento',
      'moneda_simbolo'
    ]
    const config = await obtenerConfigPublica(claves)
    res.json(config)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/config - Todas las configs (solo admin)
router.get('/', verificarToken, async (req, res) => {
  try {
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo admin puede ver todas las configuraciones' })
    }
    const configs = await obtenerTodasConfig()
    res.json(configs)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/config/categoria/:categoria - Configs por categoría (solo admin)
router.get('/categoria/:categoria', verificarToken, async (req, res) => {
  try {
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo admin' })
    }
    const configs = await obtenerConfigPorCategoria(req.params.categoria)
    res.json(configs)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/config/:clave - Actualizar una config (solo admin)
router.put('/:clave', verificarToken, async (req, res) => {
  try {
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo admin puede modificar configuraciones' })
    }
    const config = await actualizarConfig(req.params.clave, req.body.valor)
    res.json(config)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PUT /api/config - Actualizar múltiples configs (solo admin)
router.put('/', verificarToken, async (req, res) => {
  try {
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo admin' })
    }
    const resultados = await actualizarMultiplesConfig(req.body.cambios)
    res.json({ actualizados: resultados.length, configs: resultados })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/config/inicializar - Crear configs por defecto (solo admin)
router.post('/inicializar', verificarToken, async (req, res) => {
  try {
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo admin' })
    }
    await inicializarConfig()
    const configs = await obtenerTodasConfig()
    res.json({ mensaje: 'Configuraciones inicializadas', total: configs.length, configs })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
