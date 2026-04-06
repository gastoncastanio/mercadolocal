import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Obtener ruta del archivo .env
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '..', '..', '.env')

console.log('📂 Cargando variables de entorno desde:', envPath)

const result = dotenv.config({ path: envPath })

if (result.error) {
  console.error('❌ Error cargando .env:', result.error.message)
} else {
  console.log('✅ Variables de entorno cargadas correctamente')
  console.log('🔑 OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'CONFIGURADA ✅' : 'VACÍA ❌')
}

export default result
