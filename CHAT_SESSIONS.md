# Sistema de Sesiones de Chat - Documentación

## Cambios Implementados

### 1. Base de Datos

Se agregó soporte para sesiones en la tabla `chat_historial`:

```sql
ALTER TABLE chat_historial ADD COLUMN session_id UUID;
ALTER TABLE chat_historial ADD COLUMN session_title TEXT;
ALTER TABLE chat_historial ADD COLUMN actualizado_en TIMESTAMPTZ DEFAULT now();
```

**Estructura actual:**
- `session_id`: UUID que agrupa múltiples mensajes en una conversación
- `session_title`: Título de la sesión (tomado del primer mensaje)
- `actualizado_en`: Timestamp que se actualiza cada vez que se agrega un mensaje a la sesión
- Los mensajes se mantienen individuales pero agrupados por `session_id`

### 2. API de Chat (`/api/chat`)

**Cambios en el endpoint POST:**
- Acepta un parámetro opcional `sessionId` en el body
- Si no hay `sessionId`, crea uno nuevo usando `crypto.randomUUID()`
- El título de la sesión se genera a partir de los primeros 60 caracteres del mensaje inicial
- Cada mensaje se guarda individualmente con el `session_id` correspondiente
- Todos los mensajes de una sesión comparten la misma fecha de actualización

**Respuesta del endpoint:**
```json
{
  "respuesta": "...",
  "sessionId": "uuid-de-la-sesion",
  "sessionTitle": "Título de la sesión",
  "larps_encontrados": 0,
  "larps": []
}
```

### 3. API de Historial (`/api/chat/history`)

**Cambios:**
- Ahora devuelve sesiones agrupadas en lugar de mensajes individuales
- Cada sesión muestra:
  - `sessionId`: ID único de la sesión
  - `titulo`: Título de la sesión
  - `preview`: Vista previa de la última respuesta
  - `actualizado`: Fecha de última actualización
  - `mensajeCount`: Cantidad de intercambios en la sesión

**Respuesta del endpoint:**
```json
{
  "historial": [
    {
      "sessionId": "uuid",
      "titulo": "¿Qué actividades hay sobre matemáticas?",
      "preview": "Tenemos varias actividades sobre matemáticas...",
      "actualizado": "2026-04-23T10:30:00Z",
      "mensajeCount": 5
    }
  ]
}
```

### 4. Nuevo Endpoint: Obtener Sesión Completa

**Endpoint:** `GET /api/chat/session/[sessionId]`

Devuelve todos los mensajes de una sesión específica:

```json
{
  "sessionId": "uuid",
  "mensajes": [
    {
      "id": "uuid",
      "usuario": "¿Qué actividades hay?",
      "bot": "Tenemos varias actividades...",
      "creado": "2026-04-23T10:25:00Z"
    },
    {
      "id": "uuid",
      "usuario": "Dame más detalles",
      "bot": "Por supuesto...",
      "creado": "2026-04-23T10:26:00Z"
    }
  ]
}
```

### 5. Interfaz de Chat (`/app/chat/page.tsx`)

**Cambios principales:**

1. **Estado de sesión:**
   - `currentSessionId`: ID de la sesión activa actual
   - `activeSessionId`: ID de la sesión seleccionada en el sidebar
   - Se envía `sessionId` al API con cada mensaje

2. **Sidebar mejorado:**
   - Altura máxima limitada: `max-h-[calc(100vh-180px)]`
   - Scroll interno cuando hay muchas sesiones
   - Muestra contador de mensajes por sesión
   - Indicador de sesión activa

3. **Carga de sesiones:**
   - Al hacer clic en una sesión del historial, se cargan TODOS los mensajes
   - Se hace una petición a `/api/chat/session/[sessionId]`
   - Los mensajes se restauran en el orden correcto

4. **Nueva conversación:**
   - Limpia `currentSessionId` y `activeSessionId`
   - Siguiente mensaje creará una nueva sesión automáticamente

## Flujo de Uso

### 1. Iniciar nueva conversación
- Usuario hace clic en "Nueva conversación"
- `currentSessionId = null`
- Primer mensaje crea automáticamente una nueva sesión

### 2. Continuar conversación existente
- Usuario envía mensaje con `currentSessionId` existente
- Mensaje se agrega a la misma sesión
- `actualizado_en` se actualiza para toda la sesión

### 3. Ver historial
- Sidebar muestra sesiones ordenadas por fecha de actualización
- Cada sesión muestra título, preview y cantidad de mensajes
- Al hacer clic, se cargan todos los mensajes de la sesión

### 4. Detección automática de nueva sesión
- Cuando el usuario pide una actividad específica
- El frontend podría detectar esto y limpiar `currentSessionId`
- Actualmente se hace manualmente con "Nueva conversación"

## Archivos Modificados

1. `sql/init.sql` - Schema actualizado con campos de sesión
2. `sql/migration_add_chat_sessions.sql` - Migración aplicada
3. `app/api/chat/route.ts` - Lógica de sesiones en POST
4. `app/api/chat/history/route.ts` - Devuelve sesiones agrupadas
5. `app/api/chat/session/[sessionId]/route.ts` - NUEVO - Obtener mensajes de sesión
6. `app/chat/page.tsx` - UI actualizada con manejo de sesiones

## Ventajas del Sistema

1. **Conversaciones agrupadas**: Los mensajes relacionados se mantienen juntos
2. **Historial más limpio**: El sidebar muestra sesiones en lugar de mensajes sueltos
3. **Mejor UX**: Similar a ChatGPT/Claude con conversaciones persistentes
4. **Scroll limitado**: El sidebar tiene altura fija y scroll interno
5. **Contador de mensajes**: Usuario sabe cuánto contenido tiene cada sesión
6. **Fácil retomar**: Un clic carga toda la conversación anterior

## Mejoras Futuras Sugeridas

1. **Detección automática de nuevo tema**: Analizar mensaje con IA para detectar cambio de tema
2. **Editar título de sesión**: Permitir al usuario renombrar sesiones
3. **Eliminar sesiones**: Botón para borrar conversaciones antiguas
4. **Búsqueda en historial**: Buscar texto en todas las sesiones
5. **Exportar sesión**: Descargar una sesión completa como PDF o TXT
