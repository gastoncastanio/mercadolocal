export default function MarqueeBanner() {
  const mensaje = 'Compr\u00e1 y vend\u00e9 en un solo lugar al mejor precio'
  // Repetimos el texto para un efecto continuo
  const items = Array.from({ length: 8 }, (_, i) => i)

  return (
    <div className="bg-white border-b border-gray-200 overflow-hidden">
      <div className="relative flex whitespace-nowrap py-2">
        <div className="flex animate-marquee whitespace-nowrap">
          {items.map(i => (
            <span key={`a${i}`} className="mx-8 text-sm sm:text-base font-semibold text-gray-900 inline-flex items-center gap-2">
              <span className="text-blue-600">&#x2728;</span>
              {mensaje}
              <span className="text-purple-600">&#x1F6D2;</span>
            </span>
          ))}
        </div>
        <div className="flex animate-marquee whitespace-nowrap" aria-hidden="true">
          {items.map(i => (
            <span key={`b${i}`} className="mx-8 text-sm sm:text-base font-semibold text-gray-900 inline-flex items-center gap-2">
              <span className="text-blue-600">&#x2728;</span>
              {mensaje}
              <span className="text-purple-600">&#x1F6D2;</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
