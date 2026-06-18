/**
 * ADAPTADOR FISCAL — ARCA (ex-AFIP) / Proveedor de facturación
 * ============================================================
 *
 * Este es el ÚNICO punto de conexión entre el marketplace y la facturación
 * electrónica oficial. Todo el resto del sistema (numeración, datos de
 * emisor/receptor, panel, disparadores automáticos, vista imprimible) ya está
 * armado y NO hay que tocarlo el día que salgamos a la cancha.
 *
 * ESTADO ACTUAL: DESCONECTADO.
 *   `solicitarCAE()` devuelve { autorizado: false }, así que los comprobantes
 *   se emiten como DOCUMENTOS INTERNOS (sin CAE, fiscal=false). El sistema
 *   funciona igual, sólo que esos comprobantes todavía no son válidos ante ARCA.
 *
 * CÓMO CONECTARLO (Fase 1) — implementar `solicitarCAE()`:
 *
 *   Opción A · Proveedor (recomendada: TusFacturas.app / Facturante / AFIP SDK)
 *     1. Crear cuenta y obtener API key.
 *     2. POST con los datos del comprobante (ya vienen todos en `comp`).
 *     3. El proveedor devuelve CAE, vencimiento y normalmente un PDF oficial.
 *
 *   Opción B · ARCA directo (WSAA + WSFE)
 *     1. Subir certificado digital y obtener el token con WSAA.
 *     2. Llamar a FECAESolicitar (WSFEv1) con el comprobante.
 *     3. Parsear CAE + CAEFchVto de la respuesta.
 *
 * Para activarlo: setear la variable de entorno FACTURACION_FISCAL=on y
 * completar la llamada real abajo. Sin esa variable, todo sigue en modo interno.
 *
 * CONTRATO DE RETORNO esperado por `facturacionService`:
 *   Éxito:  { autorizado: true, cae: '7512...', caeVencimiento: Date,
 *             pdfUrl?: 'https://...', numeroOficial?: 1234 }
 *   Fallo:  { autorizado: false, motivo: 'texto' }
 */

const FACTURACION_ACTIVA = process.env.FACTURACION_FISCAL === 'on'

/**
 * Solicita el CAE para un comprobante. Recibe el comprobante ya numerado y con
 * todos los datos cargados.
 *
 * @param {Object} comp - { tipo, letra, puntoVenta, numero, emisor, receptor, items, total }
 * @returns {Promise<{autorizado:boolean, cae?:string, caeVencimiento?:Date, pdfUrl?:string, numeroOficial?:number, motivo?:string}>}
 */
export async function solicitarCAE(comp) {
  if (!FACTURACION_ACTIVA) {
    return { autorizado: false, motivo: 'facturacion_fiscal_desactivada' }
  }

  // ───────────────────────────────────────────────────────────────────
  // FASE 1 — Acá va la integración real. Ejemplo con un proveedor:
  //
  //   const resp = await axios.post(PROVEEDOR_URL, construirPayload(comp), {
  //     headers: { Authorization: `Bearer ${process.env.FACTURACION_API_KEY}` }
  //   })
  //   return {
  //     autorizado: true,
  //     cae: resp.data.cae,
  //     caeVencimiento: new Date(resp.data.vencimiento_cae),
  //     pdfUrl: resp.data.comprobante_pdf,
  //     numeroOficial: resp.data.numero
  //   }
  // ───────────────────────────────────────────────────────────────────

  // Mientras no esté implementado, no autorizamos (queda como interno).
  return { autorizado: false, motivo: 'no_implementado' }
}

/**
 * ¿La facturación fiscal está activada por configuración?
 * Útil para mostrar carteles distintos en el panel ("interno" vs "fiscal").
 */
export function facturacionFiscalActiva() {
  return FACTURACION_ACTIVA
}
