import { Resend } from 'resend'
import * as Brevo from 'brevo'

/**
 * Servicio de email para MercadoLocal.
 * Soporta dos proveedores, se auto-detecta según qué clave esté configurada:
 *
 * 1. BREVO (recomendado temporalmente, sin dominio):
 *    - Gratis hasta 300 emails/día.
 *    - No requiere dominio verificado.
 *    - Email FROM debe ser verificado en Brevo (clic en un link de confirmación).
 *    - Variables: BREVO_API_KEY, EMAIL_FROM
 *
 * 2. RESEND (cuando compres dominio mercadolocal.com.ar):
 *    - 100 emails/día gratis.
 *    - Requiere dominio verificado.
 *    - Variables: RESEND_API_KEY, EMAIL_FROM
 */

let resendClient = null
let brevoClient = null

function getResend() {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

function getBrevo() {
  if (!brevoClient && process.env.BREVO_API_KEY) {
    brevoClient = new Brevo.TransactionalEmailsApi()
    // Autenticar con API key de Brevo
    brevoClient.setApiKey(Brevo.ApiClient.instance.authentications['api-key'], process.env.BREVO_API_KEY)
  }
  return brevoClient
}

const EMAIL_FROM = () => process.env.EMAIL_FROM || 'MercadoLocal <admmercadolocal@gmail.com>'

// Detectar qué proveedor usar (Brevo si está configurado, sino Resend)
function proveedorActivo() {
  if (process.env.BREVO_API_KEY) return 'brevo'
  if (process.env.RESEND_API_KEY) return 'resend'
  return null
}

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
        <span>🛒 MercadoLocal</span>
      </div>
      ${contenido}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} MercadoLocal - El marketplace de tu ciudad</p>
      <p>Este email fue enviado automáticamente. No respondas a este mensaje.</p>
    </div>
  </div>
