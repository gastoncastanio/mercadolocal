import { Link } from 'react-router-dom'

export default function Terminos() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm p-8 md:p-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-800">Terminos y Condiciones</h1>
          <p className="text-gray-500 mt-2">Ultima actualizacion: 1 de abril de 2026</p>
        </div>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          {/* 1. Aceptacion */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Aceptacion de los Terminos</h2>
            <p>
              Al acceder, registrarse o utilizar la plataforma MercadoLocal (en adelante, "la Plataforma"), el usuario acepta
              de manera integra y sin reservas los presentes Terminos y Condiciones. Si no esta de acuerdo con alguna de
              estas condiciones, debera abstenerse de utilizar la Plataforma.
            </p>
            <p className="mt-2">
              La Plataforma es operada desde la Republica Argentina y se rige por la legislacion argentina vigente.
            </p>
          </section>

          {/* 2. Registro y Cuentas */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Registro y Cuentas de Usuario</h2>
            <p>
              Para utilizar los servicios de MercadoLocal es necesario crear una cuenta proporcionando informacion veraz,
              completa y actualizada. El usuario es responsable de mantener la confidencialidad de sus credenciales de acceso
              y de todas las actividades que se realicen bajo su cuenta.
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>El usuario debe ser mayor de 18 anos o contar con autorizacion de su representante legal.</li>
              <li>Cada persona fisica o juridica podra registrar una unica cuenta.</li>
              <li>MercadoLocal se reserva el derecho de suspender o cancelar cuentas que incumplan estos terminos.</li>
              <li>El usuario debera notificar de inmediato cualquier uso no autorizado de su cuenta.</li>
            </ul>
          </section>

          {/* 3. Responsabilidades del Comprador */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Responsabilidades del Comprador</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>Verificar las caracteristicas, precio y condiciones del producto antes de realizar la compra.</li>
              <li>Proporcionar datos de contacto y direccion de entrega correctos y completos.</li>
              <li>Realizar el pago en tiempo y forma a traves de los medios habilitados en la Plataforma.</li>
              <li>Comunicarse con el vendedor a traves de los canales provistos por la Plataforma ante cualquier inconveniente.</li>
              <li>Respetar los plazos de reclamo establecidos para disputas (7 dias corridos desde la recepcion del producto).</li>
            </ul>
          </section>

          {/* 4. Responsabilidades del Vendedor */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Responsabilidades del Vendedor</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>Publicar informacion precisa, veraz y completa sobre los productos ofrecidos.</li>
              <li>Mantener actualizado el stock y los precios de sus publicaciones.</li>
              <li>Entregar los productos en las condiciones y plazos acordados con el comprador.</li>
              <li>Cumplir con la normativa fiscal y tributaria aplicable (emision de factura, monotributo, etc.).</li>
              <li>Responder consultas y reclamos de los compradores en un plazo razonable (maximo 48 horas habiles).</li>
              <li>No ofrecer productos prohibidos o que infrinjan derechos de terceros.</li>
            </ul>
          </section>

          {/* 5. Comisiones */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Estructura de Comisiones</h2>
            <p>
              MercadoLocal cobra una comision del <strong>10% (diez por ciento)</strong> sobre el precio final de cada venta
              realizada a traves de la Plataforma. Esta comision se descuenta automaticamente del monto de la transaccion
              antes de acreditar el saldo al vendedor.
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>La comision incluye el uso de la plataforma, visibilidad del producto y soporte basico.</li>
              <li>No se cobran tarifas de inscripcion ni cuotas mensuales por mantener una tienda activa.</li>
              <li>Los costos de procesamiento de pago de Mercado Pago son adicionales y corren por cuenta del vendedor segun las condiciones de dicho servicio.</li>
              <li>MercadoLocal se reserva el derecho de modificar la comision con un preaviso de 30 dias.</li>
            </ul>
          </section>

          {/* 6. Procesamiento de Pagos */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Procesamiento de Pagos</h2>
            <p>
              Todos los pagos se procesan a traves de <strong>Mercado Pago</strong>, plataforma de pagos de terceros.
              MercadoLocal no almacena datos de tarjetas de credito ni informacion financiera sensible de los usuarios.
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>El comprador sera redirigido a Mercado Pago para completar el pago de forma segura.</li>
              <li>Los metodos de pago disponibles son los habilitados por Mercado Pago (tarjetas, transferencia, efectivo, etc.).</li>
              <li>Los fondos del vendedor se acreditaran segun los plazos y condiciones establecidos por Mercado Pago.</li>
              <li>MercadoLocal no es responsable de demoras o inconvenientes en el procesamiento de pagos atribuibles a Mercado Pago.</li>
            </ul>
          </section>

          {/* 7. Publicaciones */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Publicaciones de Productos</h2>
            <p>
              Los vendedores son los unicos responsables del contenido de sus publicaciones. MercadoLocal no verifica
              la exactitud de la informacion publicada pero se reserva el derecho de eliminar publicaciones que incumplan
              estos terminos.
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Las fotografias deben ser reales y representar fielmente el producto ofrecido.</li>
              <li>Los precios deben incluir IVA cuando corresponda y estar expresados en pesos argentinos (ARS).</li>
              <li>Esta prohibido publicar informacion enganosa, falsa o que induzca a error al comprador.</li>
              <li>MercadoLocal podra solicitar documentacion adicional para verificar la autenticidad de los productos.</li>
            </ul>
          </section>

          {/* 8. Productos Prohibidos */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Productos Prohibidos</h2>
            <p>
              Queda expresamente prohibido publicar, ofrecer o vender a traves de la Plataforma los siguientes productos:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Armas de fuego, municiones y explosivos.</li>
              <li>Sustancias estupefacientes o psicoactivas ilegales.</li>
              <li>Medicamentos sin autorizacion de la ANMAT.</li>
              <li>Productos falsificados o que infrinjan derechos de propiedad intelectual.</li>
              <li>Productos robados o de procedencia ilicita.</li>
              <li>Animales vivos o productos derivados de especies protegidas.</li>
              <li>Contenido pornografico o para adultos.</li>
              <li>Datos personales de terceros.</li>
              <li>Cualquier producto cuya venta este prohibida por la legislacion argentina.</li>
            </ul>
          </section>

          {/* 9. Disputas */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Resolucion de Disputas</h2>
            <p>
              En caso de controversias entre compradores y vendedores, se seguira el siguiente procedimiento:
            </p>
            <ol className="list-decimal ml-6 mt-2 space-y-2">
              <li>
                <strong>Comunicacion directa:</strong> Las partes intentaran resolver el conflicto directamente a traves
                de los canales de la Plataforma en un plazo de 5 dias habiles.
              </li>
              <li>
                <strong>Mediacion de MercadoLocal:</strong> Si no se llega a un acuerdo, cualquiera de las partes podra
                solicitar la mediacion de MercadoLocal, que evaluara el caso y emitira una resolucion en un plazo de
                10 dias habiles.
              </li>
              <li>
                <strong>Reembolso:</strong> MercadoLocal podra ordenar el reembolso total o parcial al comprador cuando
                el producto no coincida con la descripcion, no sea entregado, o presente defectos no informados.
              </li>
              <li>
                <strong>Instancia judicial:</strong> Agotada la instancia de mediacion, las partes podran recurrir a la
                justicia ordinaria. Sera competente la justicia de la Ciudad Autonoma de Buenos Aires.
              </li>
            </ol>
          </section>

          {/* 10. Limitacion de Responsabilidad */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">10. Limitacion de Responsabilidad</h2>
            <p>
              MercadoLocal actua como intermediario tecnologico entre compradores y vendedores. En tal caracter:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>No garantiza la calidad, seguridad, legalidad o veracidad de los productos publicados.</li>
              <li>No es responsable por la efectiva entrega de los productos por parte del vendedor.</li>
              <li>No es responsable de danos directos, indirectos, incidentales o consecuentes derivados del uso de la Plataforma.</li>
              <li>No garantiza la disponibilidad ininterrumpida de la Plataforma.</li>
              <li>La responsabilidad maxima de MercadoLocal en ningun caso excedera el monto de las comisiones cobradas al usuario en los ultimos 12 meses.</li>
            </ul>
          </section>

          {/* 11. Privacidad */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">11. Privacidad y Datos Personales</h2>
            <p>
              El tratamiento de datos personales se rige por nuestra{' '}
              <Link to="/privacidad" className="text-blue-600 hover:underline font-medium">
                Politica de Privacidad
              </Link>
              , la cual forma parte integrante de estos Terminos y Condiciones, y se ajusta a la Ley 25.326 de Proteccion
              de Datos Personales de la Republica Argentina.
            </p>
          </section>

          {/* 12. Contacto */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">12. Informacion de Contacto</h2>
            <p>Para consultas relacionadas con estos Terminos y Condiciones, puede contactarnos a traves de:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Email: <span className="text-blue-600">soporte@mercadolocal.com.ar</span></li>
              <li>Formulario de contacto disponible en la Plataforma.</li>
              <li>Domicilio legal: Ciudad Autonoma de Buenos Aires, Republica Argentina.</li>
            </ul>
          </section>

          {/* 13. Modificaciones */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">13. Modificacion de los Terminos</h2>
            <p>
              MercadoLocal se reserva el derecho de modificar los presentes Terminos y Condiciones en cualquier momento.
              Las modificaciones seran notificadas a los usuarios a traves de la Plataforma y/o por correo electronico
              con al menos 15 dias de anticipacion a su entrada en vigencia.
            </p>
            <p className="mt-2">
              El uso continuado de la Plataforma despues de la fecha de entrada en vigencia de las modificaciones implica
              la aceptacion de los nuevos terminos. En caso de desacuerdo, el usuario podra dar de baja su cuenta sin
              costo alguno.
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
