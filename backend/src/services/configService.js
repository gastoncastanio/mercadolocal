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
  { clave: 'comision_porcentaje', valor: '10', tipo: 'numero', categoria: 'Negocio', descripcion: 'Porcentaje de comisión por venta (%)' },
  { clave: 'moneda_simbolo', valor: '$', tipo: 'texto', categoria: 'Negocio', descripcion: 'Símbolo de moneda' },
  { clave: 'moneda_nombre', valor: 'ARS', tipo: 'texto', categoria: 'Negocio', descripcion: 'Código de moneda (ARS, USD, etc.)' },
  { clave: 'envio_gratis_minimo', valor: '0', tipo: 'numero', categoria: 'Negocio', descripcion: 'Monto mínimo para envío gratis (0 = deshabilitado)' },

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
