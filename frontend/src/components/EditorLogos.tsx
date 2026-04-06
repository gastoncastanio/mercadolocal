import { useRef, useEffect } from 'react'
import { Logo } from '../types'

interface EditorLogosProps {
  logo: Logo;
  onGuardar?: (cambios: Partial<Logo>) => void;
}

export default function EditorLogos({ logo, onGuardar }: EditorLogosProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current && logo.url) {
      const ctx = canvasRef.current.getContext('2d')
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = logo.url
      img.onload = () => {
        ctx?.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height)
      }
    }
  }, [logo.url])

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Editor de Logo</h3>

      <div className="bg-gray-100 rounded-lg p-4">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="w-full max-w-md mx-auto border-2 border-gray-300 rounded"
        />
      </div>

      <div className="space-y-3">
        <h4 className="font-medium text-gray-800">Herramientas</h4>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-outline">Brillo</button>
          <button className="btn btn-outline">Contraste</button>
          <button className="btn btn-outline">Girar</button>
          <button className="btn btn-outline">Invertir</button>
        </div>
      </div>

      <button
        onClick={() => onGuardar?.(logo)}
        className="w-full btn btn-primary"
      >
        Guardar Cambios
      </button>
    </div>
  )
}
