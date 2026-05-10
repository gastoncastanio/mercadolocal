import { Router } from 'express'
import { v2 as cloudinary } from 'cloudinary'
import multer from 'multer'
import { verificarToken } from '../middleware/auth.js'

const router = Router()

// Magic bytes para validar tipos reales de imagen (defensa contra archivos disfrazados)
// HEIC NO se valida por magic bytes porque su firma es variable (depende del codec interno)
const IMAGE_SIGNATURES = {
  'ffd8ff': 'image/jpeg',       // JPEG
  '89504e47': 'image/png',      // PNG
  '47494638': 'image/gif',      // GIF
  '52494646': 'image/webp',     // WebP (RIFF header)
  '424d': 'image/bmp'           // BMP
}

function validarMagicBytes(buffer) {
  const hex = buffer.slice(0, 4).toString('hex')
  return Object.keys(IMAGE_SIGNATURES).some(sig => hex.startsWith(sig))
}

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

// Lista única de tipos MIME aceptados (incluye HEIC/HEIF de iPhone)
const MIME_VALIDOS = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/bmp', 'image/heic', 'image/heif'
]

// Configurar multer para recibir archivos en memoria
// Límite alto (15MB) como techo de seguridad — el frontend comprime antes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB techo de seguridad
  },
  fileFilter: (req, file, cb) => {
    if (MIME_VALIDOS.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Formato ${file.mimetype} no soportado. Usá JPG, PNG, GIF, WebP o HEIC.`), false)
    }
  }
})

// Manejador específico de errores de multer (tamaño, tipo, etc.)
function manejarErrorMulter(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'La imagen pesa más de 15MB. Probá con una foto más liviana.'
      })
    }
    return res.status(400).json({ error: `Error de archivo: ${err.message}` })
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Error procesando el archivo' })
  }
  next()
}

// POST /api/upload/imagen - Subir imagen
// El middleware de multer se envuelve manualmente para capturar errores específicos
// (sin esto, multer responde con stack trace genérico al cliente)
router.post(
  '/imagen',
  verificarToken,
  (req, res, next) => {
    upload.single('imagen')(req, res, (err) => {
      if (err) return manejarErrorMulter(err, req, res, next)
      next()
    })
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se envió ninguna imagen' })
      }

      // HEIC/HEIF tienen firmas variables, omitimos la validación de magic bytes
      // Para el resto, validamos contenido real (defensa contra archivos disfrazados)
      const esHeic = req.file.mimetype === 'image/heic' || req.file.mimetype === 'image/heif'
      if (!esHeic && !validarMagicBytes(req.file.buffer)) {
        return res.status(400).json({ error: 'El archivo no es una imagen válida' })
      }

      // Subir a Cloudinary desde buffer
      // Cloudinary convierte HEIC a JPEG automáticamente vía fetch_format: auto
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'mercadolocal',
            transformation: [
              { width: 1200, height: 1200, crop: 'limit' }, // techo de tamaño
              { quality: 'auto:good' },                      // calidad óptima
              { fetch_format: 'auto' }                       // sirve WebP/AVIF a navegadores compatibles
            ]
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        )
        stream.end(req.file.buffer)
      })

      console.log(`📸 Imagen subida: ${result.secure_url} (${(req.file.size / 1024).toFixed(0)}KB)`)

      res.json({
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height
      })
    } catch (error) {
      console.error('Error subiendo imagen:', error)

      // Errores específicos de Cloudinary
      if (error.http_code === 499 || error.name === 'TimeoutError') {
        return res.status(504).json({
          error: 'La subida tardó demasiado. Intentá con una imagen más liviana.'
        })
      }
      if (error.http_code === 400) {
        return res.status(400).json({
          error: 'La imagen no pudo ser procesada. Probá con otra.'
        })
      }
      if (error.http_code) {
        return res.status(502).json({
          error: 'El servicio de imágenes no está disponible. Intentá en unos minutos.'
        })
      }

      res.status(500).json({ error: 'Error al procesar la imagen. Intentá de nuevo.' })
    }
  }
)

export default router
