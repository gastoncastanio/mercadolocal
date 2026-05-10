/**
 * Utility centralizada para subida de imágenes a Cloudinary vía backend.
 *
 * Resuelve los problemas que tenía el flujo anterior:
 * - HEIC/HEIF de iPhone se rechazaban → ahora se aceptan y se convierten a JPEG
 * - Fotos de >5MB fallaban → ahora se comprimen client-side antes de subir
 * - Errores de red rompían el flujo → ahora hay 3 reintentos automáticos
 * - "Subiendo..." sin progreso → ahora hay barra real con %
 * - Mensajes de error genéricos → ahora son específicos al problema
 */

import imageCompression from 'browser-image-compression'
import api from '../services/api'

export interface UploadProgress {
  step: 'comprimiendo' | 'subiendo' | 'completado' | 'error'
  porcentaje: number
  mensaje: string
}

export interface UploadResult {
  url: string
  publicId: string
  width?: number
  height?: number
}

// Tipos MIME aceptados (HEIC incluido para iPhone)
const TIPOS_VALIDOS = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/bmp', 'image/heic', 'image/heif'
]

// Algunos navegadores no setean el MIME para HEIC; validamos por extensión también
const EXTENSIONES_VALIDAS = /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/i

// Límites
const TAMANIO_MAX_INICIAL_MB = 50  // techo absoluto antes de intentar comprimir
const TAMANIO_OBJETIVO_MB = 1.5    // tamaño después de comprimir
const RESOLUCION_MAX_PX = 1600     // resolución máxima del lado más largo
const TIMEOUT_UPLOAD_MS = 60000    // 60s para uploads (cold start de Railway puede demorar)
const MAX_INTENTOS = 3
const DELAY_RETRY_MS = 1500        // 1.5s base, se multiplica por intento (1.5s, 3s, 4.5s)

/**
 * Sube una imagen al servidor con compresión client-side y reintentos automáticos.
 *
 * @param archivo - Archivo a subir (acepta HEIC, JPG, PNG, etc.)
 * @param onProgress - Callback opcional para mostrar progreso al usuario
 * @returns URL pública del archivo subido en Cloudinary
 * @throws Error con mensaje legible si falla definitivamente
 */
