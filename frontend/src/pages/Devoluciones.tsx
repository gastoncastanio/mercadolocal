import { Link } from 'react-router-dom'

export default function Devoluciones() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-12 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm p-5 sm:p-8 md:p-12">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-block text-5xl mb-3">&#x1F504;</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Pol&iacute;tica de Devoluciones</h1>
          <p className="text-gray-500 mt-2 text-sm">&Uacute;ltima actualizaci&oacute;n: 6 de abril de 2026</p>
        </div>

        {/* Resumen rápido destacado */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-l-4 border-blue-500 rounded-xl p-5 sm:p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span>&#x2139;&#xFE0F;</span> Resumen r&aacute;pido
          </h2>
          <ul className="space-y-2 text-sm sm:text-base text-gray-700">
            <li className="flex gap-2">
              <span className="text-blue-600 font-bold shrink-0">1.</span>
              <span>El comprador debe enviar el producto de vuelta al vendedor en las <strong>mismas condiciones</strong> en que lo recibi&oacute;.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600 font-bold shrink-0">2.</span>
              <span>El vendedor revisa el producto y <strong>confirma a MercadoLocal</strong> que est&aacute; todo en orden.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600 font-bold shrink-0">3.</span>
              <span>Una vez confirmado por el vendedor, procesamos la devoluci&oacute;n en un plazo <strong>m&aacute;ximo de 48 horas</strong>.</span>
            </li>
          </ul>
        </div>

        <div className="space-y-7 text-gray-700 leading-relaxed text-sm sm:text-base">
          {/* 1. Cómo funciona */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. C&oacute;mo funciona nuestro sistema de pagos</h2>
            <p>
              MercadoLocal act&uacute;a como <strong>intermediario seguro</strong> entre compradores y vendedores.
              El dinero de cada compra queda retenido por nosotros hasta que el comprador confirme que recibi&oacute;
              el producto en las condiciones esperadas. Reci&eacute;n a las 24 horas de esa confirmaci&oacute;n liberamos
              el pago al vendedor.
            </p>
            <p className="mt-2">
              Este sistema protege a ambas partes: el comprador no pierde su dinero si algo sale mal, y el vendedor
              tiene la garant&iacute;a de cobrar cuando el comprador queda conforme.
            </p>
          </section>

          {/* 2. Cuándo se puede pedir devolución */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Cu&aacute;ndo pod&eacute;s pedir una devoluci&oacute;n</h2>
            <p>Pod&eacute;s abrir un reclamo <strong>antes de confirmar la entrega</strong> en los siguientes casos:</p>
            <ul className="list-disc ml-5 sm:ml-6 mt-2 space-y-1">
              <li>El producto nunca lleg&oacute; a tu domicilio.</li>
              <li>El producto recibido no coincide con lo publicado (diferente modelo, color, talle, etc.).</li>
              <li>El producto lleg&oacute; da&ntilde;ado o defectuoso.</li>
              <li>El producto est&aacute; usado siendo publicado como nuevo.</li>
              <li>Falta alg&uacute;n componente, accesorio o documentaci&oacute;n del producto.</li>
            </ul>
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              <strong>Importante:</strong> una vez que confirmes la recepci&oacute;n del producto en la plataforma,
              se libera el pago al vendedor y no pod&eacute;s abrir un reclamo por este medio. Revis&aacute; bien
              el producto antes de confirmar.
            </div>
          </section>

          {/* 3. Proceso paso a paso */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Proceso de devoluci&oacute;n paso a paso</h2>
            <div className="space-y-3">
              {[
                {
                  n: 1,
                  titulo: 'Abr&iacute;s el reclamo',
                  desc: 'Desde "Mis pedidos" seleccion&aacute;s la compra y hac&eacute;s click en "Abrir reclamo". Explic&aacute;s el motivo y adjunt&aacute;s fotos si es necesario.'
                },
                {
                  n: 2,
                  titulo: 'Coordin&aacute;s con el vendedor',
                  desc: 'Mediante el chat de la plataforma coordin&aacute;s con el vendedor la devoluci&oacute;n del producto. El costo de env&iacute;o de devoluci&oacute;n corre por cuenta del responsable seg&uacute;n el motivo.'
                },
                {
                  n: 3,
                  titulo: 'Envi&aacute;s el producto',
                  desc: 'Envi&aacute;s el producto de vuelta al vendedor en las mismas condiciones en que lo recibiste (embalaje original, accesorios, etc.).'
                },
                {
                  n: 4,
                  titulo: 'El vendedor verifica y confirma',
                  desc: 'Cuando el vendedor recibe el producto, lo revisa y nos informa a MercadoLocal que est&aacute; en las mismas condiciones en que lo entreg&oacute;.'
                },
                {
                  n: 5,
                  titulo: 'Recib&iacute;s el reembolso',
                  desc: 'Desde el momento en que el vendedor confirma el estado del producto, MercadoLocal procesa la devoluci&oacute;n del 100% del monto pagado en un plazo m&aacute;ximo de 48 horas.'
                }
              ].map(p => (
                <div key={p.n} className="flex gap-3 sm:gap-4 items-start">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm sm:text-base shrink-0 shadow">
                    {p.n}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800" dangerouslySetInnerHTML={{ __html: p.titulo }} />
                    <p className="text-xs sm:text-sm text-gray-600 mt-0.5" dangerouslySetInnerHTML={{ __html: p.desc }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Casos especiales */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Condiciones y casos especiales</h2>
            <ul className="list-disc ml-5 sm:ml-6 space-y-2">
              <li>
                <strong>Producto en las mismas condiciones:</strong> el producto debe devolverse con el embalaje
                original, sin uso, con todos los accesorios, manuales y etiquetas que ten&iacute;a al momento de la entrega.
              </li>
              <li>
                <strong>Verificaci&oacute;n del vendedor:</strong> la devoluci&oacute;n del dinero solo se realiza
                una vez que el vendedor recibe el producto de vuelta, verifica que est&aacute; en las condiciones
                acordadas y nos notifica formalmente a trav&eacute;s de la plataforma.
              </li>
              <li>
                <strong>Plazo de 48 horas:</strong> desde el aviso del vendedor, MercadoLocal se compromete a procesar
                el reembolso en un plazo m&aacute;ximo de 48 horas h&aacute;biles.
              </li>
              <li>
                <strong>Desacuerdo entre las partes:</strong> si el vendedor rechaza el estado del producto devuelto,
                se abre una mediaci&oacute;n formal donde el equipo de MercadoLocal revisa evidencias (fotos, chats,
                comprobantes) y toma una decisi&oacute;n final dentro de las 72 horas h&aacute;biles.
              </li>
              <li>
                <strong>Productos no reembolsables:</strong> por razones de higiene, seguridad o naturaleza del producto,
                algunos art&iacute;culos pueden no ser elegibles para devoluci&oacute;n (ej: productos de belleza abiertos,
                alimentos perecederos, productos personalizados a pedido).
              </li>
            </ul>
          </section>

          {/* 5. M&eacute;todo de reembolso */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. M&eacute;todo de reembolso</h2>
            <p>
              El reembolso se realiza por el mismo medio de pago que utilizaste en la compra. Si pagaste con tarjeta
              de cr&eacute;dito o d&eacute;bito, el dinero vuelve a la misma tarjeta. Si pagaste con dinero en cuenta
              de Mercado Pago, vuelve a tu cuenta.
            </p>
            <p className="mt-2">
              Los tiempos de acreditaci&oacute;n pueden variar seg&uacute;n el banco o procesador de pagos (entre 24
              y 72 horas h&aacute;biles adicionales luego de nuestro procesamiento).
            </p>
          </section>

          {/* 6. Contacto */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Contacto</h2>
            <p>
              Si ten&eacute;s dudas sobre una devoluci&oacute;n o necesit&aacute;s ayuda con un reclamo, escribinos a{' '}
              <span className="text-blue-600">soporte@mercadolocal.com.ar</span> indicando el n&uacute;mero de pedido.
            </p>
          </section>

          {/* Links a otras políticas */}
          <section className="pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Esta Pol&iacute;tica forma parte de los{' '}
              <Link to="/terminos" className="text-blue-600 hover:underline">T&eacute;rminos y Condiciones</Link>
              {' '}y la{' '}
              <Link to="/privacidad" className="text-blue-600 hover:underline">Pol&iacute;tica de Privacidad</Link>
              {' '}de MercadoLocal.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 text-center">
          <Link to="/" className="text-blue-600 hover:underline font-medium">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
