# ComTec — Tienda de Tecnología

Sitio web público de ComTec (Huancayo, Perú) + panel interno de gestión con login,
ventas, inventario, técnicos y chat en tiempo real.

## Stack

- **Frontend:** HTML + CSS + JS (vanilla), Chart.js, Socket.io client
- **Backend:** Node.js + Express, JWT, bcrypt
- **DB:** SQLite (módulo built-in `node:sqlite`)
- **Tiempo real:** Socket.io

## Estructura

```
comtec-html/
├── index.html · catalogo.html        # Sitio público
├── login.html · dashboard.html       # Panel privado
├── assets/css · assets/js · images
└── backend/
    ├── server.js
    ├── db/  (schema, seed, comtec.db)
    ├── routes/  (auth, sales, inventory, components, users, tech, chat, dashboard)
    └── middleware/auth.js
```

## Ejecutar localmente

```bash
cd backend
npm install
npm start
```

Abre http://localhost:3000

### Credenciales demo

| Rol       | Email              | Password    |
|-----------|--------------------|-------------|
| Admin     | admin@comtec.pe    | admin123    |
| Vendedora | maria@comtec.pe    | vendedor123 |
| Vendedora | luz@comtec.pe      | vendedor123 |
| Técnico   | carlos@comtec.pe   | tecnico123  |
| Técnico   | jorge@comtec.pe    | tecnico123  |

## Despliegue en Render.com

El repo incluye `render.yaml` con la configuración. En Render:

1. New → Blueprint → conectar este repo.
2. Render detecta `render.yaml` y crea el servicio con build/start automáticos.
3. La variable `JWT_SECRET` se genera sola.
4. El primer arranque siembra la base de datos demo.

## Integración futura — API para técnicos

Endpoint para que cada técnico envíe sus trabajos automáticamente:

```
POST /api/tech/logs
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "cliente": "Nombre",
  "equipo": "Laptop HP",
  "descripcion": "Cambio de SSD + clonado",
  "monto": 120,
  "fecha": "2026-05-27"
}
```

Los registros llegan al panel del admin con `fuente: "api"` (los manuales son `fuente: "manual"`).
