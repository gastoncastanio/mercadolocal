// ==================== MARKETPLACE TYPES ====================

export interface Usuario {
  _id: string
  email: string
  nombre: string
  rol: 'comprador' | 'vendedor' | 'admin'
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
  createdAt?: string
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
  productoId: string
  tiendaId: string
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
  createdAt?: string
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
