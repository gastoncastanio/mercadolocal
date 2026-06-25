/**
 * ADN de marca de MercadoLocal — FUENTE ÚNICA de verdad que leen todos los
 * agentes del cerebro (Valentina genera, Mati/Diego verifican). Centralizar acá
 * la identidad evita que cada agente "invente" la marca por su cuenta.
 *
 * Diseñado PER-CIUDAD desde el día 1 (visión a 10 años): cuando se abra otra
 * ciudad, se agrega su entrada en CIUDADES y el motor creativo localiza solo,
 * sin tocar a los agentes.
 */

export const VERSION_ADN = '1.0.0'

export const MARCA = {
  nombre: 'MercadoLocal',
  logo: 'un carrito de compras + el wordmark "MercadoLocal"',
  paleta: {
    azul: '#2563eb',
    violeta: '#7c3aed',
    gradiente: 'gradiente azul #2563eb → violeta #7c3aed',
    neutros: 'blanco y crema'
  },
  // Detalle de marca que aparece en cada escena para que todo pertenezca al mismo mundo.
  objetoMarca: 'la caja y/o la mochila de envío en VIOLETA (#7c3aed); si hay un celular, muestra una app de marketplace limpia y moderna con acentos azul-violeta',
  voz: 'español rioplatense (vos), cálido, cercano, de pueblo, sin solemnidad ni cliché publicitario'
}

export const CIUDAD_DEFECTO = 'lobos'

export const CIUDADES = {
  lobos: {
    nombre: 'Lobos',
    provincia: 'Buenos Aires',
    pais: 'Argentina',
    ambiente:
      'Pueblo LLANO de la pampa bonaerense. Terreno completamente plano, cielo MUY amplio. ' +
      'Calles ANCHAS de asfalto gastado o de tierra, veredas con árboles (plátanos, paraísos). ' +
      'Casas BAJAS de UNA sola planta, frentes revocados y pintados (blanco, beige, celeste), ' +
      'rejas simples en las ventanas. Comercios de barrio sencillos con toldos lisos. ' +
      'Autos comunes y viejos (Renault 12, Fiat), motos, bicicletas. Gente argentina común y ' +
      'diversa, ropa cotidiana, a veces un mate en la mano. Luz de sol fuerte.',
    landmarks:
      'La Plaza 1810, frente a la Iglesia Nuestra Señora del Carmen (fachada revocada clara con ' +
      'campanario). Dos araucarias antiguas, altas y oscuras, que enmarcan la plaza. En el centro, ' +
      'el Monumento a la Madre con su fuente. Alrededor, edificios bajos italianizantes.'
  }
}

// Lo que SIEMPRE hay que evitar para que el modelo no se vaya al cliché europeo
// (el error #1 que detectamos generando: villa mediterránea en vez de pueblo pampeano).
export const EVITAR =
  'NO calles empedradas ni adoquines. NO edificios de piedra europeos. NO balcones de hierro ' +
  'ornamentados. NO colinas ni montañas. NO callejones medievales. NADA de estética española, ' +
  'italiana o mediterránea de casco antiguo. NO catedrales antiguas. NO texto legible en carteles. ' +
  'NO modelos de stock perfectos.'

export const ESTILO_FOTO =
  'Fotografía publicitaria ultrarrealista y cinematográfica. Luz natural cálida, profundidad de ' +
  'campo (sujeto nítido, fondo desenfocado), color rico, leve grano de cámara, look 8k, lente ' +
  '35-50mm. Encuadre VERTICAL 9:16, con un lado despejado (cielo o pared lisa) para sumar texto ' +
  'después. SIN texto ni logo quemado en la imagen — el logo se agrega en el armado (capa fija).'

// Cada "caso" = una FUNCIÓN específica del embudo. El prompt tiene que cumplirla.
export const CASOS = {
  awareness: 'Dar a conocer la app y el orgullo local (top of funnel). "Tu pueblo, en tu celular".',
  usados: 'Activar la oferta de usados (el motor de tráfico). "Vendé lo que no usás".',
  envio: 'Comunicar el envío local en el día por comisionista (el foso del negocio). "Te llega hoy".',
  confianza: 'Bajar el miedo a comprar online. "Pagá seguro, compra protegida".',
  comprar_local: 'Mostrar la variedad de comercios del pueblo. "Las tiendas de tu ciudad, en un lugar".',
  sumar_comercio: 'Reclutar comercios locales (plan tiendas locales). "Sumá tu comercio".',
  tile_categoria: 'Foto de producto representativo para el tile de una categoría: producto real sobre fondo BLANCO, estilo e-commerce (acá NO aplica la escena de pueblo).',
  empty_state: 'Escena para una pantalla vacía (carrito vacío, sin resultados), cálida y de marca.'
}

/** Render del ADN como bloque de texto para inyectar en el system prompt de los agentes. */
export function adnComoTexto(ciudadSlug = CIUDAD_DEFECTO) {
  const c = CIUDADES[ciudadSlug] || CIUDADES[CIUDAD_DEFECTO]
  return `# ADN de marca MercadoLocal (v${VERSION_ADN}) — ciudad: ${c.nombre}, ${c.provincia}, ${c.pais}

## Marca
- Logo: ${MARCA.logo}.
- Paleta: ${MARCA.paleta.gradiente}, ${MARCA.paleta.neutros}.
- Objeto de marca en cada escena: ${MARCA.objetoMarca}.
- Voz: ${MARCA.voz}.

## Ambiente real de ${c.nombre} (anclá TODO acá, esto es lo que hace que parezca real y no genérico)
${c.ambiente}
Referencias reconocibles: ${c.landmarks}

## EVITAR SIEMPRE (esto mata el look europeo/genérico)
${EVITAR}

## Estilo de foto
${ESTILO_FOTO}`
}

/** Devuelve la descripción de la función de un caso (o lista los casos válidos). */
export function descripcionCaso(caso) {
  return CASOS[caso] || null
}
