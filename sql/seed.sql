-- ═══════════════════════════════════════════════════════
-- EduLARP — Datos semilla: 8 actividades LARP del proyecto TechLARP
-- Ejecutar DESPUÉS de init.sql
-- ═══════════════════════════════════════════════════════

-- Crear usuario sistema para las actividades semilla
INSERT INTO usuarios (id, nombre, email, password_hash, rol, estado)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'TechLARP Team',
  'techlarp@sistema.local',
  '$2a$12$placeholder_no_login',
  'admin',
  'activo'
) ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────
-- LARP001: The Octopus Operation
-- ─────────────────────────────────────────────
INSERT INTO edularp (id, autor_id, nombre, proyecto, descripcion, storyboard, nivel_educativo, asignaturas, duracion_min, num_participantes, materiales, evaluacion, notas_docente, competencias, estado)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'The Octopus Operation',
  'TechLARP',
  'Aventura post-apocalíptica donde los estudiantes deben reconstruir y programar el ''Octopus'', un dispositivo modular para recuperar datos climáticos perdidos.',
  'En un mundo en un futuro cercano donde el cambio climático ha interrumpido las comunicaciones globales, un equipo de jóvenes científicos debe recuperar datos vitales del Ártico usando un prototipo perdido llamado ''Octopus''. Los jugadores deben localizar y reconstruir el dispositivo mientras enfrentan fallos de comunicación, clima extremo y dilemas éticos.',
  'Secundaria',
  'Tecnología, Programación',
  240,
  30,
  'Dados, Computadoras (PC), Hojas de personajes, Réplica física del dispositivo ''Octopus'' y sus planos',
  'Debate ético sobre qué hacer con los datos recuperados, responsabilidad científica, transparencia y trabajo en equipo.',
  'Imprimir hojas de personajes y planos. Organizar las computadoras y preparar la réplica modular del dispositivo. Tener dados listos para los eventos aleatorios del juego.',
  ARRAY['Tecnología','Programación','Trabajo en equipo','Ética'],
  'publicado'
);

INSERT INTO misiones (edularp_id, titulo, objetivo, formato, problema_larp, solucion, orden)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Introducción', 'Presentar la narrativa de la crisis climática y la pérdida de comunicaciones globales', 'Juego de rol', 'Las comunicaciones globales han caído por el cambio climático', 'Los equipos reciben el briefing y se organizan', 0),
  ('10000000-0000-0000-0000-000000000001', 'Desarrollo', 'Los equipos localizan y reconstruyen el dispositivo sorteando desafíos', 'Taller colaborativo', 'El dispositivo Octopus está dañado y disperso', 'Resolver rompecabezas físicos y desafíos de programación', 1),
  ('10000000-0000-0000-0000-000000000001', 'Clímax', 'Ensamblar físicamente el dispositivo y programarlo', 'Construcción / maker', 'El tiempo se agota para recuperar los datos', 'Ensamblaje del dispositivo y programación funcional', 2);

INSERT INTO roles_participantes (edularp_id, nombre_rol, desc_habilidad, uso_juego, orden)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Jóvenes Científicos', 'Habilidades únicas de ensamblaje y programación', 'Cada científico aporta una pieza del rompecabezas técnico', 0);

INSERT INTO objetivos (edularp_id, tipo, descripcion)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Técnico', 'Fomentar la inclusión y el interés en la tecnología y la programación'),
  ('10000000-0000-0000-0000-000000000001', 'Colaborativo', 'Desarrollar el trabajo en equipo ante dilemas éticos y fallos de comunicación');

INSERT INTO paralelos_realidad (edularp_id, narrativa, mundo_real, proposito, orden)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Dispositivo Octopus', 'Sistemas modulares de recogida de datos', 'Comprender la programación modular', 0),
  ('10000000-0000-0000-0000-000000000001', 'Crisis climática post-apocalíptica', 'Cambio climático real y sus efectos', 'Concienciación medioambiental', 1);

