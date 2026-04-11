export default function MarqueeBanner() {
  const items = [
    { text: 'Pago protegido en todas tus compras', icon: '\u{1F6E1}\uFE0F' },
    { text: 'Env\u00edos a todo el pa\u00eds', icon: '\u{1F69A}' },
    { text: 'Hasta 12 cuotas sin inter\u00e9s', icon: '\u{1F4B3}' },
    { text: 'Cre\u00e1 tu tienda gratis', icon: '\u{1F3EA}' },
    { text: '+350 vendedores activos', icon: '\u2B50' },
    { text: 'Soporte 24/7', icon: '\u{1F4AC}' }
  ]

  const repeats = Array.from({ length: 4 }, (_, i) => i)

  return (
    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 overflow-hidden">
      <div className="relative flex whitespace-nowrap py-2">
        <div className="flex animate-marquee whitespace-nowrap">
          {repeats.map(r =>
            items.map((item, i) => (
              <span key={`a${r}-${i}`} className="mx-6 text-xs sm:text-sm font-medium text-white/90 inline-flex items-center gap-2">
                <span>{item.icon}</span>
                {item.text}
                <span className="text-white/30 mx-2">&bull;</span>
              </span>
            ))
          )}
        </div>
        <div className="flex animate-marquee whitespace-nowrap" aria-hidden="true">
          {repeats.map(r =>
            items.map((item, i) => (
              <span key={`b${r}-${i}`} className="mx-6 text-xs sm:text-sm font-medium text-white/90 inline-flex items-center gap-2">
                <span>{item.icon}</span>
                {item.text}
                <span className="text-white/30 mx-2">&bull;</span>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
