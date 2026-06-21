export default function MarqueeBanner() {
  const items = [
    { text: 'Pago protegido en todas tus compras', icon: '\u{1F6E1}\uFE0F' },
    { text: 'Compradores y vendedores de tu ciudad', icon: '\u{1F4CD}' },
    { text: 'Pagá en cuotas con Mercado Pago', icon: '\u{1F4B3}' },
    { text: 'Cre\u00e1 tu tienda gratis', icon: '\u{1F3EA}' },
    { text: '+350 vendedores activos', icon: '\u2B50' },
    { text: 'Soporte 24/7', icon: '\u{1F4AC}' }
  ]

  const repeats = Array.from({ length: 4 }, (_, i) => i)

  // Barra fina y discreta: poca altura, texto chico y separadores sutiles.
  const fila = (prefijo: string, oculto = false) => (
    <div className="flex animate-marquee whitespace-nowrap" aria-hidden={oculto || undefined}>
      {repeats.map(r =>
        items.map((item, i) => (
          <span key={`${prefijo}${r}-${i}`} className="inline-flex items-center text-[11px] font-medium text-white/85">
            <span className="mx-4 inline-flex items-center gap-1.5">
              <span className="text-[10px] opacity-80">{item.icon}</span>
              {item.text}
            </span>
            <span className="text-white/25">&bull;</span>
          </span>
        ))
      )}
    </div>
  )

  return (
    <div className="ml-grad overflow-hidden">
      <div className="relative flex whitespace-nowrap py-[5px]">
        {fila('a')}
        {fila('b', true)}
      </div>
    </div>
  )
}
