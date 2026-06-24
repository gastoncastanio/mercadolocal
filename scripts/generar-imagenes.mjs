#!/usr/bin/env node
/**
 * Generador de imágenes de marca con "nano banana" (Gemini image model).
 *
 * Uso:
 *   GEMINI_API_KEY=xxx node scripts/generar-imagenes.mjs --list      # descubrir el modelo de imagen
 *   GEMINI_API_KEY=xxx node scripts/generar-imagenes.mjs             # genera TODO el manifest
 *   GEMINI_API_KEY=xxx node scripts/generar-imagenes.mjs --only=cat_electronica
 *
 * La API key se saca GRATIS en https://aistudio.google.com (Get API key).
 * NO es la suscripción "Gemini Pro" — es una API key aparte.
 *
 * Lee scripts/imagenes.manifest.json: [{ id, archivo, prompt }]
 * Guarda cada imagen en su `archivo` (relativo a la raíz del repo).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://generativelanguage.googleapis.com/v1beta'
const KEY = process.env.GEMINI_API_KEY
// "nano banana" = gemini-2.5-flash-image. Configurable por si cambia el id.
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'

if (!KEY) {
  console.error('❌ Falta GEMINI_API_KEY. Sacala gratis en https://aistudio.google.com y corré:\n   GEMINI_API_KEY=tu_key node scripts/generar-imagenes.mjs --list')
  process.exit(1)
}

async function listarModelos() {
  const r = await fetch(`${API}/models?key=${KEY}`)
  const j = await r.json()
  if (!r.ok) { console.error('Error:', j); process.exit(1) }
  const conImagen = (j.models || []).filter(m =>
    /image/i.test(m.name) || (m.supportedGenerationMethods || []).join(',').includes('generateContent'))
  console.log('Modelos con capacidad de imagen / generateContent:')
  for (const m of conImagen) console.log(' -', m.name.replace('models/', ''))
}

async function generarUno({ id, archivo, prompt }) {
  const url = `${API}/models/${MODEL}:generateContent?key=${KEY}`
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] }
  }
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const j = await r.json()
  if (!r.ok) {
    console.error(`❌ ${id}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`)
    return false
  }
  const parts = j?.candidates?.[0]?.content?.parts || []
  const img = parts.find(p => p.inlineData?.data)
  if (!img) {
    console.error(`❌ ${id}: la respuesta no trajo imagen. ${JSON.stringify(parts).slice(0, 200)}`)
    return false
  }
  const dest = resolve(RAIZ, archivo)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, Buffer.from(img.inlineData.data, 'base64'))
  console.log(`✅ ${id} → ${archivo}`)
  return true
}

const args = process.argv.slice(2)
if (args.includes('--list')) {
  await listarModelos()
  process.exit(0)
}

const only = (args.find(a => a.startsWith('--only=')) || '').split('=')[1]
const manifest = JSON.parse(await readFile(resolve(RAIZ, 'scripts/imagenes.manifest.json'), 'utf8'))
const items = only ? manifest.filter(m => m.id === only) : manifest

console.log(`Generando ${items.length} imagen(es) con ${MODEL}…\n`)
let ok = 0
for (const it of items) {
  if (await generarUno(it)) ok++
  await new Promise(r => setTimeout(r, 1200)) // respeta rate limit
}
console.log(`\nListo: ${ok}/${items.length} generadas.`)
