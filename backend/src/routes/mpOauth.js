import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import Tienda from '../models/Tienda.js'

const router = Router()

const MP_APP_ID = process.env.MP_APP_ID
const MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// GET /api/mp/auth-url - Obtener URL de autorización para vincular MP
router.get('/auth-url', verificarToken, async (req, res) => {
  try {
    const tienda = await Tienda.findOne({ usuarioId: req.usuario.id })
    if (!tienda) {
      return res.status(404).json({ error: 'No tenés una tienda creada' })
    }

    if (!MP_APP_ID) {
      return res.status(500).json({ error: 'MP_APP_ID no configurado en el servidor' })
    }

    const redirectUri = `${BACKEND_URL}/api/mp/callback`
    // state lleva el ID de tienda para identificar al vendedor en el callback
    const state = tienda._id.toString()

    const authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`

    res.json({ authUrl })
  } catch (error) {
    console.error('Error generando auth URL:', error)
    res.status(500).json({ error: 'Error al generar enlace de autorización' })
  }
})

// GET /api/mp/callback - Callback de OAuth (MP redirige acá)
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/central-vendedor?mp=error&msg=parametros_invalidos`)
    }

    // Intercambiar code por access_token
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: MP_APP_ID,
        client_secret: MP_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${BACKEND_URL}/api/mp/callback`
      })
    })

    const data = await response.json()

    if (!response.ok || !data.access_token) {
      console.error('Error OAuth MP:', data)
      return res.redirect(`${FRONTEND_URL}/central-vendedor?mp=error&msg=token_invalido`)
    }

    // Guardar tokens en la tienda
    const tienda = await Tienda.findById(state)
    if (!tienda) {
      return res.redirect(`${FRONTEND_URL}/central-vendedor?mp=error&msg=tienda_no_encontrada`)
    }

    tienda.mpAccessToken = data.access_token
    tienda.mpRefreshToken = data.refresh_token
    tienda.mpUserId = data.user_id?.toString() || ''
    tienda.mpVinculado = true
    tienda.mpVinculadoEn = new Date()
    await tienda.save()

    console.log(`✅ Vendedor vinculó MP: tienda ${tienda.nombre} (MP user: ${data.user_id})`)

    res.redirect(`${FRONTEND_URL}/central-vendedor?mp=ok`)
  } catch (error) {
    console.error('Error en callback MP:', error)
    res.redirect(`${FRONTEND_URL}/central-vendedor?mp=error&msg=error_servidor`)
  }
})

// GET /api/mp/estado - Verificar si el vendedor tiene MP vinculado
router.get('/estado', verificarToken, async (req, res) => {
  try {
    const tienda = await Tienda.findOne({ usuarioId: req.usuario.id })
    if (!tienda) {
      return res.json({ vinculado: false, tienda: false })
    }

    res.json({
      vinculado: tienda.mpVinculado,
      mpUserId: tienda.mpUserId || null,
      vinculadoEn: tienda.mpVinculadoEn
    })
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar estado' })
  }
})

// POST /api/mp/desvincular - Desvincular cuenta MP
router.post('/desvincular', verificarToken, async (req, res) => {
  try {
    const tienda = await Tienda.findOne({ usuarioId: req.usuario.id })
    if (!tienda) {
      return res.status(404).json({ error: 'Tienda no encontrada' })
    }

    tienda.mpAccessToken = ''
    tienda.mpRefreshToken = ''
    tienda.mpUserId = ''
    tienda.mpVinculado = false
    tienda.mpVinculadoEn = null
    await tienda.save()

    res.json({ mensaje: 'Mercado Pago desvinculado correctamente' })
  } catch (error) {
    res.status(500).json({ error: 'Error al desvincular' })
  }
})

// Función auxiliar para refrescar token de un vendedor
export async function refrescarTokenVendedor(tienda) {
  if (!tienda.mpRefreshToken) return null

  try {
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: MP_APP_ID,
        client_secret: MP_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: tienda.mpRefreshToken
      })
    })

    const data = await response.json()

    if (data.access_token) {
      tienda.mpAccessToken = data.access_token
      tienda.mpRefreshToken = data.refresh_token
      await tienda.save()
      return data.access_token
    }
  } catch (error) {
    console.error('Error refrescando token MP:', error)
  }

  return null
}

export default router
