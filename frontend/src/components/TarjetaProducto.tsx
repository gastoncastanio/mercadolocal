import { Link } from 'react-router-dom'
import { Producto, Tienda } from '../types'
import { imgCloudinary } from '../utils/cloudinary'
import { valorCuotaSinInteres, formatPesos } from '../utils/cuotas'
import BadgeVerificado from './BadgeVerificado'

interface Props {
  producto: Producto
}

export default function TarjetaProducto({ producto }: Props) {
  const tienda = producto.tiendaId as Tienda

  // Oferta REAL: precioAnterior lo setea el vendedor y debe ser > precio actual.
  const precioAnterior = (producto.precioAnterior && producto.precioAnterior > producto.precio)
    ? producto.precioAnterior
    : null
  const porcentajeOff = precioAnterior ? Math.round((1 - producto.precio / precioAnterior) * 100) : null

  // Badge de condición (solo para usados/reacondicionados; los nuevos no lo necesitan)
  const condicionLabel = producto.condicion === 'usado'
    ? 'Usado'
    : producto.condicion === 'reacondicionado'
      ? 'Reacondicionado'
      : null

  // Cuotas SIN interés que ofrece el vendedor (precio ya incluye el costo).
  const cuotasMax = producto.cuotasSinInteres || 1
  const valorCuotaMax = valorCuotaSinInteres(producto.precio, cuotasMax)
  const tieneTienda = tienda && typeof tienda === 'object'
  const inicial = (tieneTienda && tienda.nombre ? tienda.nombre : producto.nombre).charAt(0).toUpperCase()
  // Nombre corto (editable por el vendedor) para no romper el layout de la tarjeta.
  const nombreTienda = tieneTienda ? (tienda.nombreCorto || tienda.nombre) : ''

  return (
    <Link
      to={`/producto/${producto._id}`}
      className="mlc bg-white rounded-[18px] border border-ml-line overflow-hidden group flex flex-col relative"
    >
      {/* Imagen */}
      <div className="relative aspect-square overflow-hidden flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg,#f3f3f8,#eef0fb)' }}>
        {producto.imagenes && producto.imagenes.length > 0 ? (
          <img
            src={imgCloudinary(producto.imagenes[0], 400)}
            alt={producto.nombre}
            loading="lazy"
            width={400}
            height={400}
            className="ph max-w-full max-h-full object-contain"
          />
        ) : (
          <span className="text-5xl opacity-50">{'\u{1F4E6}'}</span>
        )}

        {/* Pauta: producto promocionado (publicidad pagada, ordenado por relevancia) */}
        {(producto as any).promocionado && (
          <span className="absolute top-3 left-3 bg-amber-400 text-amber-950 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 7.1-1.01z"/></svg>
            Promocionado
          </span>
        )}

        {!(producto as any).promocionado && (producto as any).esDestacado && (
          <span className="absolute top-3 left-3 ml-grad text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
            {'\u{1F525}'} Top ventas
          </span>
        )}

        {/* Badge de condición (sección Usados) */}
        {!(producto as any).esDestacado && !(producto as any).promocionado && condicionLabel && (
          <span className="absolute top-3 left-3 bg-white/95 text-ml-ink text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm border border-ml-line">
            {condicionLabel}
          </span>
        )}

        {porcentajeOff && (
          <span className="absolute bottom-3 left-3 bg-ml-mp text-ml-ink text-[11px] font-extrabold px-2.5 py-1 rounded-lg shadow-sm">
            {porcentajeOff}% OFF
          </span>
        )}

        {/* Corazón (favorito visual) */}
        <span className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 flex items-center justify-center shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2}>
            <path d="M19 14c1.5-1.5 3-3.3 3-5.5A3.5 3.5 0 0 0 12 6 3.5 3.5 0 0 0 2 8.5c0 2.2 1.5 4 3 5.5l7 7Z" />
          </svg>
        </span>

        {producto.stock <= 0 && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex items-center justify-center">
            <span className="text-sm font-semibold text-ml-muted bg-white border border-ml-line px-3 py-1 rounded-full">Sin stock</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Precio */}
        <div className="flex items-baseline gap-2">
          <span className="font-display font-extrabold text-[20px] text-ml-ink">${producto.precio.toLocaleString('es-AR')}</span>
          {precioAnterior && (
            <span className="text-[13px] text-ml-muted line-through">${precioAnterior.toLocaleString('es-AR')}</span>
          )}
        </div>

        {/* Cuotas SIN interés que ofrece el vendedor (precio ya las incluye).
            Solo si ofrece más de 1 cuota. */}
        {cuotasMax > 1 && (
          <p className="text-[12px] text-[#0a7d34] font-semibold mt-0.5">
            {cuotasMax} cuotas sin interés de ${formatPesos(valorCuotaMax)}
          </p>
        )}

        {/* Envío gratis */}
        {producto.envioGratis && (
          <p className="text-[12px] text-[#0a7d34] font-bold mt-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Env&iacute;o gratis
          </p>
        )}

        {/* Nombre */}
        <h3 className="font-display font-semibold text-[14.5px] text-ml-ink leading-snug line-clamp-2 mt-2 flex-1 group-hover:text-ml-blue transition-colors">{producto.nombre}</h3>

        {/* Tienda */}
        {tieneTienda && (tienda.nombre || tienda.ciudad) && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-ml-line2">
            <span className="shrink-0 w-6 h-6 rounded-full ml-grad text-white text-[11px] font-bold flex items-center justify-center">{inicial}</span>
            {nombreTienda && <span className="text-[12.5px] text-ml-soft font-semibold truncate">{nombreTienda}</span>}
            {tienda.oficial && <BadgeVerificado className="w-4 h-4 shrink-0" titulo="Tienda Oficial verificada" />}
            {tienda.ciudad && (
              <span className="ml-auto shrink-0 flex items-center gap-0.5 text-[11.5px] text-ml-muted whitespace-nowrap">
                <svg className="w-3 h-3 text-ml-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <circle cx="12" cy="11" r="2.5" />
                </svg>
                {tienda.ciudad}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
