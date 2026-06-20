import ConfigSitio from '../models/ConfigSitio.js'

// Configuraciones por defecto del marketplace
const DEFAULTS = [
  // General
  { clave: 'sitio_nombre', valor: 'MercadoLocal', tipo: 'texto', categoria: 'General', descripcion: 'Nombre del marketplace' },
  { clave: 'sitio_descripcion', valor: 'Tu marketplace local de confianza', tipo: 'texto', categoria: 'General', descripcion: 'Descripción corta del sitio' },
  { clave: 'sitio_logo', valor: '', tipo: 'imagen', categoria: 'General', descripcion: 'Logo del marketplace (URL)' },
  { clave: 'sitio_color_primario', valor: '#2563eb', tipo: 'color', categoria: 'General', descripcion: 'Color principal del sitio' },
  { clave: 'sitio_color_secundario', valor: '#7c3aed', tipo: 'color', categoria: 'General', descripcion: 'Color secundario/acento' },

  // Landing
  { clave: 'landing_titulo', valor: 'Comprá y vendé en tu ciudad', tipo: 'texto', categoria: 'Landing', descripcion: 'Título principal de la landing page' },
  { clave: 'landing_subtitulo', valor: 'El marketplace local que conecta vendedores y compradores de tu zona', tipo: 'texto', categoria: 'Landing', descripcion: 'Subtítulo de la landing page' },
  { clave: 'landing_cta_comprador', valor: 'Explorar Productos', tipo: 'texto', categoria: 'Landing', descripcion: 'Texto del botón para compradores' },
  { clave: 'landing_cta_vendedor', valor: 'Empezar a Vender', tipo: 'texto', categoria: 'Landing', descripcion: 'Texto del botón para vendedores' },
  { clave: 'landing_banner_imagen', valor: '', tipo: 'imagen', categoria: 'Landing', descripcion: 'Imagen del banner principal' },

  // Negocio
  { clave: 'comision_porcentaje', valor: '10', tipo: 'numero', categoria: 'Negocio', descripcion: 'Porcentaje de comisión por venta de productos (%)' },
  { clave: 'comision_por_categoria', valor: '{}', tipo: 'html', categoria: 'Negocio', descripcion: 'Comisión por categoría de producto (JSON: {"electronica": 8, "ropa": 12}). Vacío = usa comision_porcentaje para todas.' },
  { clave: 'comision_traslado_porcentaje', valor: '10', tipo: 'numero', categoria: 'Negocio', descripcion: 'Porcentaje de comisión sobre traslados de comisionistas (%)' },
  { clave: 'comision_minima', valor: '0', tipo: 'numero', categoria: 'Negocio', descripcion: 'Comisión mínima en ARS (piso absoluto, incluso con descuentos coopérativos)' },
  { clave: 'moneda_simbolo', valor: '$', tipo: 'texto', categoria: 'Negocio', descripcion: 'Símbolo de moneda' },
  { clave: 'moneda_nombre', valor: 'ARS', tipo: 'texto', categoria: 'Negocio', descripcion: 'Código de moneda (ARS, USD, etc.)' },
  { clave: 'envio_gratis_minimo', valor: '0', tipo: 'numero', categoria: 'Negocio', descripcion: 'Monto mínimo para envío gratis (0 = deshabilitado)' },

  // Tarifas y costos (alimentan el Calculador de Costos automáticamente)
  // Cargá acá UNA vez tus tarifas reales de Mercado Pago y se aplican a TODAS las ventas.
  { clave: 'tarifa_mp_plazo', valor: 'al instante', tipo: 'texto', categoria: 'Tarifas', descripcion: 'Plazo de acreditación elegido en tu cuenta de Mercado Pago (define el % de fee). Ej: "al instante", "en 10 días", "en 18 días".' },
  { clave: 'tarifa_mp_debito', valor: '3.49', tipo: 'numero', categoria: 'Tarifas', descripcion: 'Fee real de Mercado Pago para pago con débito / dinero en cuenta (%). Mirá tu tarifa en mercadopago.com.ar/costs-section.' },
  { clave: 'tarifa_mp_credito', valor: '6.29', tipo: 'numero', categoria: 'Tarifas', descripcion: 'Fee real de Mercado Pago para tarjeta de crédito en 1 pago (%).' },
  { clave: 'tarifa_mp_credito_cuotas', valor: '6.29', tipo: 'numero', categoria: 'Tarifas', descripcion: 'Fee real de Mercado Pago para tarjeta de crédito en cuotas (%). No incluye el interés de las cuotas (eso lo paga el comprador).' },
  { clave: 'tarifa_mp_mercadocredito', valor: '6.29', tipo: 'numero', categoria: 'Tarifas', descripcion: 'Fee real de Mercado Pago para pagos con Mercado Crédito (%).' },
  { clave: 'tarifa_iva_comision', valor: '0', tipo: 'numero', categoria: 'Tarifas', descripcion: 'IVA que MercadoLocal suma sobre su comisión (%). Poné 21 si MercadoLocal está inscripto en IVA y factura con IVA al vendedor; 0 si no corresponde.' },
  { clave: 'tarifa_cuotas_3', valor: '1.15', tipo: 'numero', categoria: 'Tarifas', descripcion: 'Coeficiente de recargo del comprador al pagar en 3 cuotas (1 = sin interés). Ej: 1.15 = +15%. Lo cobra el banco/MP, no MercadoLocal.' },
  { clave: 'tarifa_cuotas_6', valor: '1.30', tipo: 'numero', categoria: 'Tarifas', descripcion: 'Coeficiente de recargo del comprador al pagar en 6 cuotas (1 = sin interés). Ej: 1.30 = +30%.' },
  { clave: 'tarifa_cuotas_12', valor: '1.55', tipo: 'numero', categoria: 'Tarifas', descripcion: 'Coeficiente de recargo del comprador al pagar en 12 cuotas (1 = sin interés). Ej: 1.55 = +55%.' },
  { clave: 'tarifa_retenciones_aviso', valor: 'Según tu condición fiscal y jurisdicción, Mercado Pago puede practicar retenciones de IVA, Ganancias e Ingresos Brutos sobre tus cobros. Consultá tu situación en AFIP/ARCA.', tipo: 'texto', categoria: 'Tarifas', descripcion: 'Aviso informativo sobre retenciones impositivas al vendedor (no se calcula, solo se muestra).' },

  // Contacto
  { clave: 'contacto_email', valor: '', tipo: 'texto', categoria: 'Contacto', descripcion: 'Email de contacto/soporte' },
  { clave: 'contacto_whatsapp', valor: '', tipo: 'texto', categoria: 'Contacto', descripcion: 'Número de WhatsApp de soporte (con código país)' },
  { clave: 'contacto_instagram', valor: '', tipo: 'texto', categoria: 'Contacto', descripcion: 'Usuario de Instagram (sin @)' },

  // SEO
  { clave: 'seo_titulo', valor: 'MercadoLocal - Marketplace Local', tipo: 'texto', categoria: 'SEO', descripcion: 'Título para Google (meta title)' },
  { clave: 'seo_descripcion', valor: 'Comprá y vendé productos de tiendas locales en tu ciudad', tipo: 'texto', categoria: 'SEO', descripcion: 'Descripción para Google (meta description)' },
  { clave: 'seo_keywords', valor: 'marketplace, comprar, vender, local, tienda', tipo: 'texto', categoria: 'SEO', descripcion: 'Palabras clave para SEO' },

  // Mensajes
  { clave: 'msg_bienvenida', valor: '¡Bienvenido a MercadoLocal! Explorá productos de tiendas locales.', tipo: 'texto', categoria: 'Mensajes', descripcion: 'Mensaje de bienvenida después del registro' },
  { clave: 'msg_compra_exitosa', valor: '¡Gracias por tu compra! Tu pedido está en camino.', tipo: 'texto', categoria: 'Mensajes', descripcion: 'Mensaje después de compra exitosa' },
  { clave: 'msg_tienda_creada', valor: '¡Tu tienda fue creada! Ya podés publicar productos.', tipo: 'texto', categoria: 'Mensajes', descripcion: 'Mensaje después de crear tienda' },

  // Funcionalidades
  { clave: 'func_chat_activo', valor: 'true', tipo: 'boolean', categoria: 'Funcionalidades', descripcion: 'Habilitar chat entre usuarios' },
  { clave: 'func_disputas_activo', valor: 'true', tipo: 'boolean', categoria: 'Funcionalidades', descripcion: 'Habilitar sistema de disputas' },
  { clave: 'func_resenas_activo', valor: 'true', tipo: 'boolean', categoria: 'Funcionalidades', descripcion: 'Habilitar reseñas de productos' },
  { clave: 'func_registro_vendedor', valor: 'true', tipo: 'boolean', categoria: 'Funcionalidades', descripcion: 'Permitir registro de nuevos vendedores' },
  { clave: 'func_mantenimiento', valor: 'false', tipo: 'boolean', categoria: 'Funcionalidades', descripcion: 'Modo mantenimiento (desactiva el sitio)' },

  // Servicios Locales (Paso 2)
  { clave: 'suscripcion_profesional_precios', valor: '{"basico":{"precio":500,"duracion":30,"descripcion":"30 días destacado"},"premium":{"precio":1200,"duracion":90,"descripcion":"90 días destacado"}}', tipo: 'html', categoria: 'Servicios', descripcion: 'Planes de suscripción para profesionales (JSON)' },
  { clave: 'func_servicios_activo', valor: 'true', tipo: 'boolean', categoria: 'Funcionalidades', descripcion: 'Habilitar módulo de Servicios Locales (Paso 2)' },
]

