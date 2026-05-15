-- ═══════════════════════════════════════════════════════
-- EduLARP — Esquema completo de base de datos
-- Compatible con PostgreSQL 16 + pgvector
-- ═══════════════════════════════════════════════════════

-- Extensión para búsqueda vectorial (chatbot semántico)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────────
-- TABLA: usuarios
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  rol            TEXT NOT NULL DEFAULT 'docente'
                   CHECK (rol IN ('admin', 'docente', 'visitante')),
  estado         TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('activo', 'pendiente', 'suspendido')),
  creado_en      TIMESTAMPTZ DEFAULT now(),
  ultimo_acceso  TIMESTAMPTZ
);

-- ─────────────────────────────────────────────
-- TABLA: edularp (actividad principal)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS edularp (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id         UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre           TEXT NOT NULL,
  proyecto         TEXT,
  descripcion      TEXT NOT NULL,
  storyboard       TEXT NOT NULL,
  storyboard_alt   TEXT,                        -- versión alternativa narrativa
  nivel_educativo  TEXT NOT NULL
                     CHECK (nivel_educativo IN (
                       'Primaria','Secundaria'
                     )),
  asignaturas      TEXT NOT NULL,               -- separadas por comas
  duracion_min     INT NOT NULL CHECK (duracion_min BETWEEN 30 AND 300),
  num_participantes INT NOT NULL CHECK (num_participantes BETWEEN 2 AND 40),
  materiales       TEXT,
  evaluacion       TEXT,
  notas_docente    TEXT,
  competencias     TEXT[],                      -- array de competencias
  tipo_version     TEXT NOT NULL DEFAULT 'original'
                     CHECK (tipo_version IN ('original','modificada')),
  idioma_original  TEXT NOT NULL DEFAULT 'es'
                     CHECK (idioma_original IN ('es','en')),
  veces_modificada INT NOT NULL DEFAULT 0,
  estado           TEXT NOT NULL DEFAULT 'borrador'
                     CHECK (estado IN ('borrador','revision','publicado','rechazado')),
  feedback_admin   TEXT,                        -- mensaje del admin al rechazar/aprobar
  embedding        vector(1536),                -- para búsqueda semántica (opcional)
  creado_en        TIMESTAMPTZ DEFAULT now(),
  actualizado_en   TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
-- TABLA: paralelos_realidad
-- Tabla de equivalencias narrativa ↔ mundo real
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paralelos_realidad (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edularp_id     UUID REFERENCES edularp(id) ON DELETE CASCADE,
  narrativa      TEXT NOT NULL,   -- elemento fantástico
  mundo_real     TEXT NOT NULL,   -- equivalente real
  proposito      TEXT,            -- conexión pedagógica
  orden          INT DEFAULT 0
);

-- ─────────────────────────────────────────────
-- TABLA: misiones
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS misiones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edularp_id      UUID REFERENCES edularp(id) ON DELETE CASCADE,
  titulo          TEXT NOT NULL,
  objetivo        TEXT NOT NULL,
  duracion_min    INT,
  formato         TEXT,
  problema_larp   TEXT,           -- versión narrativa del problema
  problema_real   TEXT,           -- versión pedagógica del problema
  solucion        TEXT,
  recursos        TEXT,
  inclusion       TEXT,           -- relación con índice de inclusión
  orden           INT DEFAULT 0
);

-- ─────────────────────────────────────────────
-- TABLA: roles_participantes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles_participantes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edularp_id      UUID REFERENCES edularp(id) ON DELETE CASCADE,
  nombre_rol      TEXT NOT NULL,
  nombre_habilidad TEXT,
  desc_habilidad  TEXT NOT NULL,
  uso_juego       TEXT,
  orden           INT DEFAULT 0
);