-- ─────────────────────────────────────────────
-- LARP002: Ocean Base 2080
-- ─────────────────────────────────────────────
INSERT INTO edularp (id, autor_id, nombre, proyecto, descripcion, storyboard, nivel_educativo, asignaturas, duracion_min, num_participantes, materiales, evaluacion, notas_docente, competencias, estado)
VALUES (
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Ocean Base 2080: Guardians of the Blue Future',
  'TechLARP',
  'Los alumnos viajan al 2080 para idear y construir prototipos tecnológicos que resuelvan crisis oceánicas reales, inspirándose en mujeres pioneras.',
  'En el año 2080, los estudiantes son ''Guardianes de la Base Oceánica''. Inspirándose en mujeres pioneras de la ciencia marina, su misión es empatizar, idear y prototipar soluciones tecnológicas para resolver crisis actuales como la sobrepesca o la contaminación por plásticos.',
  'Secundaria',
  'Ciencias, Robótica, Ecología',
  180,
  30,
  'Mapas de empatía, Notas adhesivas, Materiales reciclados para construcción de prototipos (cartón, plásticos)',
  'Analizar cómo ayudó explorar figuras históricas femeninas para desarrollar ideas y cómo se sintieron en roles de liderazgo STEM.',
  'Decorar el aula simulando una base submarina. Preparar los Mapas de Empatía y organizar los materiales de construcción. Imprimir los certificados de Future Ocean Guardian.',
  ARRAY['Ciencias','Ecología','Prototipado','Empatía'],
  'publicado'
);

INSERT INTO misiones (edularp_id, titulo, objetivo, duracion_min, formato, problema_larp, solucion, orden)
VALUES
  ('10000000-0000-0000-0000-000000000002', 'Worldbuilding', 'Narrar la crisis del 2080 y asignar roles', 25, 'Juego de rol', 'Los océanos están en peligro crítico en 2080', 'Los equipos se organizan y reciben sus roles especializados', 0),
  ('10000000-0000-0000-0000-000000000002', 'Exploración', 'Completar el Mapa de Empatía sobre crisis reales', 30, 'Investigación', 'Crisis de sobrepesca y contaminación', 'Investigación empática y análisis de causas reales', 1),
  ('10000000-0000-0000-0000-000000000002', 'Ideación y Prototipado', 'Construir un prototipo físico de la solución tecnológica', 80, 'Construcción / maker', 'Se necesita una solución tecnológica innovadora', 'Diseño y construcción de prototipos con materiales reciclados', 2),
  ('10000000-0000-0000-0000-000000000002', 'Presentaciones', 'Exponer soluciones ante el grupo', 40, 'Debate / Q&A', 'Defender la solución ante los demás guardianes', 'Presentación y defensa del prototipo', 3);

INSERT INTO roles_participantes (edularp_id, nombre_rol, desc_habilidad, uso_juego, orden)
VALUES
  ('10000000-0000-0000-0000-000000000002', 'Robótico Marino', 'Especialista en diseño de robots submarinos', 'Lidera el diseño del prototipo robótico', 0),
  ('10000000-0000-0000-0000-000000000002', 'Explorador de Aguas Profundas', 'Conocimientos de biología marina y exploración', 'Investiga las condiciones del fondo marino', 1),
  ('10000000-0000-0000-0000-000000000002', 'Analista de Datos Hídricos', 'Experto en datos y medición ambiental', 'Interpreta los datos de contaminación', 2),
  ('10000000-0000-0000-0000-000000000002', 'Ecologista de IA', 'Combina inteligencia artificial con ecología', 'Propone soluciones basadas en IA para restauración', 3),
  ('10000000-0000-0000-0000-000000000002', 'Arquitecto de Corales', 'Diseñador de estructuras para ecosistemas marinos', 'Diseña arrecifes artificiales para restaurar vida', 4);

INSERT INTO objetivos (edularp_id, tipo, descripcion)
VALUES
  ('10000000-0000-0000-0000-000000000002', 'Técnico', 'Desarrollar soluciones tecnológicas e innovadoras para crisis oceánicas'),
  ('10000000-0000-0000-0000-000000000002', 'Actitudinal', 'Fomentar la empatía medioambiental y la concienciación social');

