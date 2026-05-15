# EduLARP — Plataforma de actividades educativas

Sistema completo para gestionar, buscar y subir EduLARPs (juegos de rol educativos del proyecto TechLARP).  
Incluye chatbot con IA, formulario de carga en 6 pasos y panel de administración.

---

## Tecnologías

- **Next.js 14** (App Router) — frontend + API
- **PostgreSQL 16 + pgvector** — base de datos con búsqueda vectorial
- **NextAuth.js** — autenticación con JWT
- **Anthropic Claude** — motor del chatbot
- **Tailwind CSS** — estilos
- **Docker Compose** — base de datos en desarrollo
- **PM2 + Nginx** — producción en VPS/LXC

---

## Inicio rápido (desarrollo local)

### 1. Requisitos previos

- Node.js 20+
- Docker Desktop
- Una API key de Anthropic: https://console.anthropic.com

### 2. Clonar e instalar

```bash
git clone https://github.com/tu-usuario/edularp-app.git
cd edularp-app
npm install
```

### 3. Variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` y rellena al menos:
- `ANTHROPIC_API_KEY` — tu clave de Anthropic
- `NEXTAUTH_SECRET` — genera con `openssl rand -base64 32`

### 4. Levantar la base de datos

```bash
docker compose up -d
```

Esto arranca PostgreSQL con pgvector en `localhost:5432` y ejecuta `sql/init.sql` automáticamente, creando todas las tablas y el EduLARP de ejemplo (The Order of Unseen Path).

### 5. Arrancar el servidor de desarrollo

```bash
npm run dev
```

Abre http://localhost:3000

### 6. Credenciales por defecto

| Rol   | Email                | Contraseña  |
|-------|----------------------|-------------|
| Admin | admin@edularp.es     | Admin1234!  |

> Cámbia la contraseña del admin tras el primer login en producción.

---

## Estructura del proyecto

```
edularp-app/
├── app/
│   ├── (auth)/login/          — Página de login
│   ├── (auth)/registro/       — Registro de docentes
│   ├── dashboard/             — Panel principal del docente
│   ├── formulario/            — Formulario de carga EduLARP (6 pasos)
│   ├── chat/                  — Interfaz del chatbot
│   ├── admin/revision/        — Panel de administración
│   └── api/                   — Endpoints REST
│       ├── auth/[...nextauth] — Autenticación NextAuth
│       ├── chat/              — Chatbot con RAG
│       ├── edularp/           — CRUD de actividades
│       └── admin/             — Aprobar, rechazar, usuarios
├── lib/
│   ├── db.ts                  — Conexión PostgreSQL
│   ├── auth.ts                — Configuración NextAuth
│   └── schemas/               — Validaciones Zod
├── sql/
│   └── init.sql               — Esquema completo + datos de ejemplo
├── docker-compose.yml         — PostgreSQL + Redis para desarrollo
├── ecosystem.config.js        — Configuración PM2 para producción
└── nginx.conf                 — Configuración Nginx para producción
```

---

## Despliegue en VPS / LXC (Proxmox)

### Requisitos del LXC
- Ubuntu 22.04 LTS
- 2 vCPU, 2–4 GB RAM, 30 GB disco

### Pasos de despliegue

```bash
# 1. Instalar dependencias en el LXC
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx git
curl -fsSL https://get.docker.com | sh
npm install -g pm2

# 2. Clonar el proyecto
cd /var/www
git clone https://github.com/tu-usuario/edularp-app.git
cd edularp-app

# 3. Configurar variables de entorno
cp .env.example .env.local
nano .env.local   # rellenar con datos reales
# Cambiar NEXTAUTH_URL a https://edularp.tudominio.es

# 4. Levantar la BD
docker compose up -d

# 5. Instalar, compilar y arrancar
npm install
npm run build
pm2 start ecosystem.config.js
pm2 save && pm2 startup

# 6. Configurar Nginx
cp nginx.conf /etc/nginx/sites-available/edularp
ln -s /etc/nginx/sites-available/edularp /etc/nginx/sites-enabled/
# Editar el nginx.conf con tu dominio real
nginx -t && systemctl restart nginx

# 7. SSL gratuito con Let's Encrypt
certbot --nginx -d edularp.tudominio.es
```

### Actualizar el proyecto

```bash
cd /var/www/edularp-app
git pull
npm install
npm run build
pm2 restart edularp
```

### Backup de la base de datos

```bash
docker exec edularp-db pg_dump -U postgres edularp > backup_$(date +%Y%m%d).sql
```

---

## Variables de entorno

| Variable           | Descripción                              | Requerida |
|--------------------|------------------------------------------|-----------|
| `DATABASE_URL`     | URL de conexión a PostgreSQL             | Sí        |
| `NEXTAUTH_SECRET`  | Secreto para JWT (genera con openssl)    | Sí        |
| `NEXTAUTH_URL`     | URL pública de la app                    | Sí        |
| `ANTHROPIC_API_KEY`| Clave API de Anthropic                   | Sí        |
| `UPLOAD_DIR`       | Ruta para archivos subidos               | No        |
| `SMTP_HOST`        | Servidor SMTP para emails                | No        |
| `SMTP_PORT`        | Puerto SMTP                              | No        |
| `SMTP_USER`        | Usuario SMTP                             | No        |
| `SMTP_PASS`        | Contraseña SMTP                          | No        |

---

## Flujo de uso

1. **Docente** se registra → admin aprueba la cuenta
2. **Docente** usa el chatbot para buscar EduLARPs adecuados para su clase
3. **Docente** sube un nuevo EduLARP con el formulario de 6 pasos
4. **Admin** revisa, da feedback y publica o rechaza la actividad
5. El EduLARP publicado aparece en las recomendaciones del chatbot

---

## Licencia

MIT — Proyecto de docencia TechLARP