// Inicializar configuraciones por defecto
export async function inicializarConfig() {
  for (const config of DEFAULTS) {
    await ConfigSitio.findOneAndUpdate(
      { clave: config.clave },
      { $setOnInsert: config },
      { upsert: true, new: true }
    )
  }
}

// Obtener todas las configuraciones
export async function obtenerTodasConfig() {
  return await ConfigSitio.find().sort({ categoria: 1, clave: 1 })
}

// Obtener configuraciones por categoría
export async function obtenerConfigPorCategoria(categoria) {
  return await ConfigSitio.find({ categoria }).sort({ clave: 1 })
}

// Obtener una configuración por clave
export async function obtenerConfig(clave) {
  const config = await ConfigSitio.findOne({ clave })
  return config ? config.valor : null
}

// Obtener múltiples configuraciones (para frontend público)
export async function obtenerConfigPublica(claves) {
  const configs = await ConfigSitio.find({ clave: { $in: claves } })
  const resultado = {}
  for (const c of configs) {
    resultado[c.clave] = c.valor
  }
  return resultado
}

// Actualizar una configuración
export async function actualizarConfig(clave, valor) {
  const config = await ConfigSitio.findOneAndUpdate(
    { clave },
    { valor },
    { new: true }
  )
  if (!config) throw new Error(`Configuración "${clave}" no encontrada`)
  return config
}