INSERT INTO paralelos_realidad (edularp_id, narrativa, mundo_real, proposito, orden)
VALUES
  ('10000000-0000-0000-0000-000000000002', 'Guardianes de la Base Oceánica', 'Científicas marinas pioneras', 'Visibilizar figuras femeninas en ciencias del mar', 0),
  ('10000000-0000-0000-0000-000000000002', 'Crisis oceánica del 2080', 'Contaminación y sobrepesca actuales', 'Conectar problemas ficticios con realidad medioambiental', 1);

-- ─────────────────────────────────────────────
-- LARP003: The Order of Unseen Path
-- ─────────────────────────────────────────────
INSERT INTO edularp (id, autor_id, nombre, proyecto, descripcion, storyboard, nivel_educativo, asignaturas, duracion_min, num_participantes, materiales, evaluacion, notas_docente, competencias, estado)
VALUES (
  '10000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'The Order of Unseen Path',
  'TechLARP',
  'Como aprendices de restauradores, los estudiantes usan experimentos físicos para salvar el legado de las científicas olvidadas por la historia.',
  'En el Gran Archivo de los Sabios Olvidados, una ''Cortina del Olvido'' amenaza con borrar los ''Tomos Vivientes'' de las mujeres científicas. Como Aprendices de Restauradores, los estudiantes utilizan experimentos físicos reales para reavivar la frecuencia de los tomos y salvar la historia.',
  'Secundaria',
  'Ciencias, Química, Física, Historia',
  120,
  25,
  '2 frascos, bicarbonato, vinagre, 2 termómetros, 2 bombillas, Tarjetas de roles y Lentes de Empatía, Modelo 3D de molécula de CO2 (opcional)',
  'Conectar los resultados empíricos con el calentamiento global actual y debatir sobre el borrado histórico de las mujeres en la ciencia.',
  'Asumir el rol de Facilitador (Restaurador Principal). Imprimir las tarjetas de habilidades especiales para cada rol. Montar las estaciones de laboratorio para el experimento.',
  ARRAY['Ciencias','Experimentación','Historia','Pensamiento crítico'],
  'publicado'
);

INSERT INTO misiones (edularp_id, titulo, objetivo, formato, problema_larp, problema_real, solucion, orden)
VALUES
  ('10000000-0000-0000-0000-000000000003', 'Introducción', 'Narrar la llegada de la Cortina del Olvido al Gran Archivo', 'Juego de rol', 'La Cortina del Olvido borra los Tomos de las científicas', 'Las contribuciones de mujeres científicas son invisibilizadas', 'Los aprendices aceptan la misión de restaurar los tomos', 0),
  ('10000000-0000-0000-0000-000000000003', 'La Misión', 'Seleccionar el Tomo Desvanecido de Eunice Foote', 'Investigación', 'El tomo de Eunice Foote pierde luminosidad', 'Eunice Foote descubrió el efecto invernadero pero fue olvidada', 'Investigar quién fue Eunice Foote y su descubrimiento', 1),
  ('10000000-0000-0000-0000-000000000003', 'Experimentación', 'Realizar el experimento químico para observar la diferencia de temperatura', 'Taller colaborativo', 'Reavivar la frecuencia del tomo con el experimento', 'Replicar el experimento original de Eunice Foote sobre CO2', 'Mezcla química bajo lámparas y medición de temperatura', 2);

INSERT INTO roles_participantes (edularp_id, nombre_rol, nombre_habilidad, desc_habilidad, uso_juego, orden)
VALUES
  ('10000000-0000-0000-0000-000000000003', 'Escriba', 'Scribe''s Recall', 'Registra los hallazgos y descubrimientos del equipo', 'Toma notas de los resultados experimentales', 0),
  ('10000000-0000-0000-0000-000000000003', 'Artífice', 'Crafter''s Precision', 'Manipula los materiales y monta los experimentos', 'Prepara las estaciones de laboratorio', 1),
  ('10000000-0000-0000-0000-000000000003', 'Resonador', 'Resonance Touch', 'Conecta emocionalmente con los tomos olvidados', 'Usa las Lentes de Empatía para descubrir historias', 2),
  ('10000000-0000-0000-0000-000000000003', 'Restaurador Principal', 'Master''s Guidance', 'Guía y facilita el proceso de restauración', 'Rol asumido por el docente como facilitador', 3);

