// ==================== MARKETPLACE TYPES ====================

export interface Usuario {
  _id: string
  email: string
  nombre: string
  // 'vendedor' es un rol legacy (cuentas previas a la unificación); las cuentas
  // nuevas son 'comprador' y activan la venta con tieneVendedor.
  rol: 'comprador' | 'vendedor' | 'admin'
  tieneVendedor?: boolean
  avatar: string
  direccion: string
  telefono: string
  activo: boolean
  createdAt?: string
}

export interface Tienda {
  _id: string
  usuarioId: string | Usuario
  nombre: string
  descripcion: string
  logo: string
  ciudad: string
  tipo: 'fisica' | 'online' | 'ambas'
  telefono: string
  calificacion: number
  totalVentas: number
  ganancias: number
  activo: boolean
  // Estado de vinculación con Mercado Pago (requisito para vender)
  mpVinculado?: boolean
  mpVinculadoEn?: string
  createdAt?: string
}

export interface Producto {
  _id: string
  tiendaId: string | Tienda
  nombre: string
  descripcion: string
  precio: number
  stock: number
  imagenes: string[]
  categorias: string[]
  ciudad: string
  calificacion: number
  totalVentas: number
  activo: boolean
  peso?: number
  alto?: number
  ancho?: number
  largo?: number
  envioGratis?: boolean
  condicion?: 'nuevo' | 'usado' | 'reacondicionado'
  garantia?: string
  caracteristicas?: { clave: string; valor: string }[]
  // Código de barras universal (EAN-13/UPC-A/etc) — opcional, obligatorio en categorías
  // de alto riesgo (electrónica, alimentos, belleza, electrodomésticos)
  codigoBarras?: string
  // Marca del producto (Samsung, Apple, etc.) — distinta de la tienda que lo vende
  marca?: string
  // Modalidades de entrega que ofrece el vendedor. Costos NO se procesan
  // dentro de la app — se coordinan aparte entre comprador y vendedor.
  entrega?: EntregaProducto
  createdAt?: string
}

export interface EntregaProducto {
  retiroEnLocal: {
    activo: boolean
    direccion: string
    horarios: string
  }
  envioPropio: {
    activo: boolean
    zonas: string
    notas: string
  }
  envioCorreo: {
    activo: boolean
    empresas: string
  }
}

/** Valor por defecto al crear un producto nuevo */
export const ENTREGA_VACIA: EntregaProducto = {
  retiroEnLocal: { activo: false, direccion: '', horarios: '' },
  envioPropio: { activo: false, zonas: '', notas: '' },
  envioCorreo: { activo: false, empresas: '' }
}

export interface ItemCarrito {
  _id: string
  productoId: string
  tiendaId: string
  nombre: string
  precio: number
  cantidad: number
  imagen: string
}

export interface Carrito {
  _id: string
  usuarioId: string
  items: ItemCarrito[]
}

export interface ItemOrden {
  // productoId puede venir como string o populated con { _id, imagenes, nombre }
  productoId: string | { _id: string; imagenes?: string[]; nombre?: string }
  // tiendaId puede venir como string (vista vendedor) o populated (vista comprador)
  tiendaId: string | { _id: string; nombre: string; logo?: string; telefono?: string; ciudad?: string }
  nombre: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

export interface Orden {
  _id: string
  compradorId: string | Usuario
  items: ItemOrden[]
  total: number
  comision: number
  porcentajeComision: number
  gananciaVendedor: number
  estado: 'pendiente' | 'pagada' | 'enviada' | 'completada' | 'cancelada'
  direccionEntrega: string
  notasComprador: string
  nombreComprador: string
  telefonoComprador: string
  // Datos del envío (cuando estado === 'enviada' o posterior)
  codigoSeguimiento?: string
  empresaEnvio?: string
  fechaEnvio?: string
  // Pago confirmado (cuando estado === 'pagada' o posterior)
  fechaConfirmacion?: string
  createdAt?: string
  updatedAt?: string
}

export interface AuthResponse {
  usuario: Usuario
  tienda?: Tienda | null
  token: string
}

export interface CarritoResponse {
  carrito: Carrito
  total: number
}

export interface DashboardAdmin {
  totalOrdenes: number
  totalVentas: number
  totalComisiones: number
  ordenesCompletadas: number
  ordenesPendientes: number
  totalProductos: number
  totalUsuarios: number
  totalVendedores: number
  totalCompradores: number
}

export interface Resena {
  _id: string
  compradorId: string | Usuario
  productoId: string | Producto
  ordenId: string
  calificacion: number
  comentario: string
  respuestaVendedor: string
  createdAt?: string
}

export interface Disputa {
  _id: string
  ordenId: string | Orden
  compradorId: string | Usuario
  vendedorId: string | Usuario
  motivo: 'producto_defectuoso' | 'no_recibido' | 'diferente_descripcion' | 'otro'
  descripcion: string
  estado: 'abierta' | 'en_revision' | 'resuelta_comprador' | 'resuelta_vendedor' | 'cerrada'
  resolucion: string
  createdAt?: string
}

export interface Mensaje {
  _id: string
  conversacionId: string
  emisorId: string | Usuario
  receptorId: string | Usuario
  productoId?: string | Producto
  mensaje: string
  leido: boolean
  createdAt?: string
}

export interface Conversacion {
  _id: string
  ultimoMensaje: Mensaje
  noLeidos: number
  otroUsuario?: Usuario
}

export interface ConfigSitio {
  _id: string
  clave: string
  valor: string
  tipo: 'texto' | 'numero' | 'boolean' | 'imagen' | 'html'
  categoria: string
  descripcion: string
}

// Legacy types for compatibility
export interface Proyecto {
  _id?: string
  nombreMarca: string
  descripcion: string
  valores: string[]
  estilo: EstiloPredefinido
  parametros: ParametrosPersonalizacion
  logos: Logo[]
  fechaCreacion?: Date
  usuarioId?: string
}

export interface Logo {
  _id?: string
  proyectoId: string
  url: string
  estilo: EstiloPredefinido
  parametros: ParametrosPersonalizacion
  favorito: boolean
  fechaCreacion?: Date
}

export interface Variacion {
  _id?: string
  logoOriginalId: string
  cambios: ParametrosPersonalizacion
  url: string
  fechaCreacion?: Date
}

export type EstiloPredefinido =
  | 'minimalista'
  | 'moderno'
  | 'clasico'
  | 'corporativo'
  | 'creativo'
  | 'tech'
  | 'vintage'
  | 'geometrico'
  | 'elegante'
  | 'jugueton'

export interface ParametrosPersonalizacion {
  coloresPrimarios: string[]
  coloresSecundarios?: string[]
  tipografia?: string
  elementos?: string[]
  complejidad?: 'simple' | 'medio' | 'complejo'
  orientacion?: 'horizontal' | 'vertical' | 'cuadrado'
}

export interface GeneracionRequest {
  nombreMarca: string
  descripcion: string
  valores: string[]
  estilo: EstiloPredefinido
  parametros: ParametrosPersonalizacion
  cantidadLogos?: number
}
