import { useEffect, useState } from 'react'

/**
 * Carrito 3D flotante que rota segun el scroll de la pagina.
 * Fixed en el fondo (z-index bajo) para dar profundidad sin interferir.
 * Usa CSS 3D transforms (sin dependencias) - cubo con 6 caras.
 */
export default function CarritoFlotante3D() {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Cada 400px de scroll = 360deg de rotacion
  const rotacionY = (scrollY / 400) * 360
  const rotacionX = (scrollY / 800) * 180
  // Leve movimiento vertical y horizontal
  const translateY = Math.sin(scrollY / 300) * 20
  const translateX = Math.cos(scrollY / 400) * 15

  const caras = [
    { emoji: '\u{1F6D2}', transform: 'rotateY(0deg) translateZ(90px)', color: 'from-blue-500/30 to-purple-500/30' },
    { emoji: '\u{1F4E6}', transform: 'rotateY(90deg) translateZ(90px)', color: 'from-orange-500/30 to-red-500/30' },
    { emoji: '\u{1F6CD}\uFE0F', transform: 'rotateY(180deg) translateZ(90px)', color: 'from-pink-500/30 to-fuchsia-500/30' },
    { emoji: '\u{1F4B3}', transform: 'rotateY(-90deg) translateZ(90px)', color: 'from-green-500/30 to-emerald-500/30' },
    { emoji: '\u{1F3EA}', transform: 'rotateX(90deg) translateZ(90px)', color: 'from-indigo-500/30 to-blue-500/30' },
    { emoji: '\u2B50', transform: 'rotateX(-90deg) translateZ(90px)', color: 'from-yellow-400/30 to-orange-400/30' }
  ]

  return (
    <div
      className="fixed top-1/2 right-4 sm:right-12 md:right-24 lg:right-40 pointer-events-none hidden sm:block"
      style={{
        zIndex: 0,
        transform: `translate3d(${translateX}px, ${translateY}px, 0)`,
        perspective: '800px'
      }}
      aria-hidden="true"
    >
      <div
        style={{
          width: '180px',
          height: '180px',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: `rotateY(${rotacionY}deg) rotateX(${rotacionX}deg)`,
          transition: 'transform 0.1s linear'
        }}
      >
        {caras.map((cara, i) => (
          <div
            key={i}
            className={`absolute inset-0 flex items-center justify-center rounded-3xl border-2 border-white/30 bg-gradient-to-br ${cara.color} backdrop-blur-sm shadow-2xl`}
            style={{
              transform: cara.transform,
              backfaceVisibility: 'visible'
            }}
          >
            <span className="text-7xl opacity-40 drop-shadow-lg">{cara.emoji}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