-- ─────────────────────────────────────────────
-- TABLA: cartas_juego
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cartas_juego (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edularp_id      UUID REFERENCES edularp(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  tipo            TEXT NOT NULL
                    CHECK (tipo IN (
                      'personaje','habilidad','objeto','evento','otro'
                    )),
  habilidad       TEXT,
  lore            TEXT,
  imagen_url      TEXT,           -- ruta a imagen de la carta
  orden           INT DEFAULT 0
);

-- ─────────────────────────────────────────────
-- TABLA: objetivos
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS objetivos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edularp_id  UUID REFERENCES edularp(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL
                CHECK (tipo IN (
                  'Histórico','Técnico','Narrativo / diseño',
                  'Colaborativo','Actitudinal','Competencial','Otro'
                )),
  descripcion TEXT NOT NULL
);

-- ─────────────────────────────────────────────
-- TABLA: archivos
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS archivos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edularp_id  UUID REFERENCES edularp(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  ruta        TEXT NOT NULL,      -- ruta relativa dentro de /uploads
  tipo_mime   TEXT,
  tamanio     INT,
  creado_en   TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
-- TABLA: chat_historial (con sistema de sesiones)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_historial (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  session_id       UUID,                        -- Agrupa mensajes en una conversación
  session_title    TEXT,                        -- Título de la sesión
  mensaje_usuario  TEXT NOT NULL,
  respuesta_bot    TEXT NOT NULL,
  larps_usados     UUID[],                      -- IDs de EduLarps que usó como contexto
  creado_en        TIMESTAMPTZ DEFAULT now(),
  actualizado_en   TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
-- TABLA: notificaciones
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificaciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  edularp_id  UUID REFERENCES edularp(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL
                CHECK (tipo IN (
                  'aprobado','rechazado','aprobado_con_feedback',
                  'nuevo_registro','bienvenida'
                )),
  mensaje     TEXT,
  leida       BOOLEAN DEFAULT false,
  creado_en   TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
-- ÍNDICES para búsqueda eficiente
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_edularp_estado
  ON edularp(estado);
CREATE INDEX IF NOT EXISTS idx_edularp_autor
  ON edularp(autor_id);
CREATE INDEX IF NOT EXISTS idx_edularp_nivel
  ON edularp(nivel_educativo);
CREATE INDEX IF NOT EXISTS idx_edularp_fts
  ON edularp USING gin(to_tsvector('spanish', nombre || ' ' || descripcion || ' ' || storyboard));
CREATE INDEX IF NOT EXISTS idx_chat_usuario
  ON chat_historial(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_usuario
  ON notificaciones(usuario_id, leida);

-- ─────────────────────────────────────────────
-- TRIGGER: actualizar updated_at automáticamente
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.actualizado_en = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_edularp_updated
  BEFORE UPDATE ON edularp
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ─────────────────────────────────────────────
-- USUARIO ADMIN por defecto
-- Contraseña: Admin1234! (cámbiala en producción)
-- Hash bcrypt del password anterior
-- ─────────────────────────────────────────────
INSERT INTO usuarios (nombre, email, password_hash, rol, estado)
VALUES (
  'Administrador',
  'admin@edularp.es',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCGfseuLIm8haybxq6BDc.O',
  'admin',
  'activo'
) ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────
-- EDULARP DE EJEMPLO (The Order of Unseen Path)
-- ─────────────────────────────────────────────
DO $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO edularp (
    nombre, proyecto, descripcion, storyboard,
    nivel_educativo, asignaturas, duracion_min,
    num_participantes, estado, competencias
  ) VALUES (
    'The Order of Unseen Path',
    'TechLARP',
    'Actividad STEAM donde los estudiantes restauran los Tomos de científicas históricas olvidadas combinando investigación histórica, narrativa de rol y construcción de circuitos electrónicos interactivos.',
    'En los venerados salones del Gran Archivo de los Sabios Olvidados, el tiempo fluye de manera diferente. Las contribuciones intelectuales de las mentes más brillantes de la historia no se preservan en libros polvorientos, sino como Tomos Vivientes — artefactos que pulsan con la esencia misma de los descubrimientos que contienen. Pero una catástrofe ha golpeado: un misterioso Velo del Olvido, nacido del abandono histórico, ha descendido sobre el Ala Oeste del Archivo, donde se guardan los Tomos de las pioneras científicas. Tú eres un Aprendiz Restaurador, iniciado en el antiguo orden de los Arcanotécnicos.',
    'Secundaria',
    'Historia de la Ciencia, Tecnología, Diseño',
    120, 25, 'publicado',
    ARRAY['Pensamiento crítico','Trabajo en equipo','STEM','Investigación histórica','Diseño creativo']
  ) RETURNING id INTO v_id;

  INSERT INTO paralelos_realidad (edularp_id, narrativa, mundo_real, proposito, orden) VALUES
    (v_id, 'Gran Archivo de los Sabios Olvidados', 'El aula / taller / biblioteca', 'Crea el entorno inmersivo de aprendizaje', 1),
    (v_id, 'Arcanistas', 'Científicas históricas y tecnólogas', 'Las figuras reales cuyas historias se recuperan', 2),
    (v_id, 'Tomo Resonante', 'Libro interactivo con electrónica embebida', 'Artefacto físico que los estudiantes construyen', 3),
    (v_id, 'Velo del Olvido', 'Sesgo histórico, brecha de género en STEM', 'El antagonista no es una persona sino fuerzas sociales', 4),
    (v_id, 'Aprendices Restauradores', 'Los estudiantes participantes', 'Rol activo como recuperadores de conocimiento', 5);

  INSERT INTO misiones (edularp_id, titulo, objetivo, duracion_min, formato,
    problema_larp, problema_real, solucion, recursos, orden) VALUES
    (v_id,
     'Restaurar el Glifo de Iluminación',
     'Restaurar el Glifo de Iluminación básico en el Tomo de Eunice Foote construyendo un circuito interactivo simple que se ilumina al abrirse.',
     90, 'Taller colaborativo',
     'El Velo del Olvido ha corrompido el Glifo de Iluminación en el Tomo de Eunice Foote, la Arcanista que comprendió que ciertos "aires" podían atrapar calor. Sin esta primera chispa de luz, su descubrimiento permanece en la oscuridad.',
     'Los estudiantes deben aprender diseño de circuitos básico conectándolo a una historia real. Deben decidir qué iluminar y cómo activarlo al abrir el libro.',
     'Los equipos reciben el Fragmento de Tomo Desvanecido de Eunice Foote. 1) Crean contenido para dos páginas. 2) Embeben un circuito con LED, batería y switch. 3) Alinean la luz con el momento del descubrimiento.',
     'Kit de circuitos (LED, batería 3V, portapilas, resistencia, cinta de cobre), cartulina, tijeras, marcadores, impresión del Fragmento de Tomo',
     1);

  INSERT INTO roles_participantes (edularp_id, nombre_rol, nombre_habilidad, desc_habilidad, uso_juego, orden) VALUES
    (v_id, 'Chronicler — El Guardián del Tomo', 'Scribe''s Recall', 'Una vez por misión, consulta los ecos del Archivo para obtener un dato histórico adicional sobre la Arcanista que estás restaurando.', 'Una vez por misión, pide al facilitador un hecho histórico adicional o pista de contexto.', 1),
    (v_id, 'Artificer — El Arcanotécnico', 'Arcane Infusion', 'Invoca el conocimiento del Gran Artificer para estabilizar un encantamiento fallido.', 'Una vez durante la fase de construcción, solicita una pista técnica sin pausar el progreso del equipo.', 2),
    (v_id, 'Illuminator — El Gliphwright', 'Glyph of Revision', 'Puedes reelaborar un elemento visual o de diseño del Tomo sin coste adicional.', 'Rediseña una vez cualquier elemento visual asegurando que los símbolos se alineen con la historia.', 3),
    (v_id, 'Resonator — El Empático', 'Aura of Clarity', 'Expande tus sentidos para percibir cómo otros podrían experimentar el Tomo.', 'Realiza una verificación de resonancia usando las Lentes de Empatía y sugiere una mejora de diseño inclusivo.', 4);

  INSERT INTO cartas_juego (edularp_id, nombre, tipo, habilidad, lore, orden) VALUES
    (v_id, 'Eunice Foote (1856)', 'personaje', 'Light of Understanding',
     'Lore: "La Arcanista Foote descubrió el Aliento de Llama, el principio de que ciertos aires retenían el calor del sol como vasijas encantadas. Por ello, encendió la Primera Llama del Lore Climático. Sus conocimientos, apagados por el tiempo, ahora parpadean de nuevo..."',
     1);

  INSERT INTO objetivos (edularp_id, tipo, descripcion) VALUES
    (v_id, 'Histórico', 'Explicar el papel de Eunice Foote en la ciencia climática temprana y por qué su contribución fue ignorada.'),
    (v_id, 'Técnico', 'Construir un circuito abierto/cerrado simple con switch; comprender polaridad, conductividad y componentes básicos.'),
    (v_id, 'Narrativo / diseño', 'Tomar decisiones creativas sobre qué iluminar y por qué, vinculando tecnología con narrativa.'),
    (v_id, 'Colaborativo', 'Trabajar en roles definidos para combinar investigación, arte, ingeniería y pruebas en un prototipo funcional.');
END $$;
