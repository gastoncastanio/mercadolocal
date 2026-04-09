import { Router } from 'express'
import axios from 'axios'

const router = Router()

/**
 * Cotizador de env\u00edos.
 * Intenta usar APIs reales de Correo Argentino y Andreani.
 * Si las APIs no responden (requieren credenciales comerciales),
 * usa tarifas estimadas basadas en tablas p\u00fablicas de referencia.
 */

// Tarifas de referencia por rango de peso (en ARS, abril 2026)
// Fuente: tarifas p\u00fablicas de Correo Argentino / Andreani
// Se deben actualizar peri\u00f3dicamente
const TARIFAS_REFERENCIA = {
  local: [   // misma provincia
    { hastaKg: 1, precio: 3500 },
    { hastaKg: 3, precio: 5200 },
    { hastaKg: 5, precio: 7000 },
    { hastaKg: 10, precio: 9500 },
    { hastaKg: 15, precio: 12000 },
    { hastaKg: 25, precio: 16000 },
    { hastaKg: 50, precio: 25000 }
  ],
  nacional: [ // distinta provincia
    { hastaKg: 1, precio: 5500 },
    { hastaKg: 3, precio: 7800 },
    { hastaKg: 5, precio: 10500 },
    { hastaKg: 10, precio: 14000 },
    { hastaKg: 15, precio: 18500 },
    { hastaKg: 25, precio: 24000 },
    { hastaKg: 50, precio: 35000 }
  ]
}

// CP a provincia (primeros 1-2 d\u00edgitos)
function provinciaDesdeCP(cp) {
  const num = parseInt(cp)
  if (!num) return 'desconocida'
  const prefijo = Math.floor(num / 100)
  // Mapeo simplificado de CP argentinos
  if (prefijo >= 10 && prefijo <= 14) return 'CABA'
  if (prefijo >= 16 && prefijo <= 19) return 'Buenos Aires'
  if (prefijo >= 20 && prefijo <= 23) return 'Santa Fe'
  if (prefijo >= 30 && prefijo <= 31) return 'Entre R\u00edos'
  if (prefijo >= 50 && prefijo <= 52) return 'C\u00f3rdoba'
  if (prefijo >= 54 && prefijo <= 55) return 'Mendoza'
  if (prefijo >= 40 && prefijo <= 44) return 'Tucum\u00e1n'
  if (prefijo >= 80 && prefijo <= 83) return 'Neuqu\u00e9n'
  if (prefijo >= 90 && prefijo <= 94) return 'Chubut'
  return 'otra'
}

function mismaZona(cpOrigen, cpDestino) {
  return provinciaDesdeCP(cpOrigen) === provinciaDesdeCP(cpDestino)
}

function calcularTarifaEstimada(pesoKg, cpOrigen, cpDestino) {
  const esLocal = mismaZona(cpOrigen, cpDestino)
  const tabla = esLocal ? TARIFAS_REFERENCIA.local : TARIFAS_REFERENCIA.nacional
  const rango = tabla.find(r => pesoKg <= r.hastaKg) || tabla[tabla.length - 1]
  return rango.precio
}

function estimarDias(cpOrigen, cpDestino) {
  const esLocal = mismaZona(cpOrigen, cpDestino)
  return esLocal ? { min: 2, max: 4 } : { min: 4, max: 8 }
}