INSERT INTO objetivos (edularp_id, tipo, descripcion)
VALUES
  ('10000000-0000-0000-0000-000000000003', 'Histórico', 'Combinar la investigación histórica con la experimentación científica'),
  ('10000000-0000-0000-0000-000000000003', 'Técnico', 'Comprender principios físicos reales (como el efecto invernadero de Eunice Foote)');

INSERT INTO paralelos_realidad (edularp_id, narrativa, mundo_real, proposito, orden)
VALUES
  ('10000000-0000-0000-0000-000000000003', 'Cortina del Olvido', 'Borrado histórico de mujeres en la ciencia', 'Reflexionar sobre la invisibilización de científicas', 0),
  ('10000000-0000-0000-0000-000000000003', 'Tomos Vivientes', 'Publicaciones y descubrimientos científicos', 'Valorar las contribuciones científicas olvidadas', 1),
  ('10000000-0000-0000-0000-000000000003', 'Restaurar la frecuencia del tomo', 'Replicar el experimento de Eunice Foote', 'Conectar la narrativa con la experimentación real', 2);

-- ─────────────────────────────────────────────
-- LARP004: The STEM Galactic Confederation
-- ─────────────────────────────────────────────
INSERT INTO edularp (id, autor_id, nombre, proyecto, descripcion, storyboard, nivel_educativo, asignaturas, duracion_min, num_participantes, materiales, evaluacion, notas_docente, competencias, estado)
VALUES (
  '10000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'The STEM Galactic Confederation',
  'TechLARP',
  'Desafío tipo Escape Room donde los estudiantes encarnan a Ada Lovelace, Hedy Lamarr y Joan Clarke para descifrar un mensaje alienígena de auxilio.',
  'En el año 3400, la Confederación Galáctica recibe una señal de emergencia de otro planeta. Los estudiantes encarnan a Ada Lovelace, Hedy Lamarr y Joan Clarke usando sus ''superpoderes'' históricos para descifrar la señal mediante rompecabezas y programar un robot de rescate.',
  'Secundaria',
  'Matemáticas, Criptografía, Programación',
  120,
  30,
  'Rompecabezas de código Morse y Cifrado César, Robot ratón programable, Utilería: Collar de perlas, gafas militares, abanico y tarjetas perforadas',
  'Debatir cómo los descubrimientos de estas tres mujeres sentaron las bases tecnológicas modernas (WiFi, GPS, computación).',
  'Imprimir los acertijos de criptografía. Configurar y probar el robot ratón programable. Preparar la utilería y disfraces para facilitar la adopción de los roles.',
  ARRAY['Matemáticas','Criptografía','Programación','Historia STEM'],
  'publicado'
);

INSERT INTO misiones (edularp_id, titulo, objetivo, formato, problema_larp, solucion, orden)
VALUES
  ('10000000-0000-0000-0000-000000000004', 'El Incidente', 'Escuchar la señal de emergencia incomprensible', 'Juego de rol', 'Una señal alienígena cifrada llega a la Confederación', 'Los equipos identifican que el mensaje está encriptado', 0),
  ('10000000-0000-0000-0000-000000000004', 'Criptografía', 'Usar la utilería y trabajar en equipo para descifrar el mensaje', 'Taller colaborativo', 'El mensaje usa cifrado César y código Morse', 'Aplicar técnicas de criptografía para decodificar la señal', 1),
  ('10000000-0000-0000-0000-000000000004', 'Programación', 'Programar la ruta del robot ratón para enviar la solución', 'Construcción / maker', 'El robot de rescate necesita una ruta programada', 'Programación direccional del robot para completar la misión', 2);

INSERT INTO roles_participantes (edularp_id, nombre_rol, nombre_habilidad, desc_habilidad, uso_juego, orden)
VALUES
  ('10000000-0000-0000-0000-000000000004', 'Experta en algoritmos (Ada Lovelace)', 'Algorithm Mastery', 'Pionera de la programación y los algoritmos', 'Lidera la resolución de los puzles lógicos', 0),
  ('10000000-0000-0000-0000-000000000004', 'Experta en telecomunicaciones (Hedy Lamarr)', 'Frequency Hopping', 'Inventora de la tecnología de espectro ensanchado', 'Descifra las frecuencias de comunicación', 1),
  ('10000000-0000-0000-0000-000000000004', 'Experta en criptografía (Joan Clarke)', 'Code Breaker', 'Criptoanalista que descifró códigos enemigos en la WWII', 'Aplica cifrado César y Morse para descifrar el mensaje', 2);

