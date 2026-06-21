/**
 * Optimización de imágenes de Cloudinary "al vuelo" (sin re-subir nada).
 *
 * Las fotos se suben a Cloudinary en su resolución original (hasta 1600px de
 * lado), pero en las tarjetas, banners y miniaturas se muestran mucho más chicas
 * (144–250px). Servir el original desperdicia ancho de banda: PageSpeed reportaba
 * ~155 KiB de ahorro solo en la home (imágenes de 674×1200 mostradas a 144px).
 *
 * Cloudinary permite pedir una versión transformada insertando parámetros en la
 * URL, justo después de `/image/upload/`. La genera y la cachea en su CDN:
 *   .../image/upload/f_auto,q_auto,c_limit,w_400/v123/carpeta/foto.jpg
 *
 * Transformaciones que aplicamos:
 *   - f_auto  → formato moderno (WebP/AVIF) según el navegador
 *   - q_auto  → calidad automática (recorta bytes sin pérdida visible)
 *   - c_limit → solo achica si la original es más grande (nunca escala hacia arriba)
 *   - w_<n>   → ancho objetivo en px (con margen para pantallas retina)
 *
 * Es defensiva: si la URL no es de Cloudinary (Unsplash, placeholder, data URL,
 * vacía) o ya trae una transformación, la devuelve intacta.
 */

const MARCADOR = '/image/upload/'

// Prefijos de parámetros de transformación de Cloudinary (w_, h_, c_, f_, q_, …).
// Sirven para detectar si el primer segmento ya es una transformación y no duplicar.
const PREFIJO_TRANSFORM = /^(w|h|c|f|q|g|e|r|ar|dpr|b|co|fl|l|o|t|x|y|z|a)_/

/**
 * Devuelve la URL de Cloudinary optimizada al ancho de visualización indicado.
 * Para cualquier otra URL (o entrada vacía) devuelve el valor tal cual.
 *
 * @param url    URL original de la imagen
 * @param ancho  Ancho de visualización en px (default 400, buen valor para tarjetas)
 */
export function imgCloudinary(url: string | undefined | null, ancho = 400): string {
  if (!url || typeof url !== 'string') return url || ''

  const i = url.indexOf(MARCADOR)
  if (i === -1) return url // no es una URL de Cloudinary con /image/upload/

  const inicio = url.slice(0, i + MARCADOR.length)
  const resto = url.slice(i + MARCADOR.length)
  const primerSegmento = resto.split('/')[0]

  // ¿El primer segmento ya es una transformación? (lista con comas, o un único
  // parámetro tipo "w_400"). Ojo: "v1781617756" es la versión, NO una transform.
  const esVersion = /^v\d+$/.test(primerSegmento)
  const yaTransformado =
    !esVersion && (primerSegmento.includes(',') || PREFIJO_TRANSFORM.test(primerSegmento))
  if (yaTransformado) return url

  const transform = `f_auto,q_auto,c_limit,w_${ancho}`
  return `${inicio}${transform}/${resto}`
}
