export function generarPromptsParaLogos(marcaInfo) {
  const {
    nombreMarca,
    descripcion,
    valores = [],
    estilo,
    parametros = {},
  } = marcaInfo

  const {
    coloresPrimarios = ['#000000'],
    coloresSecundarios = [],
    tipografia = 'modern',
    elementos = [],
    complejidad = 'medium',
    orientacion = 'square',
  } = parametros

  const coloresTexto = coloresPrimarios.length > 0
    ? coloresPrimarios.map(c => c.replace('#', '')).join(', ')
    : 'negro y blanco'

  const valoresTexto = valores.length > 0 ? `Valores de marca: ${valores.join(', ')}.` : ''
  const elementosTexto = elementos.length > 0 ? `Elementos clave: ${elementos.join(', ')}.` : ''

  // Configuración por estilo
  const estiloConfig = {
    minimalista: 'Minimalista, limpio, líneas simples, muy poco detalle',
    moderno: 'Moderno, dinámico, líneas contemporáneas, geométrico',
    clasico: 'Clásico, atemporal, elegante, tradicional',
    corporativo: 'Profesional, corporativo, confiable, serio',
    creativo: 'Creativo, artístico, colorido, imaginativo',
    tech: 'Futurista, tech, digital, innovador, moderno',
    vintage: 'Vintage, retro, nostálgico, histórico',
    geometrico: 'Geométrico, formas básicas, matemático, preciso',
    elegante: 'Elegante, lujoso, sofisticado, premium',
    jugueton: 'Juguetón, divertido, amigable, colorido',
  }

  const estiloDescripcion = estiloConfig[estilo] || 'profesional y único'

  const promptBase = `CREA UN LOGO PROFESIONAL ÚNICO Y DE ALTA CALIDAD para la marca "${nombreMarca}".

INFORMACIÓN DE LA MARCA:
- Descripción: ${descripcion}
${valoresTexto}
${elementosTexto}

ESPECIFICACIONES TÉCNICAS:
- Estilo visual: ${estiloDescripcion}
- Paleta de colores: ${coloresTexto}
- Complejidad: ${complejidad}
- Formato: ${orientacion}

REQUISITOS OBLIGATORIOS:
✓ Logo SOLO VISUAL (sin texto ni letras)
✓ Icono/símbolo independiente que represente la marca
✓ Profesional, memorable y atemporal
✓ Escalable (funciona en pequeño y grande)
✓ Adecuado para web, impresión y redes sociales
✓ Alta calidad, detalles claros
✓ Colores vibrantes y atractivos

ESTILO: ${estiloDescripcion}`

  // Generar 12 variaciones con diferentes enfoques y perspectivas
  const prompts = [
    `${promptBase}\n\nVARIACIÓN 1: Icono minimalista con solo formas básicas. Muy limpio.`,
    `${promptBase}\n\nVARIACIÓN 2: Diseño geométrico con formas triangulares y círculos.`,
    `${promptBase}\n\nVARIACIÓN 3: Icono abstracto e innovador, muy moderno.`,
    `${promptBase}\n\nVARIACIÓN 4: Logo con un símbolo natural (animal, planta, etc).`,
    `${promptBase}\n\nVARIACIÓN 5: Logo con elementos que representen la industria/sector.`,
    `${promptBase}\n\nVARIACIÓN 6: Versión con degradado de colores y efecto 3D sutil.`,
    `${promptBase}\n\nVARIACIÓN 7: Monograma elegante usando iniciales estilizadas.`,
    `${promptBase}\n\nVARIACIÓN 8: Icono redondeado y amigable, muy accesible.`,
    `${promptBase}\n\nVARIACIÓN 9: Versión corporativa seria y profesional. Muy formal.`,
    `${promptBase}\n\nVARIACIÓN 10: Logo con movimiento, dinamismo y energía.`,
    `${promptBase}\n\nVARIACIÓN 11: Diseño retro o vintage con toques nostálgicos.`,
    `${promptBase}\n\nVARIACIÓN 12: Futurista y high-tech con líneas modernas.`,
  ]

  return prompts
}

export function generarPromptsParaVariaciones(logoInfo, cambios) {
  const {
    nombreMarca,
    estilo,
    parametros = {},
  } = logoInfo

  const {
    coloresPrimarios = [],
  } = cambios

  const coloresTexto = coloresPrimarios.length > 0
    ? `Cambia los colores a: ${coloresPrimarios.join(' y ')}`
    : 'Mantén los colores originales'

  return [
    `Variación del logo de "${nombreMarca}": ${coloresTexto}. Estilo ${estilo}.`,
    `Crea una versión alternativa del mismo logo con diferentes proporciones.`,
    `Versión monocromática del logo para "${nombreMarca}".`,
    `Versión invertida (colores negativos) del logo.`,
  ]
}