INSERT INTO objetivos (edularp_id, tipo, descripcion)
VALUES
  ('10000000-0000-0000-0000-000000000004', 'Técnico', 'Aprender métodos de encriptación (cifrado César) y algoritmos básicos'),
  ('10000000-0000-0000-0000-000000000004', 'Histórico', 'Visibilizar a figuras femeninas históricas en STEM a través de la inmersión');

INSERT INTO paralelos_realidad (edularp_id, narrativa, mundo_real, proposito, orden)
VALUES
  ('10000000-0000-0000-0000-000000000004', 'Señal alienígena cifrada', 'Criptografía y cifrado César', 'Aprender técnicas reales de encriptación', 0),
  ('10000000-0000-0000-0000-000000000004', 'Superpoderes de las heroínas', 'Inventos reales de Lovelace, Lamarr y Clarke', 'Conectar ficción con contribuciones STEM reales', 1);

-- ─────────────────────────────────────────────
-- LARP005: Elevator to the Stars
-- ─────────────────────────────────────────────
INSERT INTO edularp (id, autor_id, nombre, proyecto, descripcion, storyboard, nivel_educativo, asignaturas, duracion_min, num_participantes, materiales, evaluacion, notas_docente, competencias, estado)
VALUES (
  '10000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  'Elevator to the Stars',
  'TechLARP',
  'Un grupo de estudiantes viaja a la Estación Espacial a través de un elevador atado a un cometa, creando una narrativa digital sobre mujeres astronautas.',
  'Dos niñas y dos niños inician el viaje de sus vidas hacia las estrellas utilizando un elevador colgado de un cometa. Los estudiantes se dividen en equipos para crear historias inspiradas en mujeres científicas, combinando la imaginación con tecnologías digitales como robótica, programación y animación lenta.',
  'Primaria',
  'Tecnología, Robótica, Narrativa digital',
  240,
  30,
  'Materiales para construir trajes a escala real 1:1, Brazos robóticos y equipos para grabar narrativas de animación',
  'Discusión grupal para difundir las historias en otros equipos, comprendiendo los retos e hitos reales del espacio liderados por mujeres.',
  'Organizar el espacio para que actúe como una nave espacial. Preparar los kits de tecnología (cámaras para animación, brazos robóticos).',
  ARRAY['Tecnología','Robótica','Narrativa','Creatividad'],
  'publicado'
);

INSERT INTO misiones (edularp_id, titulo, objetivo, formato, problema_larp, solucion, orden)
VALUES
  ('10000000-0000-0000-0000-000000000005', 'Creación', 'Redactar un guion inspirado en el papel de las mujeres en el espacio', 'Otro', 'Los viajeros necesitan una historia que contar en el espacio', 'Escritura colaborativa de guion inspirado en astronautas reales', 0),
  ('10000000-0000-0000-0000-000000000005', 'Diseño', 'Construcción física del traje y entorno de la cabina espacial', 'Construcción / maker', 'Se necesitan trajes y una cabina para el viaje', 'Construcción de trajes a escala 1:1 y ambientación', 1),
  ('10000000-0000-0000-0000-000000000005', 'Producción Digital', 'Uso de tecnología para grabar un cortometraje en slowmation', 'Taller colaborativo', 'La historia debe ser contada en formato digital', 'Grabación y edición de cortometraje con técnica slowmation', 2);

INSERT INTO roles_participantes (edularp_id, nombre_rol, desc_habilidad, uso_juego, orden)
VALUES
  ('10000000-0000-0000-0000-000000000005', 'Jóvenes viajeros espaciales', 'Creatividad, trabajo en equipo y uso de tecnología', 'Cada equipo crea una historia y la produce digitalmente', 0);

INSERT INTO objetivos (edularp_id, tipo, descripcion)
VALUES
  ('10000000-0000-0000-0000-000000000005', 'Histórico', 'Reconocer y destacar el impacto de las mujeres científicas y astronautas'),
  ('10000000-0000-0000-0000-000000000005', 'Colaborativo', 'Desarrollar habilidades de trabajo en equipo, pensamiento crítico y comunicación');