</body>
</html>`
}

// ==================== EMAILS ====================

/**
 * Email de recuperación de contraseña con código de 6 dígitos.
 */
export async function enviarCodigoRecuperacion(email, nombre, codigo) {
  const html = templateBase(`
    <h1>Recuperá tu contraseña</h1>
    <p>Hola${nombre ? ' ' + nombre : ''},</p>
    <p>Recibimos una solicitud para restablecer tu contraseña en MercadoLocal. Usá este código:</p>
    <div class="code">
      <span>${codigo}</span>
    </div>
    <p>El código expira en <strong>30 minutos</strong>.</p>
    <div class="warning">
      ⚠️ Si no solicitaste este cambio, ignorá este email. Tu contraseña no será modificada.
    </div>
  `)

  return enviarEmail({
    to: email,
    subject: `${codigo} es tu código de MercadoLocal`,
    html
  })
}

/**
 * Email de bienvenida al registrarse.
 */
export async function enviarBienvenida(email, nombre, rol) {
  const esVendedor = rol === 'vendedor'
  const html = templateBase(`
    <h1>¡Bienvenido a MercadoLocal!</h1>
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Tu cuenta fue creada con éxito como <strong>${esVendedor ? 'vendedor' : 'comprador'}</strong>.</p>
    ${esVendedor
      ? '<p>🏪 Ya podés configurar tu tienda, subir productos y empezar a vender.</p>'
      : '<p>🛒 Explorá el catálogo y encontrá productos de tiendas locales.</p>'
    }
    <div style="text-align: center; margin: 24px 0;">
      <a href="${process.env.FRONTEND_URL || 'https://mercadolocal-nu.vercel.app'}/catalogo" class="btn">
        ${esVendedor ? 'Configurar mi tienda' : 'Explorar catálogo'}
      </a>
    </div>
    <p style="font-size: 13px; color: #6b7280;">
      Recordemos: MercadoLocal es un intermediario. Tu dinero queda protegido hasta que confirmes la entrega.
    </p>
  `)

  return enviarEmail({
    to: email,
    subject: `¡Bienvenido a MercadoLocal, ${nombre}!`,
    html
  })
}

/**
 * Email de confirmación de compra.
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
    <p>Tu compra fue registrada correctamente. Acá tenés el detalle:</p>
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
    <p>🛡️ Tu dinero queda retenido hasta que confirmes la entrega.</p>
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
 * Notificación al vendedor de nueva venta.
 */
export async function enviarNotificacionVenta(email, nombreVendedor, total, cantidadItems) {
  const html = templateBase(`
    <h1>🎉 ¡Nueva venta!</h1>
    <p>Hola <strong>${nombreVendedor}</strong>,</p>
    <p>Recibiste una nueva venta por <strong style="color: #059669; font-size: 20px;">$${total.toLocaleString('es-AR')}</strong></p>
    <p>${cantidadItems} ${cantidadItems === 1 ? 'producto' : 'productos'} vendidos. Preparálos para el envío lo antes posible.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${process.env.FRONTEND_URL || 'https://mercadolocal-nu.vercel.app'}/pedidos-vendedor" class="btn">
        Ver pedidos
      </a>
    </div>
  `)

  return enviarEmail({
    to: email,
    subject: `¡Venta nueva! $${total.toLocaleString('es-AR')}`,
    html
  })
}

/**
 * Recordatorio de compra abandonada.
 */
export async function enviarRecordatorioCompra(email, nombre, orden) {
  const itemsHtml = orden.items.map(i =>
    `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${i.nombre}</td>
      <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; text-align: center;">${i.cantidad}</td>
      <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; text-align: right;">$${i.subtotal.toLocaleString('es-AR')}</td>
    </tr>`
  ).join('')

  const html = templateBase(`
    <h1>Tu compra te espera</h1>
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Notamos que dejaste una compra sin completar. Tus productos siguen disponibles:</p>
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
    <div style="text-align: center; margin: 24px 0;">
      <a href="${process.env.FRONTEND_URL || 'https://mercadolocal-nu.vercel.app'}/mis-ordenes" class="btn">
        Completar mi compra
      </a>
    </div>
    <p style="font-size: 13px; color: #6b7280;">
      Si ya no querés estos productos, no hace falta que hagas nada. La orden se cancelará automáticamente.
    </p>
  `)

  return enviarEmail({
    to: email,
    subject: `${nombre}, tu compra te espera en MercadoLocal`,
    html
  })
}

/**
 * Envía el reporte diario del CEO Diego al fundador.
 */
export async function enviarReporteCEO(email, nombreAdmin, cuerpoReporte, metricas = {}) {
  const fecha = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  const cuerpoHtml = (cuerpoReporte || '')
    .split(/\n\n+/)
    .map(parrafo => `<p style="margin: 0 0 14px; color: #374151; font-size: 14px; line-height: 1.7;">${
      parrafo.replace(/\n/g, '<br>')
    }</p>`)
    .join('')

  let tarjetasMetricas = ''
  if (metricas && Object.keys(metricas).length > 0) {
    const items = []
    if (metricas.ventas != null) items.push({ l: 'Ventas', v: '$' + (metricas.ventas || 0).toLocaleString('es-AR'), c: '#059669' })
    if (metricas.comisiones != null) items.push({ l: 'Comisiones', v: '$' + (metricas.comisiones || 0).toLocaleString('es-AR'), c: '#2563eb' })
    if (metricas.ordenes != null) items.push({ l: 'Órdenes', v: String(metricas.ordenes), c: '#7c3aed' })
    if (metricas.productosNuevos != null) items.push({ l: 'Productos nuevos', v: String(metricas.productosNuevos), c: '#ea580c' })

    if (items.length) {
      tarjetasMetricas = `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 20px;">
          <tr>
            ${items.map(i => `
              <td style="background: #f9fafb; border-radius: 10px; padding: 14px; text-align: center;">
                <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">${i.l}</div>
                <div style="font-size: 18px; font-weight: 700; color: ${i.c}; margin-top: 4px;">${i.v}</div>
              </td>
            `).join('<td style="width: 8px;"></td>')}
          </tr>
        </table>
      `
    }
  }

  const contenido = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
      <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #1e40af, #7c3aed); display: inline-flex; align-items: center; justify-content: center; font-size: 24px;">🎩</div>
      <div style="display: inline-block; vertical-align: middle; margin-left: 12px;">
        <div style="font-weight: 700; color: #1f2937; font-size: 15px;">Diego — CEO MercadoLocal</div>
        <div style="font-size: 12px; color: #6b7280;">Reporte ejecutivo · ${fecha}</div>
      </div>
    </div>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0 20px;">
    ${tarjetasMetricas}
    ${cuerpoHtml}
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px;">
    <p style="font-size: 12px; color: #6b7280; margin: 0;">
      Hola ${nombreAdmin}, este reporte se genera automáticamente cada día con datos reales del marketplace.
      Para ver el chat en vivo del equipo IA, ingresá al panel de admin.
    </p>
    <div style="text-align: center; margin-top: 16px;">
      <a href="${process.env.FRONTEND_URL?.split(',')[0]?.trim() || 'https://mercadolocal.com.ar'}/admin/cerebro" class="btn">Ir al panel del equipo</a>
    </div>
  `

  return enviarEmail({
    to: email,
    subject: `📊 Reporte diario · ${fecha}`,
    html: templateBase(contenido)
  })
}

