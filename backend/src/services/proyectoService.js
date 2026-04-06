import Proyecto from '../models/Proyecto.js'
import Logo from '../models/Logo.js'

export async function crearProyecto(datos) {
  try {
    const proyecto = new Proyecto(datos)
    await proyecto.save()
    return proyecto
  } catch (error) {
    console.error('Error al crear proyecto:', error.message)
    throw error
  }
}

export async function obtenerProyecto(id) {
  try {
    const proyecto = await Proyecto.findById(id)
    return proyecto
  } catch (error) {
    console.error('Error al obtener proyecto:', error.message)
    throw error
  }
}

export async function listarProyectos(usuarioId) {
  try {
    const proyectos = await Proyecto.find(usuarioId ? { usuarioId } : {})
    return proyectos
  } catch (error) {
    console.error('Error al listar proyectos:', error.message)
    throw error
  }
}

export async function actualizarProyecto(id, datos) {
  try {
    const proyecto = await Proyecto.findByIdAndUpdate(id, datos, { new: true })
    return proyecto
  } catch (error) {
    console.error('Error al actualizar proyecto:', error.message)
    throw error
  }
}

export async function eliminarProyecto(id) {
  try {
    const proyecto = await Proyecto.findByIdAndDelete(id)
    // Eliminar logos relacionados
    if (proyecto) {
      await Logo.deleteMany({ proyectoId: id })
    }
    return proyecto
  } catch (error) {
    console.error('Error al eliminar proyecto:', error.message)
    throw error
  }
}

export async function agregarLogosAProyecto(proyectoId, logos) {
  try {
    const proyecto = await Proyecto.findByIdAndUpdate(
      proyectoId,
      { $push: { logos: { $each: logos } } },
      { new: true }
    )
    return proyecto
  } catch (error) {
    console.error('Error al agregar logos:', error.message)
    throw error
  }
}
