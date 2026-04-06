import { EstiloPredefinido } from '../types'

interface SelectorEstiloProps {
  onSelect: (estilo: EstiloPredefinido) => void;
  estiloSeleccionado?: EstiloPredefinido;
}

const ESTILOS: Array<{
  id: EstiloPredefinido;
  nombre: string;
  descripcion: string;
  ejemplos: string[];
}> = [
  {
    id: 'minimalista',
    nombre: 'Minimalista',
    descripcion: 'Limpio, simple y elegante. Menos es más.',
    ejemplos: ['Apple', 'Twitter', 'Uber'],
  },
  {
    id: 'moderno',
    nombre: 'Moderno',
    descripcion: 'Contemporáneo y dinámico. Líneas limpias.',
    ejemplos: ['Google', 'Spotify', 'Airbnb'],
  },
  {
    id: 'clasico',
    nombre: 'Clásico',
    descripcion: 'Tradicional y atemporal. Estilo Heritage.',
    ejemplos: ['Volkswagen', 'Ford', 'Coca-Cola'],
  },
  {
    id: 'corporativo',
    nombre: 'Corporativo',
    descripcion: 'Profesional y confiable. Para empresas B2B.',
    ejemplos: ['IBM', 'Microsoft', 'Goldman Sachs'],
  },
  {
    id: 'creativo',
    nombre: 'Creativo',
    descripcion: 'Artístico y expresivo. Colorido e imaginativo.',
    ejemplos: ['Adobe', 'Slack', 'Dropbox'],
  },
  {
    id: 'tech',
    nombre: 'Tech',
    descripcion: 'Futurista y digital. Para startups tech.',
    ejemplos: ['Tesla', 'Meta', 'GitHub'],
  },
  {
    id: 'vintage',
    nombre: 'Vintage',
    descripcion: 'Retro y nostálgico. Con carácter histórico.',
    ejemplos: ['Harley-Davidson', 'Levi\'s', 'Leica'],
  },
  {
    id: 'geometrico',
    nombre: 'Geométrico',
    descripcion: 'Formas básicas y matemáticas.',
    ejemplos: ['Mastercard', 'Audi', 'Toyota'],
  },
  {
    id: 'elegante',
    nombre: 'Elegante',
    descripcion: 'Lujo y sofisticación. Premium brands.',
    ejemplos: ['Gucci', 'Louis Vuitton', 'Hermès'],
  },
  {
    id: 'jugueton',
    nombre: 'Juguetón',
    descripcion: 'Divertido y amigable. Para entretenimiento.',
    ejemplos: ['Nintendo', 'LEGO', 'Coca-Cola Kids'],
  },
]

export default function SelectorEstilo({ onSelect, estiloSeleccionado }: SelectorEstiloProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Elige el Estilo de tu Logo
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Selecciona el estilo que mejor representa tu marca. Podrás personalizarlo después.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ESTILOS.map((estilo) => (
          <button
            key={estilo.id}
            onClick={() => onSelect(estilo.id)}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              estiloSeleccionado === estilo.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-gray-900">{estilo.nombre}</h4>
                <p className="text-sm text-gray-600">{estilo.descripcion}</p>
              </div>
              {estiloSeleccionado === estilo.id && (
                <div className="text-blue-600 text-xl">✓</div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Ej: {estilo.ejemplos.join(', ')}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
