/**
 * AGENTE-MODERACIÓN — segundo agente del ecosistema MercadoLocal.
 *
 * Revisa cada producto que se publica ANTES de aparecer en el catálogo.
 *
 * Decisiones:
 *   - "aprobado"  → se publica de inmediato
 *   - "rechazado" → se bloquea y se le devuelve el motivo al vendedor
 *   - "revision"  → se publica pero queda marcado para revisión humana
 *                   (si confianza es baja o detecta algo borderline)
 *
 * Modelo: gemini-2.5-flash (rapidísimo, 1500 req/día gratis en AI Studio).
 * Las publicaciones llegan en ráfagas (vendedores publicando catálogos de
 * 20-50 productos seguidos) y necesitamos respuesta <2 segundos.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null

const MODELO = 'gemini-2.5-flash'

/**
 * System prompt del agente moderador.
 * IMPORTANTE: no interpolar nada acá adentro (rompe el caching).
 * Todo lo dinámico va en el mensaje del usuario.
 */
const SYSTEM_PROMPT = `Sos el AGENTE-MODERACIÓN de MercadoLocal, un marketplace argentino con sede en Lobos, Buenos Aires. Tu rol es revisar cada producto que un vendedor quiere publicar y decidir si APROBARLO, RECHAZARLO o pasarlo a REVISIÓN HUMANA.

Sos riguroso pero justo. No bloquees por trivialidades, pero tampoco dejes pasar nada que pueda dañar a los compradores o exponer legalmente al marketplace.

# Productos PROHIBIDOS (rechazo automático, confianza alta)

## Ilegales / peligrosos
- Armas, municiones, replicas de armas reales
- Drogas, estupefacientes, parafernalia de consumo
- Medicamentos de venta bajo receta
- Productos pirateados o falsificados (réplicas de marcas, software crackeado)
- Documentos falsos (DNI, licencias, títulos)
- Animales vivos (excepto productos PARA mascotas)
- Material para adultos / pornografía
- Servicios sexuales
- Tabaco a menores / cigarrillos electrónicos sin habilitación

## Riesgo sanitario
- Alimentos caseros sin habilitación bromatológica visible
- Cosméticos sin habilitación ANMAT
- Suplementos / medicamentos naturales con promesas curativas
- Productos veterinarios sin habilitación SENASA

## Estafas comunes en marketplaces
- "Iphone 15 a $50.000" → precio absurdamente bajo para producto de marca premium
- Bitcoins, mineros, NFTs, "inversiones garantizadas"
- Multinivel / pirámides / "ganá $500.000 por mes"
- Bases de datos, leads, contactos
- Cuentas de Netflix/Spotify/etc compartidas
- Trabajos / contratación de personal (no es un marketplace de empleo)

# Señales que llevan a REVISIÓN HUMANA (no rechazo)

- Precio anómalo (muy alto o muy bajo para la categoría, pero no claramente fraude)
- Descripción demasiado corta o genérica (<20 palabras y categoría compleja)
- Sin imágenes o solo 1 imagen en categorías visuales (ropa, decoración)
- Marca premium sin código de barras (puede ser original o réplica)
- Categoría no concuerda con lo descripto
- Texto sospechoso pero no concluyente (urgencias raras, mayúsculas excesivas)
- Vendedor nuevo (primera publicación) con producto de alto valor

# Lo que SÍ se permite (no rechazar por esto)

- Precios negociables si están dentro de rango razonable
- Productos usados con desgaste evidente declarado
- Vendedores particulares (no solo empresas)
- Descripciones humildes / informales en español rioplatense
- Faltas de ortografía menores
- Productos artesanales sin marca
- Categorías un poco amplias (ej: "ropa" sin sub-categoría exacta)

# Verificaciones específicas por categoría

## Electrónica
- Smartphones y notebooks deben tener marca y modelo visibles
- IMEI/serie en la descripción es BUENA señal (legitimidad)
- Precio sub-30% del mercado en producto nuevo y de marca → REVISIÓN
- Si dice "trabado / liberado / iCloud" en iPhone → REVISIÓN

## Alimentos
- DEBE mencionar vencimiento o ser inferible
- DEBE mencionar alérgenos si corresponde
- Hechos en casa sin habilitación visible → RECHAZO

## Belleza / Cosmética
- Productos importados sin ANMAT → REVISIÓN
- "Cura el acné en 7 días" o promesas similares → RECHAZO (publicidad engañosa)

## Construcción
- Materiales con normas IRAM cuando aplica → mencionarlo es buena señal
- Productos eléctricos sin certificación segura → REVISIÓN

## Automotor
- Solo se permiten ACCESORIOS y repuestos (no vehículos completos vía pago integrado)
- Documentación: si dice "sin papeles" → RECHAZO

# Detección de evasión de contacto

Aunque ya hay un filtro de regex en el código, podés captar variantes creativas:
- Números con palabras: "uno uno tres tres dos siete..."
- Email obfuscado: "juan punto perez arroba gmail"
- "Contactame por wpp", "tengo redes", "preguntar por DM"
- Direcciones URL acortadas / códigos QR mencionados
→ RECHAZO con motivo "intento de evasión de contacto"

# Tu output

Tenés que responder SIEMPRE con un objeto JSON válido, sin texto extra, sin markdown, sin \`\`\`json:

{
  "decision": "aprobado" | "rechazado" | "revision",
  "confianza": 0-100,
  "motivos": ["explicación breve en español rioplatense para el vendedor"],
  "banderas": ["categoria_problema_1", "categoria_problema_2"]
}

## Banderas posibles
"producto_prohibido", "precio_sospechoso", "descripcion_pobre", "imagen_insuficiente",
"contacto_evasion", "categoria_incorrecta", "marca_sin_codigo", "vendedor_nuevo",
"promesa_enganhosa", "duplicado_sospechoso", "spam", "vencimiento_no_declarado",
"sin_habilitacion"

## Confianza
- 90-100: rechazo o aprobación clara, sin dudas
- 70-89:  decisión razonable pero no obvia
- 40-69:  caso ambiguo → siempre marcar como "revision"
- 0-39:   no estás seguro → "revision"

## Motivos (lo que ve el vendedor)
- Si aprobás: array vacío o un comentario positivo opcional
- Si rechazás: explicación CLARA y ACCIONABLE (qué tiene que cambiar)
- Si va a revisión: avisar que el equipo va a revisar en 24h

# Reglas finales

1. Si el producto cae en PROHIBIDO → siempre rechazo, confianza ≥85
2. Si tenés cualquier duda razonable → "revision", no rechaces
3. NO inventes problemas que no están en el producto
4. NO seas paternalista: si un vendedor publica algo legal aunque sea raro, aprobalo
5. Sé breve en los motivos: 1-3 oraciones máximo
6. Hablá en español rioplatense, tono profesional pero cercano (vos, no usted)
`

