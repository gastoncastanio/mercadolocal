/**
 * DeslindeComisionista — aviso legal que deja en claro que MercadoLocal SOLO
 * conecta comprador y comisionista. El traslado y todo problema que surja
 * (rotura, accidente, demora, etc.) quedan 100% a cargo del comisionista y el
 * vendedor. La plataforma no tiene responsabilidad alguna.
 *
 * Se muestra en el checkout antes de pedir una cotización y en el perfil del
 * comisionista. Si `requiereAceptacion`, expone un checkbox controlado.
 */
interface Props {
  aceptado?: boolean
  onAceptar?: (v: boolean) => void
  requiereAceptacion?: boolean
}

export default function DeslindeComisionista({ aceptado, onAceptar, requiereAceptacion }: Props) {
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-ml-ink leading-relaxed space-y-2">
      <p className="font-bold text-amber-800 flex items-center gap-2">
        <span className="text-base">⚠️</span> Importante: leé antes de continuar
      </p>
      <p>
        <strong>MercadoLocal es solamente la plataforma donde el comisionista publica su
        servicio de trabajo.</strong> El traslado de tu compra es un acuerdo privado entre
        vos, el vendedor y el comisionista.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          Cualquier problema durante el traslado (rotura, accidente, demora, pérdida, etc.)
          se resuelve <strong>entre el vendedor y el comisionista</strong>.
        </li>
        <li>
          Si el comisionista reporta que algo se rompió, el vendedor te
          <strong> devuelve el dinero</strong> o te ofrece el mismo producto (o uno similar).
        </li>
        <li>
          En caso de accidentes, daños, lesiones o cualquier hecho durante el transporte,
          <strong> MercadoLocal no tiene ningún tipo de responsabilidad legal</strong>.
        </li>
        <li>
          Cada comisionista cargó la documentación de su vehículo y fue verificado por la
          plataforma, pero la contratación del traslado corre por tu cuenta y riesgo.
        </li>
      </ul>

      {requiereAceptacion && (
        <label className="flex items-start gap-2 pt-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!aceptado}
            onChange={(e) => onAceptar?.(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-ml-violet shrink-0"
          />
          <span className="font-semibold">
            Entiendo y acepto que MercadoLocal no es responsable del traslado, y que cualquier
            problema lo resuelvo con el vendedor y el comisionista.
          </span>
        </label>
      )}
    </div>
  )
}
