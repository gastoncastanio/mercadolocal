import express from 'express'
import {
  crearProyecto,
  obtenerProyecto,
  listarProyectos,
  actualizarProyecto,
  eliminarProyecto,
} from '../services/proyectoService.js'

const router = express.Router()

// Crear proyecto
router.post('/', async (req, res) => {
  try {
    const proyecto = await crearProyecto(req.body)
    res.status(201).json(proyecto)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Obtener proyecto por ID
router.get('/:id', async (req, res) => {
  try {
    const proyecto = await obtenerProyecto(req.params.id)
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' })
    }
    res.json(proyecto)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Listar proyectos
router.get('/', async (req, res) => {
  try {
    const proyectos = await listarProyectos()
    res.json(proyectos)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Actualizar proyecto
router.put('/:id', async (req, res) => {
  try {
    const proyecto = await actualizarProyecto(req.params.id, req.body)
    res.json(proyecto)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Eliminar proyecto
router.delete('/:id', async (req, res) => {
  try {
    await eliminarProyecto(req.params.id)
    res.json({ mensaje: 'Proyecto eliminado' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
