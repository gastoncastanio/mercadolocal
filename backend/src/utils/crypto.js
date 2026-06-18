import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const MIN_KEY_LENGTH = 32 // mínimo 32 chars para resistir bruteforce básico

/**
 * Clave de encriptación dedicada para tokens sensibles (MP, futuras integraciones).
 *
 * SEGURIDAD: esta clave debe ser ÚNICA y SEPARADA de JWT_SECRET.
 * Si JWT_SECRET se filtra, el atacante puede forjar tokens de usuario.
 * Si MP_ENCRYPTION_KEY se filtra, puede desencriptar tokens de MP de vendedores.
 * Tener la MISMA clave para ambos = single point of failure crítico.
 *
 * Cache de la clave derivada para no re-hashearla en cada llamada.
 */
let cachedKey = null

function getEncryptionKey() {
  if (cachedKey) return cachedKey

  const secret = process.env.MP_ENCRYPTION_KEY
  const esProduccion = process.env.NODE_ENV === 'production'

  if (!secret) {
    if (esProduccion) {
      throw new Error(
        'MP_ENCRYPTION_KEY es OBLIGATORIO en producción. ' +
        'Generala con: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))" ' +
        'y configurala en las variables de entorno.'
      )
    }
    // En desarrollo, fallback al JWT_SECRET pero con warning fuerte
    console.warn(
      '⚠️  MP_ENCRYPTION_KEY no configurado. Usando JWT_SECRET como fallback (SOLO DESARROLLO). ' +
      'En producción configurar MP_ENCRYPTION_KEY separado.'
    )
    const fallback = process.env.JWT_SECRET || 'dev-only-do-not-use-in-production'
    cachedKey = crypto.createHash('sha256').update(fallback).digest()
    return cachedKey
  }

  // Validar que la clave tenga longitud razonable
  if (secret.length < MIN_KEY_LENGTH) {
    throw new Error(
      `MP_ENCRYPTION_KEY debe tener al menos ${MIN_KEY_LENGTH} caracteres. ` +
      `Generala con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
    )
  }

  // Validar que NO sea idéntica al JWT_SECRET (single point of failure)
  if (esProduccion && process.env.JWT_SECRET && secret === process.env.JWT_SECRET) {
    throw new Error(
      'MP_ENCRYPTION_KEY no puede ser igual a JWT_SECRET. ' +
      'Si uno se filtra el otro queda comprometido. Generá claves distintas.'
    )
  }

  cachedKey = crypto.createHash('sha256').update(secret).digest()
  return cachedKey
}

// Encriptar un string sensible (tokens MP, etc.)
export function encriptar(texto) {
  if (!texto) return ''
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(texto, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag()

  // Formato: iv:tag:encrypted (todo en hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

// Desencriptar un string
export function desencriptar(textoEncriptado) {
  if (!textoEncriptado || !textoEncriptado.includes(':')) return textoEncriptado
  const key = getEncryptionKey()
  const parts = textoEncriptado.split(':')
  if (parts.length !== 3) return textoEncriptado

  try {
    const iv = Buffer.from(parts[0], 'hex')
    const tag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    console.error('❌ Error desencriptando:', error.message)
    throw new Error(`Falló desencriptación: ${error.message}`)
  }
}

// Verificar si un texto ya está encriptado (formato iv:tag:data)
export function estaEncriptado(texto) {
  if (!texto || typeof texto !== 'string') return false
  const parts = texto.split(':')
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32
}

// ============================================================
//  Códigos de canje (Radar del Centro — ofertas flash)
// ============================================================
// Alfabeto base32 SIN caracteres ambiguos (sin 0/O, 1/I/L) para que el comercio
// pueda tipear el código sin confundirse. 8 caracteres ⇒ 32^8 ≈ 1.1e12 combos.
// La seguridad real no depende solo de adivinar el código: el canje exige que el
// DUEÑO del comercio esté logueado, valida pertenencia de la oferta, es de un solo
// uso (transición atómica) y expira rápido. El código es un secreto de portador.
const ALFABETO_CANJE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Genera un código de canje legible y su hash para guardar en BD.
 * Nunca guardamos el código en claro: solo el hash. El cliente recibe el código
 * en claro una sola vez (al reclamar) y lo presenta en el mostrador.
 *
 * @returns {{ codigo: string, codigoHash: string }} codigo formateado "ABCD-2345"
 */
export function generarCodigoCanje() {
  const bytes = crypto.randomBytes(8)
  let codigo = ''
  for (let i = 0; i < 8; i++) {
    codigo += ALFABETO_CANJE[bytes[i] % ALFABETO_CANJE.length]
  }
  // Formato visual con guion al medio: "ABCD-2345"
  const formateado = `${codigo.slice(0, 4)}-${codigo.slice(4)}`
  return { codigo: formateado, codigoHash: hashCodigoCanje(formateado) }
}

/**
 * Normaliza y hashea un código de canje para buscarlo/validarlo en BD.
 * Acepta el código con o sin guion, en cualquier capitalización.
 */
export function hashCodigoCanje(codigo) {
  const normalizado = String(codigo || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') // quita guiones, espacios, etc.
  return crypto.createHash('sha256').update(normalizado).digest('hex')
}
