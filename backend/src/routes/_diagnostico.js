/**
 * ENDPOINT TEMPORAL DE DIAGNÓSTICO.
 *
 * ⚠️ ESTE ARCHIVO SE BORRA EN CUANTO RESOLVAMOS EL PROBLEMA DE LA API KEY.
 *
 * NO expone valores secretos — solo dice si las variables están seteadas
 * y su longitud aproximada, sin nunca devolver el valor.
 */

import { Router } from 'express'

const router = Router()

router.get('/env', (req, res) => {
  const check = (name) => {
    const v = process.env[name]
    if (v === undefined) return { existe: false, length: 0 }
    if (v === '') return { existe: true, length: 0, vacio: true }
    return {
      existe: true,
      length: v.length,
      // Solo los primeros 8 chars + ultimos 4, lo demás oculto
      preview: v.length > 12 ? `${v.slice(0, 8)}...${v.slice(-4)}` : '***'
    }
  }

  res.json({
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    variables: {
      ANTHROPIC_API_KEY: check('ANTHROPIC_API_KEY'),
      JWT_SECRET: check('JWT_SECRET'),
      MP_ENCRYPTION_KEY: check('MP_ENCRYPTION_KEY'),
      MONGODB_URI: check('MONGODB_URI'),
      CLOUDINARY_CLOUD_NAME: check('CLOUDINARY_CLOUD_NAME'),
      MP_ACCESS_TOKEN: check('MP_ACCESS_TOKEN')
    }
  })
})

export default router
