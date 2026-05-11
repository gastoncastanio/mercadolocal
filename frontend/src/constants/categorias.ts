/**
 * Categorías centralizadas de MercadoLocal.
 *
 * Esta es la ÚNICA fuente de verdad para categorías. Si querés agregar,
 * sacar o renombrar una categoría, cambialo SOLO acá.
 *
 * Pensado para mercado local argentino (interior bonaerense / Lobos):
 * - Incluye "Agro y rural" que es estratégico para Lobos
 * - Excluye "Salud y farmacia" y "Servicios profesionales" del lanzamiento
 *   por riesgo legal demasiado alto
 * - "Automotor y motos" tiene modalidad especial (sin pago integrado)
 *
 * El campo `riesgoLegal` indica el nivel de moderación que necesita
 * cada categoría a futuro:
 * - 'extremo': revisión humana obligatoria + verificación adicional
 * - 'alto': moderación automática estricta
 * - 'medio': controles básicos
 * - 'bajo': solo lista negra global
 */

export type RiesgoLegal = 'extremo' | 'alto' | 'medio' | 'bajo'

export interface Categoria {
  /** Slug único. Se guarda en BD. NO cambiar después de lanzar. */
  id: string
  /** Nombre visible en la app */
  nombre: string
  /** Emoji para mostrar como ícono */
  icono: string
  /** Descripción corta para ayudar al vendedor a elegir */
  descripcion: string
  /** Nivel de riesgo legal de la categoría */
  riesgoLegal: RiesgoLegal
  /** Si el vendedor puede aceptar pago integrado por MP */
  permitePago: boolean
  /** Sub-categorías (opcional). Útil para filtros más finos */
  subcategorias?: string[]
  /** Avisos legales que se le muestran al vendedor al publicar */
  avisosLegales?: string[]
}

