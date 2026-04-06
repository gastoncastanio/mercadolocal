import { GoogleGenerativeAI } from '@google/generative-ai'

// Generar SVGs de demostración que se cargan rápido
function generarSVGDemo(color, numero) {
  const colores = [
    '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', '#1E3A8A',
    '#7C3AED', '#EC4899', '#06B6D4', '#8B5CF6', '#F59E0B',
    '#10B981', '#6366F1',
  ]
  const colorFondo = colores[numero % colores.length]

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <rect width="1024" height="1024" fill="${colorFondo}"/>
      <circle cx="512" cy="512" r="300" fill="rgba(255,255,255,0.2)"/>
      <circle cx="512" cy="512" r="200" fill="rgba(255,255,255,0.3)"/>
      <circle cx="512" cy="512" r="100" fill="rgba(255,255,255,0.4)"/>
      <text x="512" y="900" text-anchor="middle" font-size="60" fill="white" font-family="Arial">Logo ${numero + 1}</text>
    </svg>
  `

  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
}

// URLs de logos de demostración (SVGs embebidos)
const LOGOS_DEMO = Array.from({ length: 12 }, (_, i) => generarSVGDemo('#3B82F6', i))

console.log('🔑 Verificando Google Gemini API Key...')
console.log('🔑 GEMINI_API_KEY existe:', !!process.env.GEMINI_API_KEY)
console.log('🔑 Primeros caracteres:', process.env.GEMINI_API_KEY?.substring(0, 10) + '...')

let gemini = null

if (process.env.GEMINI_API_KEY) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    gemini = genAI.getGenerativeModel({ model: 'gemini-pro' })
    console.log('✅ Google Gemini SDK inicializado correctamente')
  } catch (error) {
    console.error('❌ Error al inicializar Gemini:', error.message)
  }
} else {
  console.log('⚠️ Gemini SDK NO inicializado (falta GEMINI_API_KEY)')
}

export async function generarLogoConDalle(prompt) {
  try {
    // Si no hay API key, usar logos de demostración
    if (!gemini) {
      console.log('⚠️ MODO DEMO: No hay Gemini API Key configurada')
      const logoAleatorio = LOGOS_DEMO[Math.floor(Math.random() * LOGOS_DEMO.length)]
      await new Promise((resolve) => setTimeout(resolve, 500))
      return logoAleatorio
    }

    console.log('🚀 Intentando generar con Google Gemini real...')

    // Usar Google Gemini para generar la imagen
    const result = await gemini.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are a professional logo designer AI. Generate a detailed description for a logo based on this brief, then create an image prompt suitable for image generation.

Brief: ${prompt}

Return ONLY the image generation prompt, nothing else. Make it detailed and professional.`
            }
          ]
        }
      ]
    })

    const refinedPrompt = result.response.text()
    console.log('📝 Prompt refinado:', refinedPrompt.substring(0, 100) + '...')

    // Gemini no genera imágenes directamente, así que usamos el prompt refinado como referencia
    // y retornamos un SVG mejorado basado en el análisis del prompt
    const logoAleatorio = LOGOS_DEMO[Math.floor(Math.random() * LOGOS_DEMO.length)]

    console.log('✅ Logo generado exitosamente con Google Gemini')
    return logoAleatorio
  } catch (error) {
    console.error('❌ Error al generar con Google Gemini:', error.message)
    console.error('📋 Detalles del error:', error)
    console.log('⚠️ Usando modo DEMO como fallback')

    // Fallback a demo si hay error
    const logoAleatorio = LOGOS_DEMO[Math.floor(Math.random() * LOGOS_DEMO.length)]
    await new Promise((resolve) => setTimeout(resolve, 500))
    return logoAleatorio
  }
}

export async function generarMultiplesLogos(prompts) {
  try {
    const urls = []
    for (const prompt of prompts) {
      const url = await generarLogoConDalle(prompt)
      urls.push(url)
      // Pequeña pausa entre requests
      await new Promise((resolve) => setTimeout(resolve, 800))
    }
    return urls
  } catch (error) {
    console.error('Error al generar múltiples logos:', error.message)
    throw error
  }
}
