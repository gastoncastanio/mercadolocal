/**
 * Sello de "verificado" estilo Instagram/Facebook: la ráfaga azul (seal de 12
 * puntas redondeadas) con el check blanco adentro. Reutilizable en toda la app
 * para marcar Tiendas Oficiales / marcas verificadas.
 */
interface Props {
  className?: string
  titulo?: string
}

export default function BadgeVerificado({ className = 'w-4 h-4', titulo = 'Verificado' }: Props) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label={titulo}>
      <title>{titulo}</title>
      {/* Ráfaga / seal */}
      <path
        fill="#3897F0"
        d="M19.998 3.094 14.638 0l-2.972 5.15H5.432v6.354L0 14.64 3.094 20 0 25.359l5.432 3.137v5.905h6.234L14.638 40l5.36-3.094L25.358 40l3.232-5.6h6.4v-6.358L40 25.359 36.905 20 40 14.641l-5.408-3.137V5.15h-6.18L25.358 0l-5.36 3.094Z"
      />
      {/* Check blanco */}
      <path
        d="M13.5 20.5l4 4 8.5-8.5"
        fill="none"
        stroke="#fff"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