INSERT INTO paralelos_realidad (edularp_id, narrativa, mundo_real, proposito, orden)
VALUES
  ('10000000-0000-0000-0000-000000000005', 'Elevador cósmico atado a un cometa', 'Viajes espaciales reales', 'Despertar curiosidad por la exploración espacial', 0),
  ('10000000-0000-0000-0000-000000000005', 'Historias de los viajeros', 'Biografías de mujeres astronautas y científicas', 'Visibilizar figuras femeninas en la carrera espacial', 1);

-- ─────────────────────────────────────────────
-- LARP006: Surrounded by Emotions
-- ─────────────────────────────────────────────
INSERT INTO edularp (id, autor_id, nombre, proyecto, descripcion, storyboard, nivel_educativo, asignaturas, duracion_min, num_participantes, materiales, evaluacion, notas_docente, competencias, estado)
VALUES (
  '10000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000001',
  'Surrounded by Emotions',
  'TechLARP',
  'En un retiro futuro, los participantes intentan desintoxicarse de las redes sociales usando dispositivos que muestran sus emociones con colores.',
  'En un futuro cercano, algunos son reclutados en un campamento de retiro en la vida real. Deben desintoxicarse de la pantalla y aprender a gestionar sus emociones usando unos dispositivos llamados ''Emotio-meters'', pulseras luminosas que muestran cómo se sienten interiormente a través de colores.',
  'Secundaria',
  'Tecnología, Salud Digital, Inteligencia Emocional',
  120,
  25,
  'Dispositivos wearables Emotio-meter que iluminan en colores: Rojo (enfado), Verde (preocupación), Azul (tristeza), Amarillo (alegría)',
  'Analizar la diferencia entre emociones reales versus nuestra fachada en redes sociales, y reflexionar sobre la toxicidad.',
  'Ambientar el aula como un Retiro de Desintoxicación Digital. Preparar los cuestionarios/quizzes que resolverán los alumnos.',
  ARRAY['Tecnología','Salud Digital','Inteligencia Emocional','Wearables'],
  'publicado'
);

INSERT INTO misiones (edularp_id, titulo, objetivo, formato, problema_larp, solucion, orden)
VALUES
  ('10000000-0000-0000-0000-000000000006', 'Introducción al retiro', 'Puesta en escena y reparto de los Emotio-meters', 'Juego de rol', 'Los reclutas llegan al campamento de desintoxicación', 'Ambientación y asignación de dispositivos wearables', 0),
  ('10000000-0000-0000-0000-000000000006', 'Desafíos', 'Participar en dinámicas basadas en identificar las luces de los demás', 'Taller colaborativo', 'Las emociones reales y las expresadas no coinciden', 'Actividades de reconocimiento emocional a través de colores', 1),
  ('10000000-0000-0000-0000-000000000006', 'Concursos y Quiz', 'Completar desafíos históricos e interactivos como pruebas', 'Otro', 'Los reclutas deben demostrar su progreso', 'Cuestionarios y pruebas interactivas sobre salud digital', 2);

INSERT INTO roles_participantes (edularp_id, nombre_rol, desc_habilidad, uso_juego, orden)
VALUES
  ('10000000-0000-0000-0000-000000000006', 'Asistentes del Campamento', 'Participantes en el programa de desintoxicación digital', 'Interactúan con los Emotio-meters y participan en dinámicas', 0),
  ('10000000-0000-0000-0000-000000000006', 'Online Philosopher (CarpeDiem)', 'Reflexión filosófica sobre la vida digital vs real', 'Plantea dilemas éticos sobre el uso de redes sociales', 1);

INSERT INTO objetivos (edularp_id, tipo, descripcion)
VALUES
  ('10000000-0000-0000-0000-000000000006', 'Actitudinal', 'Concienciar sobre el impacto de la toxicidad online y el bullying'),
  ('10000000-0000-0000-0000-000000000006', 'Colaborativo', 'Desarrollar la inteligencia emocional de las interacciones cara a cara');