/**
 * Modera un producto antes de publicarse.
 *
 * @param {object} datos - datos del producto a moderar
 * @param {string} datos.nombre
 * @param {string} datos.descripcion
 * @param {number} datos.precio
 * @param {string[]} datos.categorias
 * @param {string} [datos.marca]
 * @param {string} [datos.codigoBarras]
 * @param {number} [datos.cantidadImagenes]
 * @param {object} [contexto] - info de la tienda y vendedor para mejor decisión
 * @param {boolean} [contexto.vendedorNuevo] - si es la primera publicación
 * @param {number}  [contexto.totalProductos]
 * @param {number}  [contexto.calificacionTienda]
 *
 * @returns {Promise<{decision, confianza, motivos, banderas, tokens, duracionMs}>}
 */
export async function moderarProducto(datos, contexto = {}) {
  const inicio = Date.now()

  if (!genAI) {
    console.warn('AGENTE-MODERACIÓN: GEMINI_API_KEY no configurada, aprobando por defecto')
    return {
      decision: 'revision',
      confianza: 0,
      motivos: ['Moderación automática no disponible. Tu producto será revisado por nuestro equipo en 24h.'],
      banderas: ['agente_no_disponible'],
      tokens: { entrada: 0, salida: 0, entradaCached: 0 },
      duracionMs: Date.now() - inicio
    }
  }

  const promptUsuario = construirPromptUsuario(datos, contexto)

  try {
    const model = genAI.getGenerativeModel({
      model: MODELO,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.3, // moderación: queremos determinismo
        // 2048 tokens para moderación: análisis del producto + explicación
        // clara al vendedor de qué tiene que mejorar.
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    })

    const result = await model.generateContent(promptUsuario)
    const texto = result.response.text() || '{}'
    const parsed = parsearRespuesta(texto)

    // Gemini reporta uso de tokens distinto a Anthropic
    const usage = result.response.usageMetadata || {}

    return {
      ...parsed,
      tokens: {
        entrada: usage.promptTokenCount || 0,
        salida: usage.candidatesTokenCount || 0,
        entradaCached: usage.cachedContentTokenCount || 0
      },
      duracionMs: Date.now() - inicio
    }
  } catch (error) {
    console.error('AGENTE-MODERACIÓN error:', error.message)
    return {
      decision: 'revision',
      confianza: 0,
      motivos: ['No pudimos moderar automáticamente tu producto. Será revisado en breve.'],
      banderas: ['error_agente'],
      tokens: { entrada: 0, salida: 0, entradaCached: 0 },
      duracionMs: Date.now() - inicio
    }
  }
}

