# LogoAI - Generador de Logos con IA

Aplicación profesional para generar logos personalizados para marcas usando IA (DALL-E 3).

## 🎯 Características

- ✨ Generación de 10+ opciones de logo por proyecto
- 🎨 Sistema híbrido de estilos (predefinidos personalizables)
- 💾 Galería de logos con favoritOS
- ✏️ Editor en línea para modificar logos
- 📊 Comparador de variaciones
- 💾 Descarga en múltiples formatos (PNG, SVG, PDF)
- 📱 Interfaz responsive y profesional
- 🔐 Historial de proyectos guardados

## 🛠️ Stack Tecnológico

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios

### Backend
- Node.js + Express
- MongoDB (Mongoose)
- OpenAI API (DALL-E 3)
- CORS

## 📋 Requisitos Previos

- Node.js v18+ instalado
- npm o yarn
- Cuenta de OpenAI con acceso a DALL-E 3
- MongoDB (local o MongoDB Atlas)

## ⚙️ Instalación

### 1. Clonar o descargar el proyecto

```bash
cd logoai
```

### 2. Configurar el Backend

```bash
cd backend

# Instalar dependencias
npm install

# Crear archivo .env
cp .env.example .env

# Editar .env con tus credenciales
# MONGODB_URI=tu_mongodb_uri
# OPENAI_API_KEY=tu_api_key
```

### 3. Configurar el Frontend

```bash
cd ../frontend

# Instalar dependencias
npm install

# Crear archivo .env.local (opcional)
echo "VITE_API_URL=http://localhost:3001/api" > .env.local
```

## 🚀 Iniciar la Aplicación

### Terminal 1 - Backend

```bash
cd backend
npm run dev
# El servidor estará disponible en http://localhost:3001
```

### Terminal 2 - Frontend

```bash
cd frontend
npm run dev
# La aplicación estará disponible en http://localhost:5173
```

## 📝 Estructura del Proyecto

```
logoai/
├── frontend/                    # Aplicación React
│   ├── src/
│   │   ├── components/         # Componentes reutilizables
│   │   ├── pages/             # Páginas principales
│   │   ├── services/          # Llamadas API
│   │   ├── types/             # Tipos TypeScript
│   │   ├── styles/            # Estilos CSS
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     # Servidor Node.js + Express
│   ├── src/
│   │   ├── routes/            # Rutas API
│   │   ├── services/          # Lógica de negocio
│   │   ├── models/            # Modelos Mongoose
│   │   ├── config/            # Configuración
│   │   └── server.js
│   ├── package.json
│   └── .env.example
│
└── README.md
```

## 🔑 Variables de Entorno Requeridas

### Backend (.env)
```
MONGODB_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/logoai
OPENAI_API_KEY=sk-tu-clave-aqui
PORT=3001
NODE_ENV=development
```

## 📚 API Endpoints

### Proyectos
- `POST /api/proyectos` - Crear nuevo proyecto
- `GET /api/proyectos` - Listar proyectos
- `GET /api/proyectos/:id` - Obtener proyecto
- `PUT /api/proyectos/:id` - Actualizar proyecto
- `DELETE /api/proyectos/:id` - Eliminar proyecto

### Logos
- `POST /api/logos/generar` - Generar logos
- `POST /api/logos/:logoId/variaciones` - Generar variaciones
- `PUT /api/logos/:logoId/favorito` - Marcar como favorito
- `GET /api/logos/:logoId/descargar` - Descargar logo

## 🎨 Estilos de Logo Disponibles

1. **Minimalista** - Limpio y simple
2. **Moderno** - Contemporáneo y dinámico
3. **Clásico** - Tradicional y atemporal
4. **Corporativo** - Profesional y confiable
5. **Creativo** - Artístico e imaginativo
6. **Tech** - Futurista y digital
7. **Vintage** - Retro y nostálgico
8. **Geométrico** - Formas matemáticas
9. **Elegante** - Lujo y sofisticación
10. **Juguetón** - Divertido y amigable

## 🔄 Flujo de la Aplicación

1. **Crear Proyecto** → Usuario ingresa info de marca
2. **Seleccionar Estilo** → Elige entre 10 estilos predefinidos
3. **Personalizar** → Ajusta colores, tipografía, elementos
4. **Generar** → Backend crea 12 variaciones con DALL-E 3
5. **Galería** → Usuario visualiza y selecciona logos
6. **Edición** → Puede modificar colores y guardar cambios
7. **Descarga** → Exporta en PNG, SVG o PDF

## 💡 Ejemplo de Uso

```javascript
// Generar logos para una marca
POST /api/logos/generar
{
  "nombreMarca": "TechStart",
  "descripcion": "App de productividad para equipos remotos",
  "valores": ["innovación", "colaboración", "eficiencia"],
  "estilo": "moderno",
  "parametros": {
    "coloresPrimarios": ["#3B82F6", "#FFFFFF"],
    "complejidad": "medio",
    "orientacion": "cuadrado"
  },
  "cantidadLogos": 12
}
```

## 🧪 Testing

```bash
# Frontend
cd frontend
npm run lint

# Backend
cd backend
# Pendiente de implementar tests
```

## 📦 Build para Producción

### Frontend
```bash
cd frontend
npm run build
# Genera carpeta dist/ lista para deployment
```

### Backend
```bash
cd backend
npm start
# Inicia en modo producción
```

## 🌐 Deployment

### Frontend
- **Vercel**: Conecta el repo, deploy automático
- **Netlify**: Mismo proceso
- **GitHub Pages**: Para versión estática

### Backend
- **Heroku/Railway**: Deployment desde Git
- **AWS/GCP/Azure**: Usando Docker
- **DigitalOcean**: App Platform

## 🐛 Troubleshooting

### Error de conexión a MongoDB
```
Solución: Verificar MONGODB_URI y estado de la BD
```

### Error de API Key de OpenAI
```
Solución: Verificar OPENAI_API_KEY y límites de crédito
```

### CORS Error
```
Solución: Verificar que backend esté en puerto 3001
```

## 📄 Licencia

MIT

## 👤 Autor

Creado con ❤️ para crear logos increíbles

---

¿Preguntas o sugerencias? ¡Abre un issue!