INSERT INTO paralelos_realidad (edularp_id, narrativa, mundo_real, proposito, orden)
VALUES
  ('10000000-0000-0000-0000-000000000006', 'Emotio-meters (pulseras de colores)', 'Expresión emocional y lenguaje corporal', 'Visualizar las emociones para desarrollar empatía', 0),
  ('10000000-0000-0000-0000-000000000006', 'Campamento de desintoxicación', 'Uso excesivo de redes sociales', 'Reflexionar sobre hábitos digitales', 1);

-- ─────────────────────────────────────────────
-- LARP007: Are You Like, OK?
-- ─────────────────────────────────────────────
INSERT INTO edularp (id, autor_id, nombre, proyecto, descripcion, storyboard, nivel_educativo, asignaturas, duracion_min, num_participantes, materiales, evaluacion, notas_docente, competencias, estado)
VALUES (
  '10000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000001',
  'Are You Like, OK?',
  'TechLARP',
  'En 2004, durante un concierto, los jugadores deben brindar ayuda espontánea a una chica triste en el baño, fomentando la empatía y la comunidad.',
  'Septiembre de 2004 en un concierto. La noche es perfecta, excepto porque una mujer está llorando en el baño. Los demás asistentes, en ese entorno seguro y efímero, deben encontrar la manera de apoyarla antes de que comience el concierto principal.',
  'Secundaria',
  'Ciencias Sociales, Educación Emocional',
  120,
  20,
  'Objetos comunes de un bolso para compartir: pañuelos, tiritas, chicles, Música de ambiente (2004), Temporizador',
  'Hablar sobre cómo podemos apoyar a extraños en nuestro día a día y la importancia de los espacios seguros para procesar emociones.',
  'Definir los límites de la interacción de forma segura (reglas emocionales). Usar un baño real como escenario o ambientar el aula adecuadamente.',
  ARRAY['Empatía','Comunicación','Comunidad','Educación Emocional'],
  'publicado'
);

INSERT INTO misiones (edularp_id, titulo, objetivo, formato, problema_larp, solucion, orden)
VALUES
  ('10000000-0000-0000-0000-000000000007', 'Contexto', 'Vestirse o ambientarse al estilo de 2004 y asignar la música', 'Juego de rol', 'Los asistentes se preparan para el concierto', 'Ambientación y puesta en escena del año 2004', 0),
  ('10000000-0000-0000-0000-000000000007', 'Incidente incitador', 'La Chica Triste revela por qué está triste', 'Juego de rol', 'Alguien está llorando en el baño del concierto', 'El grupo descubre la situación emocional', 1),
  ('10000000-0000-0000-0000-000000000007', 'Interacción', 'Los participantes le ofrecen su ayuda material y apoyo moral', 'Otro', 'La chica necesita apoyo pero los asistentes son desconocidos', 'Diálogo íntimo y compartición de artículos de cuidado personal', 2);

INSERT INTO roles_participantes (edularp_id, nombre_rol, desc_habilidad, uso_juego, orden)
VALUES
  ('10000000-0000-0000-0000-000000000007', 'Chica Triste (Sad Girl)', 'Expresar vulnerabilidad y recibir apoyo', 'Rol central que requiere expresar emociones de tristeza', 0),
  ('10000000-0000-0000-0000-000000000007', 'Asistentes del concierto', 'Empatía espontánea y cuidado entre desconocidos', 'Ofrecen apoyo material y emocional sin conocer a la persona', 1);

INSERT INTO objetivos (edularp_id, tipo, descripcion)
VALUES
  ('10000000-0000-0000-0000-000000000007', 'Colaborativo', 'Explorar y practicar la formación de comunidades espontáneas'),
  ('10000000-0000-0000-0000-000000000007', 'Actitudinal', 'Entrenar la empatía y la capacidad de cuidado (caretaking)');

INSERT INTO paralelos_realidad (edularp_id, narrativa, mundo_real, proposito, orden)
VALUES
  ('10000000-0000-0000-0000-000000000007', 'Concierto de 2004', 'Situaciones cotidianas donde alguien necesita ayuda', 'Practicar la empatía con desconocidos', 0),
  ('10000000-0000-0000-0000-000000000007', 'Compartir objetos del bolso', 'Pequeños gestos de cuidado entre personas', 'Valorar los actos de apoyo espontáneo', 1);