export const CATEGORIAS: Categoria[] = [
  {
    id: 'construccion',
    nombre: 'Construcción y materiales',
    icono: '🧱',
    descripcion: 'Ladrillos, cemento, hierro, pinturas, cerámicas',
    riesgoLegal: 'medio',
    permitePago: true,
    subcategorias: ['Materiales', 'Pinturas', 'Cerámicas y revestimientos', 'Eléctrico', 'Sanitarios', 'Aberturas'],
    avisosLegales: [
      'Está prohibido vender pinturas con plomo (Resolución 1069/15) y materiales con asbesto.',
      'Materiales eléctricos deben tener sello IRAM. Declaralo en el producto.'
    ]
  },
  {
    id: 'hogar',
    nombre: 'Hogar y muebles',
    icono: '🛋️',
    descripcion: 'Sillones, mesas, camas, decoración, cortinas',
    riesgoLegal: 'medio',
    permitePago: true,
    subcategorias: ['Muebles', 'Decoración', 'Iluminación', 'Cocina', 'Baño', 'Textiles'],
    avisosLegales: [
      'Cunas y muebles infantiles deben cumplir norma IRAM 3641.',
      'Colchones usados requieren certificado de desinfección (Res. ANMAT 1480/14).'
    ]
  },
  {
    id: 'electrodomesticos',
    nombre: 'Electrodomésticos',
    icono: '🧊',
    descripcion: 'Heladeras, lavarropas, microondas, aires',
    riesgoLegal: 'medio',
    permitePago: true,
    subcategorias: ['Refrigeración', 'Lavado', 'Cocina', 'Climatización', 'Pequeños electrodomésticos'],
    avisosLegales: [
      'Heladeras, lavarropas y aires acondicionados requieren etiqueta de eficiencia energética (Ley 25.018).',
      'Productos usados tienen garantía mínima de 3 meses por ley.'
    ]
  },
  {
    id: 'electronica',
    nombre: 'Electrónica y tecnología',
    icono: '📱',
    descripcion: 'Celulares, notebooks, audio, gaming',
    riesgoLegal: 'alto',
    permitePago: true,
    subcategorias: ['Celulares', 'Notebooks y computadoras', 'Audio', 'TVs y video', 'Gaming', 'Accesorios'],
    avisosLegales: [
      '🚨 Vender celulares con IMEI bloqueado o robado es delito (Art. 277 CP).',
      'Productos importados deben tener DJAI vigente.',
      'La venta de productos falsificados de marcas reconocidas es delito (Ley 22.362).'
    ]
  },
  {
    id: 'ropa',
    nombre: 'Ropa y calzado',
    icono: '👕',
    descripcion: 'Indumentaria, zapatillas, accesorios',
    riesgoLegal: 'medio',
    permitePago: true,
    subcategorias: ['Mujer', 'Hombre', 'Niños', 'Calzado', 'Accesorios'],
    avisosLegales: [
      'Ropa con marcas reconocidas debe ser original. Vender réplicas como originales es delito (Ley 22.362).',
      'Etiquetado obligatorio con composición textil y país de origen (Res. 287/00 SCT).'
    ]
  },
  {
    id: 'belleza',
    nombre: 'Belleza y cuidado personal',
    icono: '💄',
    descripcion: 'Cosmética, perfumes, cuidado de piel',
    riesgoLegal: 'alto',
    permitePago: true,
    subcategorias: ['Maquillaje', 'Cuidado de la piel', 'Perfumes', 'Cabello', 'Cuidado masculino'],
    avisosLegales: [
      'Cosméticos requieren registro ANMAT (Res. 155/98). Declaralo en el producto.',
      'Productos vencidos no pueden venderse.',
      'Está prohibida la venta de blanqueadores con hidroquinona >2% o mercurio.'
    ]
  },
  {
    id: 'alimentos',
    nombre: 'Alimentos y bebidas',
    icono: '🥖',
    descripcion: 'Comida casera, conservas, vinos, café',
    riesgoLegal: 'extremo',
    permitePago: true,
    subcategorias: ['Almacén', 'Bebidas', 'Vinos y licores', 'Productos artesanales', 'Frescos'],
    avisosLegales: [
      '🚨 Necesitás habilitación bromatológica municipal para vender alimentos.',
      'Productos envasados requieren RNPA (Registro Nacional de Producto Alimenticio).',
      'Es obligatorio declarar alérgenos: TACC, lácteos, frutos secos, soja, huevo (Res. 2343/14).',
      'Bebidas alcohólicas: solo venta a mayores de 18 años.'
    ]
  },
  {
    id: 'deportes',
    nombre: 'Deportes y aire libre',
    icono: '⚽',
    descripcion: 'Bicicletas, fitness, camping, pesca',
    riesgoLegal: 'medio',
    permitePago: true,
    subcategorias: ['Bicicletas', 'Fitness', 'Camping y pesca', 'Deportes de equipo', 'Indumentaria deportiva'],
    avisosLegales: [
      'Está prohibida la venta de armas de fuego, balas y munición.',
      'Suplementos deportivos deben tener registro ANMAT y declarar composición.'
    ]
  },
  {
    id: 'juguetes',
    nombre: 'Juguetes y bebés',
    icono: '🧸',
    descripcion: 'Juguetes, ropa bebé, cunas, sillas auto',
    riesgoLegal: 'extremo',
    permitePago: true,
    subcategorias: ['Juguetes', 'Indumentaria bebé', 'Cunas y muebles', 'Sillas de auto', 'Cochecitos', 'Mamaderas y chupetes'],
    avisosLegales: [
      '🚨 Sillas de auto, cunas y andadores DEBEN tener certificación IRAM 3680/3641.',
      'Mamaderas y chupetes deben ser libres de BPA (Res. 754/12).',
      'Juguetes para menores de 3 años no pueden tener piezas pequeñas (riesgo de asfixia).',
      'Está prohibida la venta de andadores en algunas provincias.'
    ]
  },
  {
    id: 'mascotas',
    nombre: 'Mascotas',
    icono: '🐾',
    descripcion: 'Alimento, accesorios, juguetes (NO animales vivos)',
    riesgoLegal: 'alto',
    permitePago: true,
    subcategorias: ['Alimento balanceado', 'Accesorios', 'Higiene y salud', 'Camas y transporte', 'Juguetes'],
    avisosLegales: [
      '🚨 Está PROHIBIDA la venta de animales vivos (Ley 14.346).',
      'Alimento balanceado requiere registro SENASA. Declaralo en el producto.',
      'Productos veterinarios con receta requieren matrícula veterinaria.'
    ]
  },
  {
    id: 'automotor',
    nombre: 'Automotor y motos',
    icono: '🚗',
    descripcion: 'Vehículos, repuestos, accesorios — Solo contacto',
    riesgoLegal: 'extremo',
    permitePago: false, // Solo contacto, sin pago integrado por riesgo de fraude
    subcategorias: ['Autos', 'Motos', 'Repuestos', 'Accesorios', 'Cuatriciclos'],
    avisosLegales: [
      '🚨 Esta categoría no permite pago integrado. Las transacciones se realizan entre privados.',
      'Vendedor debe tener cédula a su nombre y vehículo libre de prenda.',
      'MercadoLocal NO participa en la operación ni garantiza el vehículo.',
      'Recomendamos verificar el vehículo personalmente antes de pagar cualquier seña.'
    ]
  },
  {
    id: 'agro',
    nombre: 'Agro y rural',
    icono: '🌾',
    descripcion: 'Alambres, postes, semillas, herramientas, forrajes',
    riesgoLegal: 'medio',
    permitePago: true,
    subcategorias: ['Insumos', 'Herramientas', 'Forrajes', 'Semillas', 'Alambres y cercos', 'Riego'],
    avisosLegales: [
      'Agroquímicos restringidos requieren habilitación SENASA.',
      'Está prohibida la venta de animales vivos (Ley 14.346).',
      'Semillas modificadas genéticamente requieren autorización INASE.'
    ]
  },
  {
    id: 'herramientas',
    nombre: 'Herramientas',
    icono: '🔧',
    descripcion: 'Eléctricas, manuales, medición, ferretería',
    riesgoLegal: 'bajo',
    permitePago: true,
    subcategorias: ['Eléctricas', 'Manuales', 'Medición', 'Ferretería', 'Soldadura'],
    avisosLegales: [
      'Herramientas eléctricas deben tener sello de seguridad eléctrica (S).'
    ]
  },
  {
    id: 'jardin',
    nombre: 'Jardín y exterior',
    icono: '🌱',
    descripcion: 'Plantas, riego, parrillas, exterior',
    riesgoLegal: 'bajo',
    permitePago: true,
    subcategorias: ['Plantas', 'Herramientas de jardín', 'Riego', 'Parrillas y exterior', 'Macetas'],
    avisosLegales: []
  },
  {
    id: 'arte',
    nombre: 'Arte y manualidades',
    icono: '🎨',
    descripcion: 'Pinturas, telas, cerámica, materiales',
    riesgoLegal: 'bajo',
    permitePago: true,
    subcategorias: ['Pintura artística', 'Manualidades', 'Costura y tejido', 'Cerámica', 'Material escolar'],
    avisosLegales: [
      'Productos para uso infantil deben ser no tóxicos.'
    ]
  },
  {
    id: 'libros',
    nombre: 'Libros y educación',
    icono: '📚',
    descripcion: 'Libros físicos, material didáctico, cursos',
    riesgoLegal: 'bajo',
    permitePago: true,
    subcategorias: ['Libros', 'Material didáctico', 'Cursos', 'Útiles escolares'],
    avisosLegales: [
      'Está prohibido vender libros pirateados o copias escaneadas (Ley 11.723).'
    ]
  }
]