// POST /api/envios/cotizar
router.post('/cotizar', async (req, res) => {
  try {
    const { cpOrigen, cpDestino, pesoGr, alto, ancho, largo } = req.body

    if (!cpOrigen || !cpDestino) {
      return res.status(400).json({ error: 'C\u00f3digo postal de origen y destino son obligatorios' })
    }

    const pesoKg = Math.max((pesoGr || 1000) / 1000, 0.5)
    // Peso volum\u00e9trico: (alto x ancho x largo) / 5000
    const pesoVolumetrico = (alto && ancho && largo)
      ? (alto * ancho * largo) / 5000
      : pesoKg
    const pesoFinal = Math.max(pesoKg, pesoVolumetrico)

    const opciones = []

    // --- Intentar Correo Argentino API ---
    try {
      const correoResp = await axios.get('https://api.correoargentino.com.ar/micorreo/public/v1/cotizador/costo', {
        params: {
          cpOrigen,
          cpDestino,
          peso: Math.ceil(pesoFinal * 1000),
          largo: largo || 30,
          ancho: ancho || 20,
          alto: alto || 15
        },
        timeout: 4000,
        headers: {
          'Accept': 'application/json'
        }
      })

      if (correoResp.data) {
        const data = correoResp.data
        if (data.paqArClasico) {
          opciones.push({
            servicio: 'Correo Argentino - Cl\u00e1sico',
            precio: Math.round(data.paqArClasico.aDomicilio || data.paqArClasico.aSucursal),
            diasMin: 3,
            diasMax: 7,
            tipo: 'domicilio',
            proveedor: 'correo_argentino'
          })
        }
        if (data.paqArUrgente) {
          opciones.push({
            servicio: 'Correo Argentino - Urgente',
            precio: Math.round(data.paqArUrgente.aDomicilio || data.paqArUrgente.aSucursal),
            diasMin: 1,
            diasMax: 3,
            tipo: 'domicilio',
            proveedor: 'correo_argentino'
          })
        }
      }
    } catch {
      // API no disponible, se usar\u00e1n tarifas estimadas
    }

    // --- Intentar Andreani API ---
    try {
      const andreaniResp = await axios.get('https://api.andreani.com/v1/tarifas', {
        params: {
          cpOrigen,
          cpDestino,
          peso: Math.ceil(pesoFinal * 1000),
          volumen: (alto || 15) * (ancho || 20) * (largo || 30),
          valorDeclarado: 0
        },
        timeout: 4000,
        headers: {
          'Accept': 'application/json',
          'x-authorization-token': process.env.ANDREANI_TOKEN || ''
        }
      })

      if (andreaniResp.data?.tarifas) {
        for (const tarifa of andreaniResp.data.tarifas) {
          opciones.push({
            servicio: `Andreani - ${tarifa.servicio || 'Est\u00e1ndar'}`,
            precio: Math.round(tarifa.total),
            diasMin: tarifa.plazoMin || 2,
            diasMax: tarifa.plazoMax || 5,
            tipo: 'domicilio',
            proveedor: 'andreani'
          })
        }
      }
    } catch {
      // API no disponible
    }

    // --- Si ninguna API respond\u00edo, usar tarifas estimadas ---
    if (opciones.length === 0) {
      const precioBase = calcularTarifaEstimada(pesoFinal, cpOrigen, cpDestino)
      const dias = estimarDias(cpOrigen, cpDestino)

      opciones.push({
        servicio: 'Env\u00edo est\u00e1ndar a domicilio',
        precio: precioBase,
        diasMin: dias.min,
        diasMax: dias.max,
        tipo: 'domicilio',
        proveedor: 'estimado'
      })

      opciones.push({
        servicio: 'Retiro en sucursal',
        precio: Math.round(precioBase * 0.8),
        diasMin: dias.min,
        diasMax: dias.max + 1,
        tipo: 'sucursal',
        proveedor: 'estimado'
      })

      opciones.push({
        servicio: 'Env\u00edo express',
        precio: Math.round(precioBase * 1.6),
        diasMin: Math.max(1, dias.min - 1),
        diasMax: Math.max(2, dias.max - 2),
        tipo: 'domicilio',
        proveedor: 'estimado'
      })
    }

    res.json({
      opciones: opciones.sort((a, b) => a.precio - b.precio),
      pesoCalculado: pesoFinal,
      esEstimado: opciones.every(o => o.proveedor === 'estimado'),
      nota: opciones.every(o => o.proveedor === 'estimado')
        ? 'Precios estimados. El costo final se confirma al procesar el env\u00edo con Correo Argentino o Andreani.'
        : 'Cotizaci\u00f3n en tiempo real del proveedor.'
    })
  } catch (error) {
    console.error('Error cotizando env\u00edo:', error.message)
    res.status(500).json({ error: 'Error al cotizar env\u00edo' })
  }
})

export default router
