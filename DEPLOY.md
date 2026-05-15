# Guía de Despliegue — TechLARP Chatbot

**Servidor:** `163.117.137.118` (Intranet UC3M)  
**Usuario:** `chatbot` | **SO:** Debian 13 | **RAM:** 2 GB | **Disco:** 10 GB  
**URL futura:** `https://dei.inf.uc3m.es/techlarp-chatbot`

---

## Flujo de trabajo

```
Tu PC (casa)  ──git push──►  GitHub (privado)  ◄──git pull──  Servidor
    editas                      sincroniza                      despliega
```

- Desarrollas y haces cambios en tu ordenador normal
- Subes a GitHub con `git push`
- Despliegas al servidor con **un solo comando** desde casa (con VPN) o desde la universidad

---

## Requisitos previos

- Cuenta en **GitHub** y repositorio privado creado (gratuito)
- **Git** instalado en tu PC: https://git-scm.com/downloads
- Windows 10/11 con **OpenSSH** (viene por defecto; verificar: `ssh -V`)
- Clave API de Groq (`GROQ_API_KEY`): https://console.groq.com/keys
- Para desplegar **desde casa**: VPN UC3M activa: https://www.uc3m.es/sdic/servicios/vpn
- Para desplegar **desde la universidad**: acceso directo o AnyDesk

---

## CONFIGURACIÓN INICIAL (solo una vez)

### A) Publicar el código en GitHub

```powershell
# En tu PC, dentro de edularp-export/:
cd C:\Users\aldav\OneDrive\Documentos\Chatbot\edularp-export

git init
git add -A
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/techlarp-chatbot.git
git push -u origin main
```

> El `.gitignore` ya excluye `.env.production`, `node_modules`, `data/` y `public/uploads/`

### B) Configurar el servidor (desde la universidad o con VPN)

```powershell
# 1. Copiar scripts al servidor
scp "scripts\setup-server.sh" chatbot@163.117.137.118:/tmp/
scp "scripts\setup-git-deploy.sh" chatbot@163.117.137.118:/tmp/

# 2. Instalar dependencias del sistema (como root)
ssh chatbot@163.117.137.118 "su -c 'bash /tmp/setup-server.sh'"

# 3. Configurar Git en el servidor (como chatbot, pedirá la URL del repo)
ssh chatbot@163.117.137.118 "bash /tmp/setup-git-deploy.sh"
```

### C) Subir las claves API al servidor

Edita `.env.production` con tus claves reales y súbelo:

```powershell
scp ".env.production" chatbot@163.117.137.118:/var/www/edularp-app/.env.production
ssh chatbot@163.117.137.118 "cp /var/www/edularp-app/.env.production /var/www/edularp-app/.env.local && pm2 reload ecosystem.config.js --update-env"
```

### D) Configurar Nginx

```powershell
scp "nginx.conf" chatbot@163.117.137.118:/tmp/edularp.conf
ssh chatbot@163.117.137.118 "su -c 'cp /tmp/edularp.conf /etc/nginx/sites-available/edularp && ln -sf /etc/nginx/sites-available/edularp /etc/nginx/sites-enabled/edularp && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx'"
```

---

## ACTUALIZACIONES (uso diario)

### Desde tu PC en casa (con VPN activa)

```powershell
cd C:\Users\aldav\OneDrive\Documentos\Chatbot\edularp-export
powershell -ExecutionPolicy Bypass -File scripts\update.ps1
```

Este script:
1. Hace `git commit` + `git push` de tus cambios a GitHub
2. Verifica que el servidor es accesible (VPN)
3. Hace `git pull` en el servidor y reinicia la app con PM2

### Desde la universidad (sin VPN)

```powershell
cd C:\Users\aldav\OneDrive\Documentos\Chatbot\edularp-export
powershell -ExecutionPolicy Bypass -File scripts\update.ps1
```

El mismo script funciona — simplemente no necesitas VPN.

### Solo subir a GitHub sin desplegar

```powershell
git add -A
git commit -m "Descripción del cambio"
git push origin main
```

---

## Verificar que todo funciona

```powershell
# Abrir en el navegador:
Start-Process "http://163.117.137.118"

# Ver logs en tiempo real:
ssh chatbot@163.117.137.118 "pm2 logs edularp"

# Ver estado de servicios:
ssh chatbot@163.117.137.118 "pm2 status && docker ps"
```

---

## Gestión del servidor

```bash
# Conectarse
ssh chatbot@163.117.137.118

# Logs de la app
pm2 logs edularp --lines 100

# Reiniciar app
pm2 restart edularp

# Estado de contenedores Docker
docker ps
docker compose -f /var/www/edularp-app/docker-compose.yml logs

# Reiniciar base de datos (¡borra datos!)
docker compose -f /var/www/edularp-app/docker-compose.yml down
docker compose -f /var/www/edularp-app/docker-compose.yml up -d
```

---

## Configurar HTTPS cuando el dominio esté listo

Una vez la UC3M configure la URL pública `https://dei.inf.uc3m.es/techlarp-chatbot`:

```bash
ssh chatbot@163.117.137.118
su
# Actualizar NEXTAUTH_URL en /var/www/edularp-app/.env.production
# Activar la sección SSL en /etc/nginx/sites-available/edularp
# Reiniciar: pm2 reload edularp --update-env && systemctl reload nginx
```

---

## Solución de problemas

| Problema | Solución |
|---|---|
| `502 Bad Gateway` | `pm2 status` — la app no está corriendo |
| `npm run build` falla | Verificar `.env.production` tiene todas las claves |
| DB no conecta | `docker ps` — comprobar que `edularp-db` está `Up` |
| Sin espacio en disco | `df -h` — el disco es de 10 GB, limpiar `docker system prune` |
| PM2 no arranca al inicio | `pm2 startup` y seguir las instrucciones |
