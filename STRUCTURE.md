# 📁 Estructura del Proyecto LogoAI

## 🏗️ Arquitectura General

```
logoai/
│
├── frontend/                     # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/          # 7 componentes reutilizables
│   │   │   ├── FormularioMarca.tsx         # Captura datos de marca
│   │   │   ├── SelectorEstilo.tsx          # Elige entre 10 estilos
│   │   │   ├── PersonalizadorEstilo.tsx    # Personaliza colores/elementos
│   │   │   ├── GaleriaLogos.tsx            # Muestra logos generados
│   │   │   ├── HistorialProyectos.tsx      # Lista de proyectos
│   │   │   ├── EditorLogos.tsx             # Editor de canvas
│   │   │   └── ComparadorVariaciones.tsx   # Compara variantes
│   │   │
│   │   ├── pages/               # 6 páginas principales
│   │   │   ├── Landing.tsx                 # Página de inicio
│   │   │   ├── Crear.tsx                   # Flujo de creación (3 pasos)
│   │   │   ├── Galeria.tsx                 # Visualiza logos
│   │   │   ├── Editor.tsx                  # Edita logo
│   │   │   ├── Historial.tsx               # Proyectos guardados
│   │   │   └── Exportar.tsx                # Descarga formatos
│   │   │
│   │   ├── services/
│   │   │   └── api.ts                      # Llamadas HTTP a backend
│   │   │
│   │   ├── types/
│   │   │   └── index.ts                    # Tipos TypeScript
│   │   │
│   │   ├── styles/
│   │   │   └── index.css                   # Estilos Tailwind + custom
│   │   │
│   │   ├── App.tsx                         # Enrutador principal
│   │   └── main.tsx                        # Punto de entrada
│   │
│   ├── index.html
│   ├── vite.config.ts                      # Config Vite
│   ├── tsconfig.json                       # Config TypeScript
│   ├── tailwind.config.js                  # Config Tailwind CSS
│   ├── postcss.config.js                   # Config PostCSS
│   ├── package.json
│   └── .env.example
│
├── backend/                      # Node.js + Express
│   ├── src/
│   │   ├── routes/              # 2 routers
│   │   │   ├── proyectos.js               # CRUD de proyectos
│   │   │   └── logos.js                   # Generación y variaciones
│   │   │
│   │   ├── services/            # 3 servicios principales
│   │   │   ├── dalleService.js            # Llamadas a DALL-E 3
│   │   │   ├── generadorPrompts.js        # Genera prompts optimizados
│   │   │   └── proyectoService.js         # Lógica de BD
│   │   │
│   │   ├── models/              # 3 esquemas Mongoose
│   │   │   ├── Proyecto.js                # Proyecto con logos
│   │   │   ├── Logo.js                    # Logo individual
│   │   │   └── Variacion.js               # Variaciones de logos
│   │   │
│   │   ├── config/
│   │   │   └── database.js                # Conexión MongoDB
│   │   │
│   │   └── server.js                      # Servidor Express
│   │
│   ├── package.json
│   └── .env.example
│
├── README.md                     # Documentación completa
├── QUICKSTART.md                 # Guía rápida
├── STRUCTURE.md                  # Este archivo
└── .gitignore
```

## 🔄 Flujo de Datos

```
USER FRONTEND
     ↓
  Landing.tsx
     ↓
  Crear.tsx (3 pasos)
     ├─→ FormularioMarca
     ├─→ SelectorEstilo
     └─→ PersonalizadorEstilo
           ↓
    [POST /api/logos/generar]
           ↓
  Backend Server
     ├─→ generadorPrompts.js (crea 12 prompts)
     ├─→ dalleService.js (llama DALL-E 3)
     └─→ proyectoService.js (guarda en BD)
           ↓
  Galeria.tsx
     ├─→ GaleriaLogos.tsx
     ├─→ EditorLogos.tsx
     ├─→ ComparadorVariaciones.tsx
     └─→ Exportar.tsx
```

## 📊 Modelo de Datos

### Proyecto
```javascript
{
  _id: ObjectId,
  nombreMarca: String,
  descripcion: String,
  valores: [String],
  estilo: String,
  parametros: {
    coloresPrimarios: [String],
    coloresSecundarios: [String],
    tipografia: String,
    elementos: [String],
    complejidad: String,
    orientacion: String
  },
  logos: [Logo],
  usuarioId: String,
  fechaCreacion: Date
}
```

