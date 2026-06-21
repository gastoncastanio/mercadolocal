import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Punto del rumbo: una ciudad con coordenadas opcionales. Si no tiene lat/lng,
// no se puede dibujar en el mapa (solo cuenta para el texto).
export interface PuntoRumbo {
  ciudad: string
  lat?: number | null
  lng?: number | null
}

interface Props {
  origen?: PuntoRumbo | null
  destino?: PuntoRumbo | null
  paradas?: PuntoRumbo[]
  altura?: number // px
}

// Marcadores de color por tipo de punto, dibujados como divIcon (sin depender de
// los PNG de Leaflet, que no resuelven bien con el bundler). Pin tipo "gota".
function pin(color: string, label: string) {
  return L.divIcon({
    className: 'mapa-rumbo-pin',
    html: `<div style="
      background:${color};width:26px;height:26px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700;">${label}</span>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24]
  })
}

const ICONO_ORIGEN = pin('#22c55e', 'A')
const ICONO_DESTINO = pin('#ef4444', 'B')
const ICONO_PARADA = pin('#8b5cf6', '•')

function tieneCoords(p?: PuntoRumbo | null): p is PuntoRumbo & { lat: number; lng: number } {
  return !!p && Number.isFinite(p.lat as number) && Number.isFinite(p.lng as number)
}

/**
 * Mapa que dibuja el rumbo de un viaje: origen (A, verde) → paradas (violeta) →
 * destino (B, rojo), unidos por una línea. Usa OpenStreetMap (gratis, sin key).
 *
 * Robusto: si ningún punto tiene coordenadas, no renderiza el mapa (devuelve un
 * aviso liviano), evitando un MapContainer vacío que no aporta nada.
 */
export default function MapaRumbo({ origen, destino, paradas = [], altura = 280 }: Props) {
  // Ruta ordenada: origen → paradas (en orden) → destino, solo los geolocalizados.
  const puntos = useMemo(() => {
    const lista: (PuntoRumbo & { lat: number; lng: number; tipo: 'origen' | 'parada' | 'destino' })[] = []
    if (tieneCoords(origen)) lista.push({ ...origen, tipo: 'origen' })
    for (const p of paradas) if (tieneCoords(p)) lista.push({ ...p, tipo: 'parada' })
    if (tieneCoords(destino)) lista.push({ ...destino, tipo: 'destino' })
    return lista
  }, [origen, destino, paradas])

  const linea = useMemo(() => puntos.map((p) => [p.lat, p.lng] as [number, number]), [puntos])

  // Centro y zoom: si hay puntos, encuadra todos; si no, no muestra el mapa.
  const bounds = useMemo(() => {
    if (puntos.length === 0) return null
    return L.latLngBounds(linea)
  }, [puntos, linea])

  if (puntos.length === 0) {
    return (
      <div
        className="rounded-xl border border-ml-line bg-ml-bg flex items-center justify-center text-sm text-ml-muted text-center px-4"
        style={{ height: altura }}
      >
        Sin ubicaciones en el mapa. Elegí origen y destino desde el buscador para ver el rumbo.
      </div>
    )
  }

  const centro = bounds!.getCenter()

  return (
    <div className="rounded-xl overflow-hidden border border-ml-line" style={{ height: altura }}>
      <MapContainer
        center={[centro.lat, centro.lng]}
        zoom={7}
        bounds={puntos.length > 1 ? bounds! : undefined}
        boundsOptions={{ padding: [40, 40] }}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {linea.length > 1 && (
          <Polyline positions={linea} pathOptions={{ color: '#8b5cf6', weight: 4, opacity: 0.8, dashArray: '8 6' }} />
        )}
        {puntos.map((p, i) => (
          <Marker
            key={`${p.ciudad}-${i}`}
            position={[p.lat, p.lng]}
            icon={p.tipo === 'origen' ? ICONO_ORIGEN : p.tipo === 'destino' ? ICONO_DESTINO : ICONO_PARADA}
          >
            <Popup>
              <strong>{p.tipo === 'origen' ? 'Origen' : p.tipo === 'destino' ? 'Destino' : 'Pasa por'}</strong>
              <br />
              {p.ciudad}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
