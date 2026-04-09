import { Resend } from 'resend'

/**
 * Servicio de email para MercadoLocal.
 * Usa Resend (resend.com) como proveedor principal.
 * Plan gratuito: 100 emails/d\u00eda, 3000/mes.
 *
 * Variables de entorno requeridas:
 *   RESEND_API_KEY  - API key de Resend
 *   EMAIL_FROM      - Email remitente (ej: "MercadoLocal <noreply@tudominio.com>")
 *                     Si us\u00e1s el dominio de prueba de Resend: "MercadoLocal <onboarding@resend.dev>"
 */

let resend = null

function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

const EMAIL_FROM = () => process.env.EMAIL_FROM || 'MercadoLocal <onboarding@resend.dev>'

// ==================== TEMPLATES ====================

function templateBase(contenido) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo span { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #2563eb, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .code { text-align: center; margin: 24px 0; padding: 16px; background: #f0f9ff; border-radius: 12px; border: 2px dashed #3b82f6; }
    .code span { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e40af; }
    .btn { display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
    .footer { text-align: center; margin-top: 24px; color: #9ca3af; font-size: 12px; }
    h1 { color: #1f2937; font-size: 22px; margin: 0 0 12px; }
    p { color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 12px; }
    .warning { background: #fef3c7; border-radius: 8px; padding: 12px; margin: 16px 0; color: #92400e; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <span>\u{1F6D2} MercadoLocal</span>
      </div>
      ${contenido}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} MercadoLocal - El marketplace de tu ciudad</p>
      <p>Este email fue enviado autom\u00e1ticamente. No respondas a este mensaje.</p>
    </div>
  </div>
</body>
</html>`
}

// ==================== EMAILS ====================

/**
 * Email de recuperaci\u00f3n de contrase\u00f1a con c\u00f3digo de 6 d\u00edgitos.
 */
export async function enviarCodigoRecuperacion(email, nombre, codigo) {
  const html = templateBase(`
    <h1>Recuper\u00e1 tu contrase\u00f1a</h1>
    <p>Hola${nombre ? ' ' + nombre : ''},</p>
    <p>Recibimos una solicitud para restablecer tu contrase\u00f1a en MercadoLocal. Us\u00e1 este c\u00f3digo:</p>
    <div class="code">
      <span>${codigo}</span>
    </div>
    <p>El c\u00f3digo expira en <strong>30 minutos</strong>.</p>
    <div class="warning">
      \u26A0\uFE0F Si no solicitaste este cambio, ignor\u00e1 este email. Tu contrase\u00f1a no ser\u00e1 modificada.
    </div>
  `)

  return enviarEmail({
    to: email,
    subject: `${codigo} es tu c\u00f3digo de MercadoLocal`,
    html
  })
}

/**
 * Email de bienvenida al registrarse.
 */
export async function enviarBienvenida(email, nombre, rol) {
  const esVendedor = rol === 'vendedor'
  const html = templateBase(`
    <h1>\u00a1Bienvenido a MercadoLocal!</h1>
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Tu cuenta fue creada con \u00e9xito como <strong>${esVendedor ? 'vendedor' : 'comprador'}</strong>.</p>
    ${esVendedor
      ? '<p>\u{1F3EA} Ya pod\u00e9s configurar tu tienda, subir productos y empezar a vender.</p>'
      : '<p>\u{1F6D2} Explor\u00e1 el cat\u00e1logo y encontr\u00e1 productos de tiendas locales.</p>'
    }
    <div style="text-align: center; margin: 24px 0;">
      <a href="${process.env.FRONTEND_URL || 'https://mercadolocal-nu.vercel.app'}/catalogo" class="btn">
        ${esVendedor ? 'Configurar mi tienda' : 'Explorar cat\u00e1logo'}
      </a>
    </div>
    <p style="font-size: 13px; color: #6b7280;">
      Recordemos: MercadoLocal es un intermediario. Tu dinero queda protegido hasta que confirmes la entrega.
    </p>
  `)

  return enviarEmail({
    to: email,
    subject: `\u00a1Bienvenido a MercadoLocal, ${nombre}!`,
    html
  })
}

/**
 * Email de confirmaci\u00f3n de compra.
 */
export async function enviarConfirmacionCompra(email, nombre, orden) {
  const itemsHtml = orden.items.map(i =>
    `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${i.nombre}</td>
      <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; text-align: center;">${i.cantidad}</td>
      <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; text-align: right;">$${i.subtotal.toLocaleString('es-AR')}</td>
    </tr>`
  ).join('')

  const html = templateBase(`
    <h1>Orden confirmada</h1>
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Tu compra fue registrada correctamente. Ac\u00e1 ten\u00e9s el detalle:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 8px; text-align: left;">Producto</th>
          <th style="padding: 8px; text-align: center;">Cant.</th>
          <th style="padding: 8px; text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding: 12px 8px; font-weight: 700;">Total</td>
          <td style="padding: 12px 8px; text-align: right; font-weight: 700; font-size: 18px; color: #2563eb;">$${orden.total.toLocaleString('es-AR')}</td>
        </tr>
      </tfoot>
    </table>
    <p>\u{1F6E1}\uFE0F Tu dinero queda retenido hasta que confirmes la entrega.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${process.env.FRONTEND_URL || 'https://mercadolocal-nu.vercel.app'}/mis-ordenes" class="btn">
        Ver mis pedidos
      </a>
    </div>
  `)

  return enviarEmail({
    to: email,
    subject: `Orden confirmada - $${orden.total.toLocaleString('es-AR')}`,
    html
  })
}

/**
 * Notificaci\u00f3n al vendedor de nueva venta.
 */
export async function enviarNotificacionVenta(email, nombreVendedor, total, cantidadItems) {
  const html = templateBase(`
    <h1>\u{1F389} \u00a1Nueva venta!</h1>
    <p>Hola <strong>${nombreVendedor}</strong>,</p>
    <p>Recibiste una nueva venta por <strong style="color: #059669; font-size: 20px;">$${total.toLocaleString('es-AR')}</strong></p>
    <p>${cantidadItems} ${cantidadItems === 1 ? 'producto' : 'productos'} vendidos. Prepar\u00e1 el env\u00edo lo antes posible.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${process.env.FRONTEND_URL || 'https://mercadolocal-nu.vercel.app'}/pedidos-vendedor" class="btn">
        Ver pedidos
      </a>
    </div>
  `)

  return enviarEmail({
    to: email,
    subject: `\u00a1Venta nueva! $${total.toLocaleString('es-AR')}`,
    html
  })
}

// ==================== CORE ====================

/**
 * Env\u00eda un email usando Resend.
 * Si RESEND_API_KEY no est\u00e1 configurada, loguea a consola y no falla.
 */
async function enviarEmail({ to, subject, html }) {
  const client = getResend()

  if (!client) {
    console.log(`\u{1F4E7} [EMAIL NO ENVIADO - sin RESEND_API_KEY]`)
    console.log(`   Para: ${to}`)
    console.log(`   Asunto: ${subject}`)
    console.log(`   Configur\u00e1 RESEND_API_KEY en las variables de entorno para habilitar emails.`)
    return { enviado: false, motivo: 'RESEND_API_KEY no configurada' }
  }

  try {
    const result = await client.emails.send({
      from: EMAIL_FROM(),
      to,
      subject,
      html
    })

    console.log(`\u2709\uFE0F Email enviado a ${to}: ${subject}`)
    return { enviado: true, id: result.data?.id }
  } catch (error) {
    console.error(`\u274C Error enviando email a ${to}:`, error.message)
    return { enviado: false, motivo: error.message }
  }
}
