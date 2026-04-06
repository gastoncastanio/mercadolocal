import { MercadoPagoConfig, Preference } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
})

// Crear preferencia de pago (Checkout Pro)
export async function crearPreferencia(orden, compradorEmail) {
  const preference = new Preference(client)

  const items = orden.items.map(item => ({
    id: item.productoId.toString(),
    title: item.nombre,
    quantity: item.cantidad,
    unit_price: item.precioUnitario,
    currency_id: 'ARS'
  }))

  const result = await preference.create({
    body: {
      items,
      payer: {
        email: compradorEmail
      },
      external_reference: orden._id.toString()
    }
  })

  return {
    preferenceId: result.id,
    initPoint: result.init_point,
    sandboxInitPoint: result.sandbox_init_point
  }
}
