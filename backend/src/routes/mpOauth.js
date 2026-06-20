import { Router } from 'express'
import crypto from 'crypto'
import { verificarToken } from '../middleware/auth.js'
import Tienda from '../models/Tienda.js'
import PerfilComisionista from '../models/PerfilComisionista.js'

const router = Router()

const MP_APP_ID = process.env.MP_APP_ID
const MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// Valida que un origen sea un frontend legítimo de MercadoLocal.
// Mismo criterio que el CORS de server.js: FRONTEND_URL explícito,
// cualquier deploy de Vercel del proyecto, o localhost en desarrollo.
function esOrigenFrontendValido(origin) {
  if (!origin || typeof origin !== 'string') return false
  const permitidos = (process.env.FRONTEND_URL || '')
    .split(',').map(u => u.trim()).filter(Boolean)
  if (permitidos.includes(origin)) return true
  if (/^https:\/\/mercadolocal[a-z0-9-]*\.vercel\.app$/i.test(origin)) return true
  if (/^http:\/\/localhost(:[0-9]+)?$/.test(origin)) return true
  return false
}

// Resuelve la base del frontend a la que redirigir tras el OAuth.
// Prioriza el origen real desde el que arrancó el vendedor (viaja en el state),
// así no dependemos de que FRONTEND_URL esté bien seteado en Railway y funciona
// también en los previews de Vercel. Si no hay origen válido, cae al primer
// FRONTEND_URL configurado.
function resolverFrontendBase(origenCandidato) {
  if (esOrigenFrontendValido(origenCandidato)) return origenCandidato
  const primero = (process.env.FRONTEND_URL || '')
    .split(',').map(u => u.trim()).filter(Boolean)[0]
  return primero || FRONTEND_URL
}

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

    // Generar token CSRF aleatorio y guardarlo en la tienda para validar en callback.
    // Esto previene ataques CSRF donde un atacante engaña a un vendedor para que vincule
    // la cuenta MP del atacante a la tienda del vendedor.
    const csrfToken = crypto.randomBytes(16).toString('hex')
    tienda.mpCsrfToken = csrfToken
    await tienda.save()

    // Guardamos el origen del frontend desde el que arranca el flujo para
    // redirigir de vuelta ahí en el callback (independiente de FRONTEND_URL).
    const origenFrontend = esOrigenFrontendValido(req.query.origin) ? req.query.origin : null

    const statePayload = JSON.stringify({
      tiendaId: tienda._id.toString(),
      usuarioId: req.usuario.id.toString(),
      csrfToken,
      fo: origenFrontend
    })
    const state = Buffer.from(statePayload).toString('base64url')

    const authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`

    res.json({ authUrl })
  } catch (error) {
    console.error('Error generando auth URL:', error)
    res.status(500).json({ error: 'Error al generar enlace de autorización' })
  }
})

// GET /api/mp/callback - Callback de OAuth (MP redirige acá)
router.get('/callback', async (req, res) => {
  // Base del frontend a la que redirigir. Arranca con el default y se ajusta
  // al origen real apenas decodifiquemos el state. Así nunca redirigimos a
  // localhost en producción aunque FRONTEND_URL no esté seteado en Railway.
  let frontendBase = resolverFrontendBase(null)

  try {
    console.log(`📍 Callback MP iniciado. frontendBase inicial: ${frontendBase}`)
    const { code, state } = req.query

    if (!code || !state) {
      console.warn('⚠️ Falta code o state en callback')
      return res.redirect(`${frontendBase}/central-vendedor?mp=error&msg=parametros_invalidos`)
    }

    console.log('✓ Code y state recibidos')

    // Decodificar state y extraer datos según el tipo (vendedor | comisionista)
    let tipo, tiendaId, perfilId, usuarioId, csrfToken
    try {
      const decoded = Buffer.from(state, 'base64url').toString()
      const payload = JSON.parse(decoded)
      tipo = payload.tipo || 'vendedor'
      tiendaId = payload.tiendaId
      perfilId = payload.perfilId
      usuarioId = payload.usuarioId
      csrfToken = payload.csrfToken
      // Ajustar la base de redirect al origen real desde donde arrancó el flujo
      frontendBase = resolverFrontendBase(payload.fo)
      const refId = tipo === 'comisionista' ? perfilId : tiendaId
      if (!refId || !usuarioId || !csrfToken) throw new Error('State incompleto')
    } catch {
      return res.redirect(`${frontendBase}/central-vendedor?mp=error&msg=state_invalido`)
    }

    // ===== Rama comisionista =====
    if (tipo === 'comisionista') {
      const exitoUrl = `${frontendBase}/comisionistas/mi-perfil`
      const perfil = await PerfilComisionista.findById(perfilId)
      if (!perfil || perfil.usuarioId.toString() !== usuarioId) {
        return res.redirect(`${exitoUrl}?mp=error&msg=perfil_no_encontrado`)
      }
      if (!perfil.mpCsrfToken || perfil.mpCsrfToken !== csrfToken) {
        console.warn(`🚨 OAuth MP comisionista con CSRF inválido: perfil ${perfilId}`)
        return res.redirect(`${exitoUrl}?mp=error&msg=csrf_invalido`)
      }

      let response, data
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)
        response = await fetch('https://api.mercadopago.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: MP_APP_ID,
            client_secret: MP_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: `${BACKEND_URL}/api/mp/callback`
          }),
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        data = await response.json()
      } catch (fetchError) {
        console.error('❌ Error en fetch a MP (comisionista):', fetchError.message)
        return res.redirect(`${exitoUrl}?mp=error&msg=mp_timeout`)
      }

      if (!response.ok || !data.access_token) {
        console.error('❌ Error OAuth MP comisionista:', data)
        return res.redirect(`${exitoUrl}?mp=error&msg=token_invalido`)
      }

      perfil.mpAccessToken = data.access_token
      perfil.mpRefreshToken = data.refresh_token
      perfil.mpUserId = data.user_id?.toString() || ''
      perfil.mpVinculado = true
      perfil.mpVinculadoEn = new Date()
      perfil.mpCsrfToken = null
      try {
        await perfil.save()
        console.log(`✅ Comisionista vinculó MP (perfil ${perfilId}, MP user: ${data.user_id})`)
        return res.redirect(`${exitoUrl}?mp=ok`)
      } catch (saveError) {
        console.error('❌ Error guardando perfil comisionista con tokens MP:', saveError.message)
        return res.redirect(`${exitoUrl}?mp=error&msg=error_guardar`)
      }
    }

    console.log(`🎯 Redirigiré al frontend: ${frontendBase}`)

    // Buscar la tienda y validar el csrfToken almacenado
    const tienda = await Tienda.findById(tiendaId)
    if (!tienda || tienda.usuarioId.toString() !== usuarioId) {
      return res.redirect(`${frontendBase}/central-vendedor?mp=error&msg=tienda_no_encontrada`)
    }

    // Validación CSRF: el token del state debe coincidir con el guardado en la tienda
    if (!tienda.mpCsrfToken || tienda.mpCsrfToken !== csrfToken) {
      console.warn(`🚨 Intento de OAuth MP con CSRF inválido para tienda ${tiendaId}`)
      return res.redirect(`${frontendBase}/central-vendedor?mp=error&msg=csrf_invalido`)
    }

    // Intercambiar code por access_token con timeout
    console.log('🔄 Intercambiando code por token en MP API...')
    let response, data
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 segundo timeout

      response = await fetch('https://api.mercadopago.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: MP_APP_ID,
          client_secret: MP_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${BACKEND_URL}/api/mp/callback`
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      data = await response.json()
      console.log(`📨 Respuesta de MP:`, { ok: response.ok, hasToken: !!data.access_token })
    } catch (fetchError) {
      console.error('❌ Error en fetch a MP:', fetchError.message)
      return res.redirect(`${frontendBase}/central-vendedor?mp=error&msg=mp_timeout`)
    }

    if (!response.ok || !data.access_token) {
      console.error('❌ Error OAuth MP:', data)
      return res.redirect(`${frontendBase}/central-vendedor?mp=error&msg=token_invalido`)
    }

    console.log('✅ Token obtenido exitosamente')

    tienda.mpAccessToken = data.access_token
    tienda.mpRefreshToken = data.refresh_token
    tienda.mpUserId = data.user_id?.toString() || ''
    tienda.mpVinculado = true
    tienda.mpVinculadoEn = new Date()
    // Limpiar CSRF token (uso único)
    tienda.mpCsrfToken = null

    try {
      await tienda.save()
      console.log(`✅ Vendedor vinculó MP: tienda ${tienda.nombre} (MP user: ${data.user_id})`)
      res.redirect(`${frontendBase}/central-vendedor?mp=ok`)
    } catch (saveError) {
      console.error('❌ Error guardando tienda con tokens MP:', saveError.message)
      return res.redirect(`${frontendBase}/central-vendedor?mp=error&msg=error_guardar`)
    }
  } catch (error) {
    console.error('Error en callback MP:', error)
    res.redirect(`${frontendBase}/central-vendedor?mp=error&msg=error_servidor`)
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
    tienda.mpCsrfToken = null
    await tienda.save()

    res.json({ mensaje: 'Mercado Pago desvinculado correctamente' })
  } catch (error) {
    res.status(500).json({ error: 'Error al desvincular' })
  }
})

