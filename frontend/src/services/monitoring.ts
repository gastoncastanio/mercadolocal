/**
 * Reporte centralizado de errores del frontend.
 *
 * Hoy: consola del navegador (visible en dev y en los logs del cliente).
 * Mañana: si se instala e inicializa `@sentry/react`, exponé su instancia en
 * `window.Sentry` y este módulo la reenvía automáticamente — sin tocar a ninguno
 * de los que ya llaman `reportarError()`. Mantenemos una dependencia BLANDA
 * (detectada en runtime) para no acoplar el bundle a Sentry todavía.
 */

type Contexto = Record<string, unknown>

declare global {
  interface Window {
    // Lo setea @sentry/react cuando se inicialice (Sentry.init lo deja en window).
    Sentry?: { captureException: (e: unknown, ctx?: unknown) => void }
  }
}

/**
 * Reporta un error sin riesgo: nunca lanza, nunca frena la UI.
 * @param error  el error capturado
 * @param contexto info extra útil para depurar (ruta, usuario, acción, etc.)
 */
export function reportarError(error: unknown, contexto: Contexto = {}) {
  // Siempre a la consola.
  // eslint-disable-next-line no-console
  console.error('[monitoring]', error, contexto)

  // Reenvío opcional a Sentry si está presente. Envuelto en try/catch porque
  // el reporte de un error JAMÁS debe poder generar otro.
  try {
    window.Sentry?.captureException(error, { extra: contexto })
  } catch {
    /* no-op */
  }
}
