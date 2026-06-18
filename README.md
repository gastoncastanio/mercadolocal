# 🛒 Mercado Local - Marketplace Local

Plataforma de marketplace local con sistema inteligente de pauta, usuarios, vendedores y compra-venta de productos.

## 🎯 Características Principales

- **Catálogo de Productos**: Búsqueda, filtros por categoría y ciudad
- **Secciones Especializadas**: Usados, Ofertas con datos reales
- **Pauta Inteligente**: Motor de propensión con decay temporal, funnel de intención, filtrado colaborativo y Thompson sampling
- **Sistema de Pagos**: Mercado Pago integrado para compras y pauta publicitaria
- **Perfiles de Usuario**: Logueados y anónimos, con tracking de comportamiento
- **Notificaciones Inteligentes**: Alertas personalizadas basadas en intereses del usuario
- **Panel de Admin**: Control de usuarios, categorías, moderación y pautas publicitarias

## 🛠️ Stack Tecnológico

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS + Design System "Mercado Local - Futuro"
- React Router
- Axios + Socket.IO

### Backend
- Node.js + Express
- MongoDB (Mongoose)
- Mercado Pago API
- Socket.IO (WebSockets)
- Seguridad: Helmet, CORS, NoSQL Sanitize, Rate Limiting

### Infraestructura
- **Frontend**: Vercel
- **Backend**: Railway
- **Base de Datos**: MongoDB Atlas
- **Almacenamiento**: Cloudinary
- **Push Notifications**: Web Push API

## 📋 Instalación Local

### 1. Clonar el proyecto

```bash
git clone https://github.com/gastoncastanio/mercadolocal.git
cd mercadolocal
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Configurar variables de entorno (MongoDB, JWT, Mercado Pago, etc.)
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend estará disponible en `http://localhost:5173` y el backend en `http://localhost:3001`.

## 🚀 Deploy

- **Frontend**: Auto-deploy desde rama `main` en Vercel
- **Backend**: Auto-deploy desde rama `main` en Railway

Push a `main` → webhooks disparan builds automáticos.

## 📚 Documentación

- Backend: `/backend` → API REST + WebSockets + modelos Mongoose
- Frontend: `/frontend` → React components + páginas

## 📄 Licencia

Mercado Local MVP - Todos los derechos reservados.