// ===== OAuth de Mercado Pago para COMISIONISTAS =====

// GET /api/mp/comisionista/auth-url - URL de autorización para vincular MP (comisionista)
router.get('/comisionista/auth-url', verificarToken, async (req, res) => {
  try {
    const perfil = await PerfilComisionista.findOne({ usuarioId: req.usuario.id })
    if (!perfil) return res.status(404).json({ error: 'No tenés un perfil de comisionista' })
    if (!MP_APP_ID) return res.status(500).json({ error: 'MP_APP_ID no configurado en el servidor' })

    const redirectUri = `${BACKEND_URL}/api/mp/callback`
    const csrfToken = crypto.randomBytes(16).toString('hex')
    perfil.mpCsrfToken = csrfToken
    await perfil.save()

    const origenFrontend = esOrigenFrontendValido(req.query.origin) ? req.query.origin : null
    const statePayload = JSON.stringify({
      tipo: 'comisionista',
      perfilId: perfil._id.toString(),
      usuarioId: req.usuario.id.toString(),
      csrfToken,
      fo: origenFrontend
    })
    const state = Buffer.from(statePayload).toString('base64url')

    const authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`
    res.json({ authUrl })
  } catch (error) {
    console.error('Error generando auth URL comisionista:', error)
    res.status(500).json({ error: 'Error al generar enlace de autorización' })
  }
})

// GET /api/mp/comisionista/estado - ¿El comisionista tiene MP vinculado?
router.get('/comisionista/estado', verificarToken, async (req, res) => {
  try {
    const perfil = await PerfilComisionista.findOne({ usuarioId: req.usuario.id })
    if (!perfil) return res.json({ vinculado: false, perfil: false })
    res.json({ vinculado: perfil.mpVinculado, mpUserId: perfil.mpUserId || null, vinculadoEn: perfil.mpVinculadoEn })
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar estado' })
  }
})

// POST /api/mp/comisionista/desvincular - Desvincular MP del comisionista
router.post('/comisionista/desvincular', verificarToken, async (req, res) => {
  try {
    const perfil = await PerfilComisionista.findOne({ usuarioId: req.usuario.id })
    if (!perfil) return res.status(404).json({ error: 'Perfil no encontrado' })

    perfil.mpAccessToken = ''
    perfil.mpRefreshToken = ''
    perfil.mpUserId = ''
    perfil.mpVinculado = false
    perfil.mpVinculadoEn = null
    perfil.mpCsrfToken = null
    await perfil.save()
    res.json({ mensaje: 'Mercado Pago desvinculado correctamente' })
  } catch (error) {
    res.status(500).json({ error: 'Error al desvincular' })
  }
})

// Refresca el token de MP de un comisionista (mismo patrón que el del vendedor).
export async function refrescarTokenComisionista(perfil) {
  if (!perfil.mpRefreshToken) return null
  try {
    let refreshToken
    try {
      refreshToken = perfil.getMpRefreshToken()
    } catch (decryptError) {
      console.error('❌ Error desencriptando refresh token comisionista:', decryptError.message)
      return null
    }
    if (!refreshToken) return null

    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: MP_APP_ID,
        client_secret: MP_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })
    const data = await response.json()
    if (data.access_token) {
      perfil.mpAccessToken = data.access_token
      perfil.mpRefreshToken = data.refresh_token || perfil.mpRefreshToken
      await perfil.save()
      return data.access_token
    }
  } catch (error) {
    console.error('❌ Error refrescando token MP comisionista:', error.message)
  }
  return null
}

// Función auxiliar para refrescar token de un vendedor
export async function refrescarTokenVendedor(tienda) {
  if (!tienda.mpRefreshToken) return null

  try {
    let refreshToken
    try {
      refreshToken = tienda.getMpRefreshToken()
    } catch (decryptError) {
      console.error('❌ Error desencriptando refresh token:', decryptError.message)
      return null
    }

    if (!refreshToken) {
      console.warn('⚠️ Refresh token vacío o inválido')
      return null
    }

    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: MP_APP_ID,
        client_secret: MP_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })

    const data = await response.json()

    if (data.access_token) {
      tienda.mpAccessToken = data.access_token
      tienda.mpRefreshToken = data.refresh_token || tienda.mpRefreshToken
      try {
        await tienda.save()
        console.log('✅ Token de MP refrescado exitosamente')
        return data.access_token
      } catch (saveError) {
        console.error('❌ Error guardando token refrescado:', saveError.message)
        return null
      }
    } else {
      console.error('❌ MP no devolvió access_token en refresh:', data)
    }
  } catch (error) {
    console.error('❌ Error refrescando token MP:', error.message)
  }

  return null
}

export default router