### Logo
```javascript
{
  _id: ObjectId,
  proyectoId: ObjectId,
  url: String (imagen generada),
  estilo: String,
  parametros: Object,
  favorito: Boolean,
  usuarioId: String,
  fechaCreacion: Date
}
```

### Variacion
```javascript
{
  _id: ObjectId,
  logoOriginalId: ObjectId,
  cambios: Object,
  url: String,
  usuarioId: String,
  fechaCreacion: Date
}
```

## 🎯 10 Estilos de Logo

1. **Minimalista** - Limpio, simple y elegante
2. **Moderno** - Contemporáneo y dinámico
3. **Clásico** - Tradicional y atemporal
4. **Corporativo** - Profesional y confiable
5. **Creativo** - Artístico e imaginativo
6. **Tech** - Futurista y digital
7. **Vintage** - Retro y nostálgico
8. **Geométrico** - Formas matemáticas
9. **Elegante** - Lujo y sofisticación
10. **Juguetón** - Divertido y amigable

## 🔌 API Endpoints

```
POST   /api/proyectos              → Crear proyecto
GET    /api/proyectos              → Listar proyectos
GET    /api/proyectos/:id          → Obtener proyecto
PUT    /api/proyectos/:id          → Actualizar proyecto
DELETE /api/proyectos/:id          → Eliminar proyecto

POST   /api/logos/generar          → Generar 12 logos
POST   /api/logos/:id/variaciones  → Generar variaciones
PUT    /api/logos/:id/favorito     → Marcar favorito
GET    /api/logos/:id/descargar    → Descargar (PNG/SVG/PDF)

GET    /api/health                 → Health check
```

## 🛠️ Tecnologías por Capas

### Frontend
- **UI Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Package Manager**: npm

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **AI Integration**: OpenAI SDK (DALL-E 3)
- **Middleware**: CORS, JSON Parser
- **Package Manager**: npm

## 📦 Dependencias Clave

### Frontend (package.json)
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "axios": "^1.6.0",
  "tailwindcss": "^3.3.0"
}
```

### Backend (package.json)
```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "dotenv": "^16.3.1",
  "cors": "^2.8.5",
  "openai": "^4.26.0"
}
```

## 🚀 Scripts Disponibles

### Frontend
```bash
npm run dev      # Inicia servidor desarrollo (Vite)
npm run build    # Build para producción
npm run lint     # ESLint
npm run preview  # Preview del build
```

### Backend
```bash
npm run dev      # Inicia servidor con watch (nodemon)
npm start        # Inicia servidor producción
```

## 🔐 Configuración de Entorno

### Backend (.env)
```
MONGODB_URI      → Conexión a MongoDB
OPENAI_API_KEY   → Clave API OpenAI
PORT             → Puerto del servidor (default: 3001)
NODE_ENV         → development/production
```

### Frontend (.env.local)
```
VITE_API_URL     → URL del backend API
```

## 📱 Responsive Design

- **Mobile**: 375px (iPhone SE)
- **Tablet**: 768px (iPad)
- **Desktop**: 1280px+

Todas las páginas usan Tailwind CSS con:
- `sm:` (640px)
- `md:` (768px)
- `lg:` (1024px)
- `xl:` (1280px)

## ✅ Características Implementadas

- ✅ Autenticación lista para agregar
- ✅ 6 páginas funcionales
- ✅ 7 componentes reutilizables
- ✅ API RESTful completa
- ✅ Integración DALL-E 3
- ✅ Generador de prompts inteligente
- ✅ Descarga múltiples formatos
- ✅ Historial de proyectos
- ✅ Editor de logos
- ✅ Comparador de variaciones
- ✅ UI profesional con Tailwind CSS

## 🔮 Funcionalidades Futuras

- [ ] Autenticación de usuarios
- [ ] Pagos con Stripe
- [ ] Compartir logos en redes sociales
- [ ] Colaboración en tiempo real
- [ ] Más opciones de exportación
- [ ] Análisis de tendencias de diseño
- [ ] Integración con más modelos de IA
- [ ] App móvil con React Native

---

**Creado con ❤️ para hacer diseño de logos fácil y accesible** 🎨
