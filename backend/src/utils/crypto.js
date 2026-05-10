import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

// Derivar clave de encriptación dedicada (MP_ENCRYPTION_KEY).
// En producción es obligatoria; en desarrollo permitimos fallback al JWT_SECRET con warning.
function getEncryptionKey() {
  const secret = process.env.MP_ENCRYPTION_KEY
  if (!secret) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ MP_ENCRYPTION_KEY no configurado, usando JWT_SECRET como fallback. Configurar en producción.')
      const fallback = process.env.JWT_SECRET || 'dev'
      return crypto.createHash('sha256').update(fallback).digest()
    }
    throw new Error('MP_ENCRYPTION_KEY debe estar configurado en producción')
  }
  return crypto.createHash('sha256').update(secret).digest()
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

  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// Verificar si un texto ya está encriptado (formato iv:tag:data)
export function estaEncriptado(texto) {
  if (!texto || typeof texto !== 'string') return false
  const parts = texto.split(':')
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32
}
