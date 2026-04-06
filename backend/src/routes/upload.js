import { Router } from 'express'
import { v2 as cloudinary } from 'cloudinary'
import multer from 'multer'
import { verificarToken } from '../middleware/auth.js'

const router = Router()

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

// Configurar multer para recibir archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // Máximo 5MB
  },
  fileFilter: (req, file, cb) => {
    // Solo permitir imágenes
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten imágenes'), false)
    }
  }
})

// POST /api/upload/imagen - Subir imagen
router.post('/imagen', verificarToken, upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ninguna imagen' })
    }

    // Subir a Cloudinary desde buffer
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'mercadolocal',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      )
      stream.end(req.file.buffer)
    })

    console.log(`📸 Imagen subida: ${result.secure_url}`)

    res.json({
      url: result.secure_url,
      publicId: result.public_id
    })
  } catch (error) {
    console.error('Error subiendo imagen:', error)
    res.status(500).json({ error: 'Error al subir la imagen' })
  }
})

export default router