-- ─────────────────────────────────────────────
-- LARP008: Anywear Academy
-- ─────────────────────────────────────────────
INSERT INTO edularp (id, autor_id, nombre, proyecto, descripcion, storyboard, nivel_educativo, asignaturas, duracion_min, num_participantes, materiales, evaluacion, notas_docente, competencias, estado)
VALUES (
  '10000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000001',
  'Anywear Academy',
  'TechLARP',
  'Exploradores de una academia viajan a otros mundos para detener a un cambiaformas usando programación y lógica con placas Micro:bit.',
  'Los estudiantes son reclutados por la Academia Anywear, que los envía a través de portales a diferentes misiones. En la trama principal, un cambiaformas ha infiltrado el reino de las hadas, y los jugadores deben usar código en dispositivos físicos para detenerlo.',
  'Primaria',
  'Tecnología, Programación, Lógica',
  180,
  30,
  'Microcontroladores (Micro:bits), Portales/Puertas diseñadas en el espacio, Módulos de clase sobre código',
  'Los jugadores documentan el código desarrollado y dejan instrucciones para futuros exploradores sobre cómo usar la tecnología.',
  'Familiarizarse con los módulos de código necesarios. Tener preparados a los PNJs y las instrucciones en cada dimensión.',
  ARRAY['Tecnología','Programación','Lógica','Deducción'],
  'publicado'
);

INSERT INTO misiones (edularp_id, titulo, objetivo, formato, problema_larp, solucion, orden)
VALUES
  ('10000000-0000-0000-0000-000000000008', 'El Encuentro', 'Los exploradores visitan el Mundo de las Hadas y completan pequeñas misiones', 'Juego de rol', 'El reino de las hadas ha sido infiltrado', 'Completar misiones menores para ganar confianza y pistas', 0),
  ('10000000-0000-0000-0000-000000000008', 'La Deducción', 'Reunir pistas para descubrir que el Príncipe Hada es un impostor', 'Investigación', 'Algo no cuadra con el Príncipe Hada', 'Análisis lógico de las pistas recogidas', 1),
  ('10000000-0000-0000-0000-000000000008', 'El Enfrentamiento', 'Activar una melodía en los Micro:bits con el código correcto para desarmar al cambiaformas', 'Taller colaborativo', 'El cambiaformas solo puede ser detenido con código', 'Programar la melodía correcta en los Micro:bits', 2);

INSERT INTO roles_participantes (edularp_id, nombre_rol, desc_habilidad, uso_juego, orden)
VALUES
  ('10000000-0000-0000-0000-000000000008', 'Exploradores de la Academia', 'Programación básica y trabajo en equipo', 'Programan Micro:bits y resuelven misiones', 0),
  ('10000000-0000-0000-0000-000000000008', 'Guía de Anywear', 'Mentor que orienta en las misiones', 'NPC que da instrucciones y pistas', 1),
  ('10000000-0000-0000-0000-000000000008', 'Hadas y Príncipe Hada', 'Habitantes del reino mágico', 'NPCs que interactúan con los exploradores', 2),
  ('10000000-0000-0000-0000-000000000008', 'El Cambiaformas', 'Antagonista que se hace pasar por el Príncipe', 'NPC que los jugadores deben desenmascarar', 3);

INSERT INTO objetivos (edularp_id, tipo, descripcion)
VALUES
  ('10000000-0000-0000-0000-000000000008', 'Técnico', 'Aprender a usar variables y programación en el entorno físico (Micro:bit)'),
  ('10000000-0000-0000-0000-000000000008', 'Colaborativo', 'Resolver misiones temáticas demostrando deducción y trabajo lógico');

INSERT INTO paralelos_realidad (edularp_id, narrativa, mundo_real, proposito, orden)
VALUES
  ('10000000-0000-0000-0000-000000000008', 'Portales a otras dimensiones', 'Interfaces de programación y módulos de código', 'Conectar la fantasía con conceptos de programación', 0),
  ('10000000-0000-0000-0000-000000000008', 'Melodía que desarma al cambiaformas', 'Código funcional en Micro:bit', 'Demostrar que el código tiene efectos reales', 1);
