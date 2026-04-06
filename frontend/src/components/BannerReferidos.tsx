import { useState } from 'react'

interface BannerReferidosProps {
  codigoReferido: string
}

export default function BannerReferidos({ codigoReferido }: BannerReferidosProps) {
  const [copiado, setCopiado] = useState(false)

  const baseUrl = window.location.origin
  const linkReferido = `${baseUrl}/registro?ref=${encodeURIComponent(codigoReferido)}`
  const mensajeWhatsApp = `Unite a MercadoLocal, el marketplace de tu ciudad. Registrate con mi codigo y empeza a comprar y vender: ${linkReferido}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp)}`

  function copiarCodigo() {
    navigator.clipboard.writeText(codigoReferido)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-sm p-6 md:p-8 text-white">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left">
          <h3 className="text-2xl font-bold mb-2">Invita amigos y gana</h3>
          <p className="text-blue-100">
            Comparti tu codigo con amigos. Cuando se registren y hagan su primera compra, ambos ganan beneficios.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 flex-shrink-0">
          <div className="bg-white bg-opacity-20 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-sm text-blue-100">Tu codigo:</span>
            <span className="font-mono font-bold text-lg">{codigoReferido}</span>
            <button
              onClick={copiarCodigo}
              className="ml-2 px-3 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-sm font-medium transition-all"
              title="Copiar codigo"
            >
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:shadow-lg transition-all hover:scale-105"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Compartir por WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