/**
 * Helpers para usar las categorías en componentes
 */

/** Obtener categoría por id (slug) */
export function getCategoria(id: string): Categoria | undefined {
  return CATEGORIAS.find(c => c.id === id)
}

/** Obtener nombre legible de una categoría */
export function getNombreCategoria(id: string): string {
  return getCategoria(id)?.nombre || id
}

/** Lista solo de nombres (compat con el código viejo que usaba string[]) */
export const NOMBRES_CATEGORIAS = CATEGORIAS.map(c => c.nombre)

/** Lista de IDs (slugs) */
export const IDS_CATEGORIAS = CATEGORIAS.map(c => c.id)

/** Categorías que requieren atención especial (alto/extremo riesgo) */
export const CATEGORIAS_RIESGOSAS = CATEGORIAS.filter(c => c.riesgoLegal === 'alto' || c.riesgoLegal === 'extremo')

/** Categorías que NO permiten pago integrado (solo contacto) */
export const CATEGORIAS_SIN_PAGO = CATEGORIAS.filter(c => !c.permitePago)

/**
 * Categorías donde el código de barras es OBLIGATORIO.
 * IMPORTANTE: debe coincidir con la lista del backend (productoService.js).
 * Si cambia acá, cambialo allá también.
 */
export const CATEGORIAS_CODIGO_BARRAS_OBLIGATORIO = new Set([
  'electronica',       // detección de IMEI/serial bloqueados
  'alimentos',         // RNPA va en el código
  'belleza',           // verificación ANMAT
  'electrodomesticos'  // garantía oficial requiere serie
])

/** True si esta categoría requiere código de barras obligatorio */
export function requiereCodigoBarras(catId: string): boolean {
  return CATEGORIAS_CODIGO_BARRAS_OBLIGATORIO.has(catId)
}