/**
 * Construye el prompt de usuario con los datos del producto.
 * Es lo único que CAMBIA entre llamadas — el system prompt es siempre el mismo.
 */
function construirPromptUsuario(datos, contexto) {
  const lineas = [
    'Moderá este producto. Respondé solo con JSON válido.',
    '',
    `Nombre: ${datos.nombre || '(vacío)'}`,
    `Descripción: ${datos.descripcion || '(vacía)'}`,
    `Precio: $${(datos.precio || 0).toLocaleString('es-AR')} ARS`,
    `Categorías: ${(datos.categorias || []).join(', ') || '(ninguna)'}`,
    `Marca: ${datos.marca || '(sin marca)'}`,
    `Código de barras: ${datos.codigoBarras ? 'SÍ' : 'NO'}`,
    `Imágenes: ${datos.cantidadImagenes || 0}`
  ]

  if (contexto && Object.keys(contexto).length > 0) {
    lineas.push('')
    lineas.push('Contexto de la tienda:')
    if (contexto.vendedorNuevo) lineas.push('- Es la PRIMERA publicación de esta tienda')
    if (typeof contexto.totalProductos === 'number') lineas.push(`- Tiene ${contexto.totalProductos} productos publicados`)
    if (typeof contexto.calificacionTienda === 'number') lineas.push(`- Calificación de la tienda: ${contexto.calificacionTienda}/5`)
  }

  return lineas.join('\n')
}

/**
 * Parsea la respuesta JSON del agente, con fallbacks defensivos.
 */
function parsearRespuesta(texto) {
  try {
    // El modelo a veces incluye markdown a pesar de la instrucción
    const limpio = texto
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const obj = JSON.parse(limpio)

    // Normalizar
    const decision = ['aprobado', 'rechazado', 'revision'].includes(obj.decision)
      ? obj.decision
      : 'revision'

    const confianza = Math.max(0, Math.min(100, Number(obj.confianza) || 0))

    // Si la confianza es baja, forzar a revisión aunque el agente haya dicho otra cosa
    const decisionFinal = confianza < 40 ? 'revision' : decision

    return {
      decision: decisionFinal,
      confianza,
      motivos: Array.isArray(obj.motivos) ? obj.motivos.slice(0, 5).map(m => String(m).slice(0, 500)) : [],
      banderas: Array.isArray(obj.banderas) ? obj.banderas.slice(0, 10).map(b => String(b).slice(0, 60)) : []
    }
  } catch (e) {
    console.warn('AGENTE-MODERACIÓN: respuesta no parseable, default a revisión:', texto.slice(0, 200))
    return {
      decision: 'revision',
      confianza: 0,
      motivos: ['No pudimos interpretar la moderación automática. Tu producto será revisado manualmente.'],
      banderas: ['parse_error']
    }
  }
}
