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

/**
 * Campo personalizado de una categoría.
 * Se guarda en Producto.caracteristicas como { clave: id, valor: string }
 */
export interface CampoCategoria {
  /** Slug del campo. Se guarda en BD como `clave`. */
  id: string
  /** Label visible al vendedor */
  label: string
  /** Tipo de input. Define cómo se renderiza */
  tipo: 'texto' | 'numero' | 'fecha' | 'select' | 'boolean' | 'textarea'
  /** Si es obligatorio para publicar */
  obligatorio: boolean
  /** Placeholder visible en el input */
  placeholder?: string
  /** Para tipo 'select': lista de opciones */
  opciones?: string[]
  /** Texto de ayuda mostrado debajo del input */
  ayuda?: string
  /** Para tipo 'numero': mínimo */
  min?: number
  /** Para tipo 'numero': máximo */
  max?: number
  /** Para tipo 'texto': longitud máxima */
  maxLength?: number
}

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
  /** Campos personalizados que el vendedor debe/puede llenar al publicar */
  campos?: CampoCategoria[]
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
    ],
    campos: [
      { id: 'unidad', label: 'Unidad de venta', tipo: 'select', obligatorio: true,
        opciones: ['Por unidad', 'Por metro', 'Por m²', 'Por m³', 'Por kg', 'Por bolsa', 'Por palet'],
        ayuda: 'Cómo se vende este producto' },
      { id: 'cantidad_minima', label: 'Cantidad mínima de compra', tipo: 'numero', obligatorio: false,
        min: 1, placeholder: '1', ayuda: 'Si tenés mínimo de compra, indicalo' },
      { id: 'material', label: 'Material principal', tipo: 'texto', obligatorio: false, maxLength: 60,
        placeholder: 'Ej: Hierro galvanizado, Madera, Cerámica' },
      { id: 'libre_plomo', label: '¿Libre de plomo?', tipo: 'boolean', obligatorio: false,
        ayuda: 'Para pinturas. Es ley desde 2015.' }
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
    ],
    campos: [
      { id: 'estado', label: 'Estado', tipo: 'select', obligatorio: true,
        opciones: ['Nuevo', 'Usado - como nuevo', 'Usado - bueno', 'Usado - aceptable'] },
      { id: 'material', label: 'Material', tipo: 'texto', obligatorio: false, maxLength: 60,
        placeholder: 'Ej: Madera, Tela, Cuero, Vidrio' },
      { id: 'medidas', label: 'Medidas (alto × ancho × profundidad)', tipo: 'texto', obligatorio: false, maxLength: 60,
        placeholder: 'Ej: 80 × 200 × 90 cm' },
      { id: 'color', label: 'Color', tipo: 'texto', obligatorio: false, maxLength: 30,
        placeholder: 'Ej: Marrón, Blanco' },
      { id: 'necesita_armado', label: '¿Necesita armado?', tipo: 'boolean', obligatorio: false }
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
    ],
    campos: [
      { id: 'estado', label: 'Estado', tipo: 'select', obligatorio: true,
        opciones: ['Nuevo (caja sellada)', 'Nuevo (sin caja)', 'Usado - como nuevo', 'Usado - bueno', 'Reacondicionado'] },
      { id: 'garantia_oficial', label: '¿Tiene garantía oficial de fábrica?', tipo: 'boolean', obligatorio: false,
        ayuda: 'Si está activada, el comprador puede reclamar al fabricante directo' },
      { id: 'meses_garantia', label: 'Meses de garantía (la tuya)', tipo: 'numero', obligatorio: false,
        min: 0, max: 60, placeholder: '3',
        ayuda: 'Por ley los usados tienen mínimo 3 meses' },
      { id: 'eficiencia_energetica', label: 'Eficiencia energética', tipo: 'select', obligatorio: false,
        opciones: ['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'No aplica'],
        ayuda: 'Obligatorio en heladeras, lavarropas, aires (Ley 25.018)' },
      { id: 'voltaje', label: 'Voltaje', tipo: 'select', obligatorio: false,
        opciones: ['220V', '110V', 'Bivolt (110V/220V)'] }
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
    ],
    campos: [
      { id: 'estado', label: 'Estado', tipo: 'select', obligatorio: true,
        opciones: ['Nuevo (caja sellada)', 'Nuevo (sin caja)', 'Usado - como nuevo', 'Usado - bueno', 'Usado - con detalles', 'Reacondicionado'] },
      { id: 'imei', label: 'IMEI / Número de serie', tipo: 'texto', obligatorio: false, maxLength: 30,
        placeholder: '15 dígitos (marcá *#06# en el celu)',
        ayuda: '⚠️ Importante: validamos contra base de robados. Vender un IMEI bloqueado es delito.' },
      { id: 'libre_imei', label: '¿IMEI libre (no bloqueado por ENACOM)?', tipo: 'boolean', obligatorio: false,
        ayuda: 'Verificalo en www.gestion.enacom.gob.ar antes de publicar' },
      { id: 'cuenta_bloqueada', label: '¿iCloud / Google Account bloqueada?', tipo: 'boolean', obligatorio: false,
        ayuda: 'Si está bloqueada el comprador no podrá usarla. Declaralo.' },
      { id: 'garantia_oficial', label: '¿Tiene garantía oficial Argentina?', tipo: 'boolean', obligatorio: false },
      { id: 'accesorios_incluidos', label: 'Accesorios incluidos', tipo: 'texto', obligatorio: false, maxLength: 100,
        placeholder: 'Ej: Cargador original, cable USB-C, caja' }
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
    ],
    campos: [
      { id: 'talle', label: 'Talle', tipo: 'texto', obligatorio: true, maxLength: 20,
        placeholder: 'Ej: M, 42, S/M, XL', ayuda: 'Indicá el talle estándar' },
      { id: 'genero', label: 'Género', tipo: 'select', obligatorio: true,
        opciones: ['Mujer', 'Hombre', 'Unisex', 'Niña', 'Niño', 'Bebé'] },
      { id: 'color', label: 'Color', tipo: 'texto', obligatorio: false, maxLength: 30 },
      { id: 'material', label: 'Material', tipo: 'texto', obligatorio: false, maxLength: 60,
        placeholder: 'Ej: 100% algodón, 80% poliéster' },
      { id: 'estado', label: 'Estado', tipo: 'select', obligatorio: true,
        opciones: ['Nuevo con etiqueta', 'Nuevo sin etiqueta', 'Usado - como nuevo', 'Usado - bueno', 'Usado - aceptable'] },
      { id: 'es_replica', label: '¿Es réplica/no original?', tipo: 'boolean', obligatorio: false,
        ayuda: '⚠️ Si la marca es original (Nike, Adidas, etc.) y es réplica, debés declararlo o es delito.' }
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
    ],
    campos: [
      { id: 'vencimiento', label: 'Fecha de vencimiento', tipo: 'fecha', obligatorio: true,
        ayuda: 'Productos vencidos no se pueden vender' },
      { id: 'registro_anmat', label: 'Registro ANMAT', tipo: 'texto', obligatorio: false, maxLength: 30,
        placeholder: 'Ej: Disp. 123/2023', ayuda: 'Obligatorio para cosméticos importados' },
      { id: 'volumen', label: 'Volumen / Contenido', tipo: 'texto', obligatorio: false, maxLength: 30,
        placeholder: 'Ej: 100ml, 50g' },
      { id: 'estado', label: 'Estado', tipo: 'select', obligatorio: true,
        opciones: ['Nuevo cerrado', 'Nuevo abierto', 'Usado parcialmente'] },
      { id: 'tipo_piel', label: 'Tipo de piel / cabello (si aplica)', tipo: 'select', obligatorio: false,
        opciones: ['Todo tipo', 'Piel grasa', 'Piel seca', 'Piel mixta', 'Piel sensible', 'Cabello graso', 'Cabello seco', 'Cabello teñido'] }
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
    ],
    campos: [
      { id: 'vencimiento', label: 'Fecha de vencimiento', tipo: 'fecha', obligatorio: true,
        ayuda: 'Productos vencidos no se pueden vender' },
      { id: 'tiene_habilitacion', label: '¿Tenés habilitación bromatológica municipal?', tipo: 'boolean', obligatorio: true,
        ayuda: '🚨 Obligatorio por ley para vender alimentos' },
      { id: 'rnpa', label: 'Número RNPA (para envasados)', tipo: 'texto', obligatorio: false, maxLength: 30,
        placeholder: 'Ej: RNPA 0123456', ayuda: 'Obligatorio en productos envasados' },
      { id: 'peso_volumen', label: 'Peso / Volumen', tipo: 'texto', obligatorio: true, maxLength: 30,
        placeholder: 'Ej: 500g, 1kg, 750ml' },
      { id: 'alergenos', label: 'Alérgenos que contiene', tipo: 'texto', obligatorio: true, maxLength: 200,
        placeholder: 'Ej: Contiene gluten, lácteos, frutos secos',
        ayuda: '🚨 Por Res. 2343/14. Declarar TACC, lácteos, frutos secos, soja, huevo, mariscos' },
      { id: 'es_perecedero', label: '¿Es perecedero (requiere frío)?', tipo: 'boolean', obligatorio: false,
        ayuda: 'Si es perecedero, solo entregá en el día y en tu zona' },
      { id: 'es_alcohol', label: '¿Contiene alcohol?', tipo: 'boolean', obligatorio: false,
        ayuda: 'Solo venta a mayores de 18 años' }
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
    ],
    campos: [
      { id: 'estado', label: 'Estado', tipo: 'select', obligatorio: true,
        opciones: ['Nuevo', 'Usado - como nuevo', 'Usado - bueno', 'Usado - con uso'] },
      { id: 'talle_o_medida', label: 'Talle / Medida (si aplica)', tipo: 'texto', obligatorio: false, maxLength: 30,
        placeholder: 'Ej: Rodado 26, Talle 42, M' },
      { id: 'marca_modelo', label: 'Marca y modelo', tipo: 'texto', obligatorio: false, maxLength: 80 }
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
    ],
    campos: [
      { id: 'edad_recomendada', label: 'Edad recomendada', tipo: 'select', obligatorio: true,
        opciones: ['0-6 meses', '6-12 meses', '1-2 años', '2-3 años', '3-5 años', '5-8 años', '8-12 años', '12+ años', 'Todas las edades'] },
      { id: 'tiene_piezas_pequenas', label: '¿Tiene piezas pequeñas?', tipo: 'boolean', obligatorio: true,
        ayuda: '🚨 Si es para <3 años, las piezas pequeñas son riesgo de asfixia' },
      { id: 'certificacion_iram', label: 'Certificación IRAM', tipo: 'texto', obligatorio: false, maxLength: 60,
        placeholder: 'Ej: IRAM 3680 para sillas de auto',
        ayuda: 'Obligatorio en sillas auto, cunas, cochecitos, andadores' },
      { id: 'libre_bpa', label: '¿Libre de BPA?', tipo: 'boolean', obligatorio: false,
        ayuda: 'Obligatorio en mamaderas y chupetes (Res. 754/12)' },
      { id: 'estado', label: 'Estado', tipo: 'select', obligatorio: true,
        opciones: ['Nuevo', 'Usado - como nuevo', 'Usado - bueno', 'Usado - aceptable'] }
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
    ],
    campos: [
      { id: 'tipo_mascota', label: 'Para qué mascota', tipo: 'select', obligatorio: true,
        opciones: ['Perros', 'Gatos', 'Aves', 'Peces', 'Roedores', 'Reptiles', 'Caballos', 'Otros'] },
      { id: 'tamanio_mascota', label: 'Tamaño de mascota (si aplica)', tipo: 'select', obligatorio: false,
        opciones: ['Cachorro', 'Pequeño', 'Mediano', 'Grande', 'Gigante', 'Todas'] },
      { id: 'vencimiento', label: 'Vencimiento (alimento/medicamento)', tipo: 'fecha', obligatorio: false,
        ayuda: 'Obligatorio en alimento balanceado y productos veterinarios' },
      { id: 'registro_senasa', label: 'Registro SENASA', tipo: 'texto', obligatorio: false, maxLength: 30,
        placeholder: 'Ej: A-1234', ayuda: 'Obligatorio en alimento balanceado' }
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
    ],
    campos: [
      { id: 'tipo_vehiculo', label: 'Tipo de vehículo', tipo: 'select', obligatorio: true,
        opciones: ['Auto', 'Moto', 'Camioneta', 'Cuatriciclo', 'Repuesto', 'Accesorio'] },
      { id: 'anio', label: 'Año (modelo)', tipo: 'numero', obligatorio: true,
        min: 1950, max: 2030, placeholder: '2018' },
      { id: 'kilometraje', label: 'Kilometraje', tipo: 'numero', obligatorio: false,
        min: 0, max: 9999999, placeholder: '80000', ayuda: 'Solo dígitos, sin puntos' },
      { id: 'marca_modelo', label: 'Marca y modelo', tipo: 'texto', obligatorio: true, maxLength: 100,
        placeholder: 'Ej: Volkswagen Gol 1.6' },
      { id: 'patente', label: 'Patente', tipo: 'texto', obligatorio: false, maxLength: 15,
        placeholder: 'Ej: AB123CD' },
      { id: 'cedula_a_tu_nombre', label: '¿Cédula verde a tu nombre?', tipo: 'boolean', obligatorio: true,
        ayuda: '🚨 Si no está a tu nombre no podés hacer la transferencia' },
      { id: 'libre_prenda', label: '¿Libre de prenda?', tipo: 'boolean', obligatorio: true,
        ayuda: '🚨 Vender un vehículo prendado sin declararlo es estafa' },
      { id: 'declarado_chocado', label: '¿Declarado chocado / siniestrado?', tipo: 'boolean', obligatorio: true,
        ayuda: 'Declaralo aunque haya sido reparado' }
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
    ],
    campos: [
      { id: 'unidad', label: 'Unidad de venta', tipo: 'select', obligatorio: true,
        opciones: ['Por unidad', 'Por kg', 'Por bolsa', 'Por rollo', 'Por metro', 'Por litro', 'Por hectárea'] },
      { id: 'tipo_producto', label: 'Tipo de producto', tipo: 'select', obligatorio: false,
        opciones: ['Insumo', 'Herramienta', 'Forraje', 'Semilla', 'Alambre/cerco', 'Riego', 'Otro'] },
      { id: 'requiere_senasa', label: '¿Requiere habilitación SENASA?', tipo: 'boolean', obligatorio: false,
        ayuda: 'Marcar si es agroquímico restringido o producto veterinario' }
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
    ],
    campos: [
      { id: 'tipo', label: 'Tipo', tipo: 'select', obligatorio: true,
        opciones: ['Eléctrica', 'Manual', 'Medición', 'Soldadura', 'Otra'] },
      { id: 'estado', label: 'Estado', tipo: 'select', obligatorio: true,
        opciones: ['Nuevo', 'Usado - como nuevo', 'Usado - bueno', 'Usado - con uso'] },
      { id: 'sello_seguridad', label: '¿Tiene sello de seguridad eléctrica (S)?', tipo: 'boolean', obligatorio: false,
        ayuda: 'Obligatorio en herramientas eléctricas' },
      { id: 'voltaje', label: 'Voltaje (si es eléctrica)', tipo: 'select', obligatorio: false,
        opciones: ['220V', '110V', 'Inalámbrica/batería'] }
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
    avisosLegales: [],
    campos: [
      { id: 'tipo', label: 'Tipo', tipo: 'select', obligatorio: false,
        opciones: ['Planta', 'Herramienta', 'Riego', 'Parrilla/exterior', 'Maceta', 'Otro'] },
      { id: 'tamanio', label: 'Tamaño', tipo: 'texto', obligatorio: false, maxLength: 40,
        placeholder: 'Ej: Maceta 20cm, planta de 50cm' },
      { id: 'cuidados', label: 'Cuidados (para plantas)', tipo: 'select', obligatorio: false,
        opciones: ['Sol directo', 'Sol parcial', 'Sombra', 'Interior', 'No aplica'] }
    ]
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
    ],
    campos: [
      { id: 'tipo', label: 'Tipo de producto', tipo: 'select', obligatorio: false,
        opciones: ['Material de pintura', 'Tela / costura', 'Cerámica', 'Material escolar', 'Otro'] },
      { id: 'apto_infantil', label: '¿Apto para uso infantil?', tipo: 'boolean', obligatorio: false,
        ayuda: 'Si es para niños, debe ser no tóxico' },
      { id: 'medidas', label: 'Medidas / cantidad', tipo: 'texto', obligatorio: false, maxLength: 60,
        placeholder: 'Ej: 50x70cm, set de 12 colores' }
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
    ],
    campos: [
      { id: 'autor', label: 'Autor', tipo: 'texto', obligatorio: false, maxLength: 100,
        placeholder: 'Ej: Jorge Luis Borges' },
      { id: 'editorial', label: 'Editorial', tipo: 'texto', obligatorio: false, maxLength: 80,
        placeholder: 'Ej: Planeta, Sudamericana' },
      { id: 'idioma', label: 'Idioma', tipo: 'select', obligatorio: false,
        opciones: ['Español', 'Inglés', 'Portugués', 'Francés', 'Italiano', 'Otro'] },
      { id: 'estado', label: 'Estado', tipo: 'select', obligatorio: false,
        opciones: ['Nuevo', 'Usado - como nuevo', 'Usado - bueno', 'Usado - subrayado/marcado'] },
      { id: 'es_original', label: '¿Es libro físico original (no copia)?', tipo: 'boolean', obligatorio: true,
        ayuda: '🚨 Vender copias pirateadas es delito (Ley 11.723)' }
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
