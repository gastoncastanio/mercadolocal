import express from 'express'
import {
  generarMultiplesLogos,
} from '../services/dalleService.js'
import {
  generarPromptsParaLogos,
  generarPromptsParaVariaciones,
} from '../services/generadorPrompts.js'
import { agregarLogosAProyecto } from '../services/proyectoService.js'

const router = express.Router()

// Generar logos
router.post('/generar', async (req, res) => {
  try {
    const {
      nombreMarca,
      descripcion,
      valores,
      estilo,
      parametros,
      cantidadLogos = 12,
    } = req.body

    console.log('📝 Request recibido para generar logos:', { nombreMarca, estilo })

    // Validar datos
    if (!nombreMarca || !descripcion || !estilo) {
      console.error('❌ Faltan datos requeridos')
      return res.status(400).json({
        error: 'Faltan datos requeridos: nombreMarca, descripcion, estilo',
      })
    }

    // Generar prompts
    const prompts = generarPromptsParaLogos({
      nombreMarca,
      descripcion,
      valores,
      estilo,
      parametros,
    })

    // Limitar cantidad de logos a generar
    const promptsAGenerar = prompts.slice(0, cantidadLogos)

    console.log(`🎨 Generando ${promptsAGenerar.length} logos para "${nombreMarca}"...`)

    // Generar logos con DALL-E
    const urls = await generarMultiplesLogos(promptsAGenerar)

    console.log(`✅ Se generaron ${urls.length} logos exitosamente`)

    // Formatear response
    const logos = urls.map((url, index) => ({
      url,
      estilo,
      parametros,
      favorito: false,
      fechaCreacion: new Date(),
    }))

    res.json(logos)
  } catch (error) {
    console.error('❌ Error en /generar:', error.message)
    console.error('Stack:', error.stack)
    res.status(500).json({
      error: error.message,
      details: error.stack
    })
  }
})

// Generar variaciones
router.post('/:logoId/variaciones', async (req, res) => {
  try {
    const { logoId } = req.params
    const { cantidad = 4 } = req.body

    // TODO: Obtener logo y generar variaciones
    res.json({
      mensaje: 'Variaciones generadas',
      variaciones: [],
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Marcar como favorito
router.put('/:logoId/favorito', async (req, res) => {
  try {
    const { logoId } = req.params
    const { favorito } = req.body

    // TODO: Actualizar logo en BD
    res.json({ mensaje: 'Favorito actualizado' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Descargar logo
router.get('/:logoId/descargar', async (req, res) => {
  try {
    const { logoId } = req.params
    const { formato = 'png' } = req.query

    // TODO: Implementar descarga real
    res.json({
      mensaje: 'Descarga iniciada',
      formato,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