// Actualizar múltiples configuraciones
export async function actualizarMultiplesConfig(cambios) {
  const resultados = []
  for (const { clave, valor } of cambios) {
    const config = await ConfigSitio.findOneAndUpdate(
      { clave },
      { valor },
      { new: true }
    )
    if (config) resultados.push(config)
  }
  return resultados
}

// Obtener porcentaje de comisión según tipo
// tipo: 'venta' (productos) o 'traslado' (comisionistas)
export async function obtenerPorcentajeComision(tipo = 'venta') {
  const clave = tipo === 'traslado' ? 'comision_traslado_porcentaje' : 'comision_porcentaje'
  const valor = await obtenerConfig(clave)
  return valor ? parseFloat(valor) : (tipo === 'traslado' ? 10 : 10)
}

// Obtener comisión mínima en ARS
export async function obtenerComisionMinima() {
  const valor = await obtenerConfig('comision_minima')
  return valor ? parseFloat(valor) : 0
}

// Obtener porcentaje de comisión para una categoría específica
// Si hay tarifas por categoría y la categoría existe, usa esa; si no, usa default
export async function obtenerPorcentajeComisionPorCategoria(categoria, tipo = 'venta') {
  if (tipo !== 'venta') {
    return await obtenerPorcentajeComision(tipo)
  }

  const tarifasPorCategoria = await obtenerConfig('comision_por_categoria')
  if (!tarifasPorCategoria) {
    return await obtenerPorcentajeComision('venta')
  }

  try {
    const tarifas = typeof tarifasPorCategoria === 'string'
      ? JSON.parse(tarifasPorCategoria)
      : tarifasPorCategoria

    if (tarifas[categoria] !== undefined) {
      return parseFloat(tarifas[categoria])
    }
  } catch (e) {
    console.error('Error parsing comision_por_categoria:', e.message)
  }

  return await obtenerPorcentajeComision('venta')
}

// Calcular comisión con piso mínimo garantizado
// Asegura que la comisión nunca cae por debajo del mínimo (previene
// márgenes negativos con descuentos coopérativos)
export async function calcularComisionConPiso(monto, tipo = 'venta', categoria = null) {
  const porcentaje = categoria && tipo === 'venta'
    ? await obtenerPorcentajeComisionPorCategoria(categoria, tipo)
    : await obtenerPorcentajeComision(tipo)
  const porcentajeComision = Math.round(monto * porcentaje / 100 * 100) / 100
  const comisionMinima = await obtenerComisionMinima()
  return Math.max(porcentajeComision, comisionMinima)
}