export async function subirImagenOptimizada(
  archivo: File,
  onProgress?: (p: UploadProgress) => void
): Promise<UploadResult> {
  // ===== PASO 1: Validaciones tempranas =====
  if (archivo.size > TAMANIO_MAX_INICIAL_MB * 1024 * 1024) {
    throw new Error(
      `La imagen es demasiado grande (${(archivo.size / 1024 / 1024).toFixed(1)}MB). ` +
      `Máximo permitido: ${TAMANIO_MAX_INICIAL_MB}MB.`
    )
  }

  const esTipoValido =
    TIPOS_VALIDOS.includes(archivo.type) ||
    EXTENSIONES_VALIDAS.test(archivo.name)

  if (!esTipoValido) {
    throw new Error('Formato no soportado. Usá JPG, PNG, GIF, WebP o HEIC (iPhone).')
  }

  // ===== PASO 2: Compresión =====
  onProgress?.({
    step: 'comprimiendo',
    porcentaje: 5,
    mensaje: 'Optimizando imagen...'
  })

  // browser-image-compression también convierte HEIC → JPEG automáticamente
  // si el navegador tiene el codec disponible
  const opcionesCompresion = {
    maxSizeMB: TAMANIO_OBJETIVO_MB,
    maxWidthOrHeight: RESOLUCION_MAX_PX,
    useWebWorker: true,
    fileType: 'image/jpeg', // siempre exportar JPEG para máxima compatibilidad
    onProgress: (porcentaje: number) => {
      // mapear 0-100 de compresión a 5-40 de la barra total
      onProgress?.({
        step: 'comprimiendo',
        porcentaje: 5 + Math.round(porcentaje * 0.35),
        mensaje: 'Optimizando imagen...'
      })
    }
  }

  let archivoFinal: File
  try {
    archivoFinal = await imageCompression(archivo, opcionesCompresion)
  } catch (error: any) {
    // Si la compresión falla (ej. HEIC sin codec en el navegador),
    // intentar subir el original solo si está dentro del límite del servidor (15MB)
    console.warn('Compresión falló, intentando subir original:', error?.message)
    if (archivo.size > 12 * 1024 * 1024) {
      throw new Error(
        'No pudimos optimizar la imagen y es muy grande. ' +
        'Intentá con una foto más liviana o sacá una nueva.'
      )
    }
    archivoFinal = archivo
  }

  // ===== PASO 3: Subida con reintentos =====
  let ultimoError: any = null

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      onProgress?.({
        step: 'subiendo',
        porcentaje: 40,
        mensaje: intento === 1
          ? 'Subiendo imagen...'
          : `Reintentando (${intento}/${MAX_INTENTOS})...`
      })

      const formData = new FormData()
      formData.append('imagen', archivoFinal)

      const res = await api.post('/upload/imagen', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: TIMEOUT_UPLOAD_MS,
        onUploadProgress: (e) => {
          if (e.total) {
            const pctReal = (e.loaded / e.total) * 100
            const pctBarra = 40 + Math.round(pctReal * 0.55) // mapear a 40-95%
            onProgress?.({
              step: 'subiendo',
              porcentaje: pctBarra,
              mensaje: `Subiendo... ${Math.round(pctReal)}%`
            })
          }
        }
      })

      onProgress?.({
        step: 'completado',
        porcentaje: 100,
        mensaje: 'Lista'
      })

      return {
        url: res.data.url,
        publicId: res.data.publicId,
        width: res.data.width,
        height: res.data.height
      }
    } catch (error: any) {
      ultimoError = error

      // Errores 4xx (validación del servidor) NO se reintentan
      // Estos son: archivo inválido, tamaño excedido, formato no soportado
      const status = error.response?.status
      if (status >= 400 && status < 500) {
        const mensajeServidor = error.response?.data?.error
        throw new Error(mensajeServidor || 'La imagen no fue aceptada por el servidor.')
      }

      // Errores 5xx o timeout o red: reintentar con backoff
      if (intento < MAX_INTENTOS) {
        await new Promise(r => setTimeout(r, DELAY_RETRY_MS * intento))
      }
    }
  }

  // Si llegamos acá, los 3 intentos fallaron
  const mensajeFinal =
    ultimoError?.response?.data?.error ||
    ultimoError?.message ||
    'Error desconocido'

  throw new Error(
    `No pudimos subir la imagen después de ${MAX_INTENTOS} intentos. ` +
    `Verificá tu conexión a internet. (${mensajeFinal})`
  )
}

/**
 * Sube múltiples imágenes secuencialmente con reporte de progreso global.
 * Si una falla, sigue con las demás y reporta los errores al final.
 */
export async function subirMultiplesImagenes(
  archivos: File[],
  onProgresoTotal?: (info: { actualIndex: number; total: number; nombreActual: string }) => void,
  onProgresoIndividual?: (p: UploadProgress) => void
): Promise<{ exitos: UploadResult[]; errores: { archivo: string; mensaje: string }[] }> {
  const exitos: UploadResult[] = []
  const errores: { archivo: string; mensaje: string }[] = []

  for (let i = 0; i < archivos.length; i++) {
    onProgresoTotal?.({
      actualIndex: i,
      total: archivos.length,
      nombreActual: archivos[i].name
    })

    try {
      const resultado = await subirImagenOptimizada(archivos[i], onProgresoIndividual)
      exitos.push(resultado)
    } catch (e: any) {
      errores.push({ archivo: archivos[i].name, mensaje: e.message })
    }
  }

  return { exitos, errores }
}