// ==================== CORE ====================

/**
 * Envía un email usando Brevo o Resend según cuál esté configurado.
 */
async function enviarEmail({ to, subject, html }) {
  const proveedor = proveedorActivo()

  if (!proveedor) {
    console.log(`📧 [EMAIL NO ENVIADO - sin BREVO_API_KEY ni RESEND_API_KEY]`)
    console.log(`   Para: ${to}`)
    console.log(`   Asunto: ${subject}`)
    console.log(`   Configura BREVO_API_KEY (o RESEND_API_KEY) en Railway para habilitar emails.`)
    return { enviado: false, motivo: 'Sin API key de email' }
  }

  if (proveedor === 'brevo') {
    return enviarConBrevo({ to, subject, html })
  } else {
    return enviarConResend({ to, subject, html })
  }
}

async function enviarConBrevo({ to, subject, html }) {
  const client = getBrevo()
  if (!client) {
    return { enviado: false, motivo: 'Brevo no inicializado' }
  }

  try {
    const emailFrom = EMAIL_FROM()
    // EMAIL_FROM puede ser "nombre <email@dominio.com>" — Brevo necesita extraerlo
    const matchEmail = emailFrom.match(/<([^>]+)>/)
    const from = matchEmail ? matchEmail[1] : emailFrom

    const sendSmtpEmail = new Brevo.SendSmtpEmail()
    sendSmtpEmail.subject = subject
    sendSmtpEmail.htmlContent = html
    sendSmtpEmail.sender = { name: 'MercadoLocal', email: from }
    sendSmtpEmail.to = [{ email: to }]

    const result = await client.sendTransacEmail(sendSmtpEmail)
    console.log(`✉️ Email enviado a ${to} vía Brevo: ${subject}`)
    return { enviado: true, id: result?.id }
  } catch (error) {
    const motivo = error.message || String(error)
    console.error(`❌ Error en Brevo enviando a ${to}:`, motivo)
    avisarSiBrevoNoVerificado(motivo)
    return { enviado: false, motivo }
  }
}

async function enviarConResend({ to, subject, html }) {
  const client = getResend()
  if (!client) {
    return { enviado: false, motivo: 'Resend no inicializado' }
  }

  try {
    const result = await client.emails.send({
      from: EMAIL_FROM(),
      to,
      subject,
      html
    })

    if (result?.error) {
      const motivo = result.error.message || JSON.stringify(result.error)
      console.error(`❌ Resend rechazó el email a ${to}: ${motivo}`)
      avisarSiDominioNoVerificado(motivo)
      return { enviado: false, motivo }
    }

    console.log(`✉️ Email enviado a ${to} vía Resend: ${subject}`)
    return { enviado: true, id: result.data?.id }
  } catch (error) {
    const motivo = error.message || String(error)
    console.error(`❌ Error en Resend enviando a ${to}:`, motivo)
    avisarSiDominioNoVerificado(motivo)
    return { enviado: false, motivo }
  }
}

function avisarSiBrevoNoVerificado(motivo = '') {
  const m = String(motivo).toLowerCase()
  if (m.includes('not verified') || m.includes('sender')) {
    console.error(
      '⚠️ El email FROM en Brevo no está verificado. Necesitas: ' +
      '1) Ir a https://app.brevo.com/sender-management (Senders) ' +
      '2) Clickear en el email que usas en EMAIL_FROM y confirmar el link que recibas en tu inbox. ' +
      '3) Esperá a que figure "Verified".'
    )
  }
}

function avisarSiDominioNoVerificado(motivo = '') {
  const m = String(motivo).toLowerCase()
  if (m.includes('testing') || m.includes('verify a domain') || m.includes('own email')) {
    console.error(
      '⚠️ Estás usando el dominio de PRUEBA de Resend (onboarding@resend.dev), ' +
      'que solo envía a tu propia casilla. Para enviar a cualquier cliente: ' +
      '1) verificá tu dominio en resend.com/domains y ' +
      '2) poné EMAIL_FROM con una dirección de ese dominio (ej: "MercadoLocal <noreply@mercadolocal.com.ar>").'
    )
  }
}
