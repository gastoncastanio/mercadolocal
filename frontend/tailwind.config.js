/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        secondary: '#1E40AF',
        // Paleta del diseño "Mercado Local - Futuro"
        ml: {
          ink: '#101024',     // títulos / texto fuerte
          slate: '#3a3a48',   // texto medio
          soft: '#5f5f70',    // párrafos
          muted: '#9a9aa8',   // texto tenue / placeholders
          line: '#eeeef3',    // bordes suaves
          line2: '#f0f0f5',   // bordes/separadores
          bg: '#fafafc',      // fondos suaves
          blue: '#2563eb',    // azul de marca
          purple: '#7c3aed',  // violeta de marca
          violet: '#6d28d9',
          indigo: '#5b21b6',
          mp: '#009ee3',      // azul Mercado Pago
          dark: '#0d0d1c',    // footer
          night: '#0b0b1a',   // sección red de ciudad
        },
      },
      fontFamily: {
        // Manrope para texto, Plus Jakarta Sans para títulos (font-display)
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
