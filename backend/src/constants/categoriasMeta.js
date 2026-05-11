/**
 * Metadata mínima de categorías para validación server-side.
 *
 * IMPORTANTE: este archivo debe mantenerse SINCRONIZADO con
 * frontend/src/constants/categorias.ts. Solo contiene los IDs de campos
 * obligatorios — no toda la metadata visual (eso queda en el frontend).
 *
 * Si agregás/sacás un campo obligatorio en el frontend, replicarlo acá.
 */

// IDs válidos de categorías
export const CATEGORIAS_VALIDAS = new Set([
  'construccion', 'hogar', 'electrodomesticos', 'electronica', 'ropa',
  'belleza', 'alimentos', 'deportes', 'juguetes', 'mascotas',
  'automotor', 'agro', 'herramientas', 'jardin', 'arte', 'libros'
])

/**
 * IDs de campos obligatorios por categoría.
 * Si un producto se publica sin estos campos llenos → backend rechaza.
 */
export const CAMPOS_OBLIGATORIOS_POR_CATEGORIA = {
  construccion: ['unidad'],
  hogar: ['estado'],
  electrodomesticos: ['estado'],
  electronica: ['estado'],
  ropa: ['talle', 'genero', 'estado'],
  belleza: ['vencimiento', 'estado'],
  alimentos: ['vencimiento', 'tiene_habilitacion', 'peso_volumen', 'alergenos'],
  deportes: ['estado'],
  juguetes: ['edad_recomendada', 'tiene_piezas_pequenas', 'estado'],
  mascotas: ['tipo_mascota'],
  automotor: ['tipo_vehiculo', 'anio', 'marca_modelo', 'cedula_a_tu_nombre', 'libre_prenda', 'declarado_chocado'],
  agro: ['unidad'],
  herramientas: ['tipo', 'estado'],
  jardin: [],
  arte: [],
  libros: ['es_original']
}

/**
 * Valida que un producto tenga llenos los campos obligatorios de su categoría.
 *
 * @param {string[]} categoriasProducto - array de IDs de categorías
 * @param {Array<{clave: string, valor: string}>} caracteristicas
 * @returns {{ valido: boolean, faltantes: string[] }}
 */
export function validarCamposObligatoriosCategoria(categoriasProducto, caracteristicas) {
  if (!Array.isArray(categoriasProducto) || categoriasProducto.length === 0) {
    return { valido: true, faltantes: [] }
  }

  const catId = categoriasProducto[0]
  const obligatorios = CAMPOS_OBLIGATORIOS_POR_CATEGORIA[catId] || []

  if (obligatorios.length === 0) {
    return { valido: true, faltantes: [] }
  }

  const caracteristicasArr = Array.isArray(caracteristicas) ? caracteristicas : []
  const clavesLlenadas = new Set(
    caracteristicasArr
      .filter(c => c && c.clave && typeof c.valor === 'string' && c.valor.trim() !== '')
      .map(c => c.clave)
  )

  const faltantes = obligatorios.filter(id => !clavesLlenadas.has(id))

  return {
    valido: faltantes.length === 0,
    faltantes
  }
}

/**
 * Valida que el ID de categoría sea uno de los conocidos.
 */
export function categoriaValida(catId) {
  return CATEGORIAS_VALIDAS.has(catId)
}
