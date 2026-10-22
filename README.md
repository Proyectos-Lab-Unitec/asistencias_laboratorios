# Asistencias de Laboratorios — Especificación del Proyecto

Sistema **interno** para la universidad de manejo de asistencias, inscripciones y notas de laboratorios. **Los alumnos no tienen cuenta ni acceso autenticado**: su única interacción es mediante un QR/link público de registro el primer día de clases.

---

## 1. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js (App Router, TypeScript) |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth |
| Reportes | Excel server-side (ej. `exceljs`) |
| Correo | Resend u otro servicio server-side |

---

## 2. Roles

### Admin
- Gestiona las **cuentas de instructores** (crear, editar, desactivar).
- Gestiona el **catálogo de clases** (Física 1, Química, ...): se elige al crear un laboratorio y también al inscribir un alumno.
- Gestiona los **laboratorios disponibles** (crear, editar, desactivar; no borrar, porque secciones existentes apuntan a ellos).
- Las tablas de gestión permiten **seleccionar varias filas y eliminarlas de una vez**.
- Genera **reportes por sección** y **reportes globales** (todas las secciones), con opción de filtrar por el trimestre actual o incluir todos.

### Instructor
- Crea y administra **sus secciones** de laboratorio (asignando laboratorio, grupo, horario, periodo).
- Genera el **QR/link de registro** (solo válido el primer día) para que los alumnos se inscriban en su sección.
- **Cierra el registro** de la sección cuando desea.
- Ingresa las **notas finales** de los alumnos de su sección.
- Marca la **asistencia manualmente** cada día de clase.
- Da de alta, **edita y elimina alumnos** de su sección desde la grilla de asistencia.
- Genera el **reporte Excel de su sección** (preview → descargar → enviar a un correo específico).

### Alumno (sin cuenta)
- Escanea el QR el primer día y se registra con: **número de cuenta, nombre, carrera, correo, docente**.

---

## 3. Modelo de datos

> Decisión clave: **no existe una tabla global de alumnos**. Cada sección tiene su propia lista de inscritos (`matriculas`). Un mismo alumno en otro trimestre/laboratorio genera un **registro nuevo** en esa otra sección. Esto simplifica los permisos: todo cuelga de `seccion_id`.

```
USUARIOS (auth de Supabase)
perfiles      : id UUID PK (FK → auth.users), rol ('admin'|'instructor'),
                nombre, email (espejo de auth.users, lo llena el trigger),
                activo BOOL

CATÁLOGO (lo maneja el admin)
clases        : id, nombre UNIQUE, activo BOOL   -- Física 1, Química, ...
laboratorios  : id, nombre, clase_id FK → clases,
                ubicacion, capacidad INT, activo BOOL
periodos      : id, year INT, nombre ('Q1'|'Q2'|'Q3'|'Q4'),
                fecha_inicio DATE, fecha_fin DATE

SECCIONES (las crea el instructor)
secciones     : id, laboratorio_id FK → laboratorios,
                instructor_id FK → perfiles,
                periodo_id FK → periodos,
                grupo STRING,            -- la sección DEL LABORATORIO ("Viernes 4:00 p.m.")
                horario STRING,          -- "07:00-09:00"
                token_registro UUID UNIQUE,
                registro_abierto BOOL

INSCRITOS (se crean vía QR o manualmente)
matriculas    : id, seccion_id FK → secciones,
                numero_cuenta STRING,
                nombre STRING, carrera STRING, correo STRING,
                docente STRING,          -- lo declara el alumno al inscribirse
                clase_id FK → clases,    -- la materia que cursa, del catálogo
                seccion_clase STRING,    -- su paralelo de esa materia ("V1")
                nota_final DECIMAL NULL, -- escala 0 a 100, la fija la clase
                origen ('qr'|'manual'),
                registrado_en TIMESTAMPTZ
                UNIQUE (seccion_id, numero_cuenta)   -- evita duplicados por QR repetido

ASISTENCIA (la marca el instructor manualmente)
sesiones      : id, seccion_id FK → secciones, fecha DATE,
                estado ('abierta'|'cerrada')
                UNIQUE (seccion_id, fecha)
asistencias   : id, sesion_id FK → sesiones,
                matricula_id FK → matriculas,
                presente BOOL,
                marcado_por FK → perfiles,
                hora TIMESTAMPTZ
                UNIQUE (sesion_id, matricula_id)
```

### Notas de diseño
- `numero_cuenta` **no es único globalmente** (el mismo alumno puede aparecer en varias secciones), pero sí **único por sección**.
- `docente` es un string a propósito (dato de presentación para reportes; no se usa lógica con él). **Vive en `matriculas`, no en `secciones`**: lo declara el alumno cuando se inscribe, porque es el dato que aporta él, mientras que la sección se identifica por su `instructor_id`. Consecuencia para el Excel: la columna DOCENTE se lee por alumno (`matriculas.docente`) y el encabezado del reporte ya no puede mostrar un único docente de toda la sección.
- `instructor_id` en `secciones` sí es FK: es lo que permite el aislamiento por instructor (RLS) y la columna INSTRUCTOR del reporte.
- `periodos` usa el nombre de campo `year` (en inglés).
- Los periodos son fijos Q1–Q4 por año; "trimestre actual" = hoy dentro de `fecha_inicio`..`fecha_fin`.

---

## 4. Flujos

### 4.1 Registro por QR (primer día)
1. Instructor crea la sección → se genera `token_registro` (UUID único).
2. La app expone una ruta pública `/registro/[token]` que muestra el formulario.
3. El alumno ingresa cuenta, nombre, carrera, correo, docente, clase (del catálogo) y sección de su clase → se inserta en `matriculas` con `origen='qr'`.
4. Protecciones de la ruta pública: token válido + `registro_abierto = true`, con ventana de validez (primer día) y rate-limiting.
5. El instructor puede cerrar el registro manualmente (`registro_abierto = false`).
6. También puede agregar alumnos manualmente desde la pestaña **Asistencia** del espacio de la sección (`origen='manual'`), pensado para quien llegó sin celular o para corregir un registro equivocado. Van obligatorios cuenta, nombre, docente, clase y sección de clase (los cinco imprimen en el reporte); carrera y correo son opcionales porque no aparecen en el Excel.

### 4.2 Asistencia manual
1. El instructor abre la **sesión** de un día con un calendario: por defecto hoy, y también puede dar de alta una fecha pasada que se pasó por alto. No se aceptan fechas futuras (`UNIQUE(seccion_id, fecha)`).
2. Ve la lista de inscritos con toggle **presente/ausente** (o "marcar todos presentes" y corregir).
3. Cierra la sesión al terminar la clase; reabrirla es la vía para corregir un día viejo.
4. UI recomendada: grilla tipo hoja de cálculo — **filas = alumnos, columnas = fechas** — para marcar rápido.
5. Métrica por alumno: `presentes / total sesiones = % asistencia`.
6. Una sesión cerrada deja de ser editable: las casillas se atenúan y el servidor rechaza el marcado.

### 4.3 Notas finales
- El instructor ingresa **una sola nota final** por alumno al terminar el trimestre → `matriculas.nota_final`.
- Escala **0 a 100**: el tope depende de la clase, no del laboratorio.
- Sin calificaciones por práctica.
- Se capturan de una sola pasada para toda la sección, y solo se escriben las filas cuyo valor cambió.

---

## 5. Reportes Excel

Se generan **server-side** en Next.js. Todos comparten preview, descarga y envío por correo, y salen del mismo armado de datos (`lib/reportes.ts`), así que pantalla, correo y Excel no pueden divergir:

1. **Instructor** → solo sus secciones; preview → envía al correo que indique.
2. **Admin** → una sola pantalla con tres filtros de **selección múltiple**: clases, periodos y secciones. Las secciones que se ofrecen dependen de las clases y periodos marcados y se recalculan al instante (sin recargar la página); sin marcar ninguna entran todas las que cumplan el filtro. Con una sola sección el encabezado es el de esa sección; con varias describe el alcance (periodo, clase, secciones y alumnos).

### Modos de reporte (elegibles en los 3 tipos)

**Modo A — Notas finales** *(por defecto en el reporte global del admin)*
```
ALUMNO | NO. CUENTA | LABORATORIO ID | SECCION | DOCENTE | CLASE | HORARIO | INSTRUCTOR | NOTA FINAL
```

**Modo B — Asistencia** *(incluye la nota final; ASISTENCIAS va como "presentes/total")*
```
ALUMNO | NO. CUENTA | LABORATORIO ID | SECCION | DOCENTE | CLASE | HORARIO | INSTRUCTOR |
ASISTENCIAS | % ASISTENCIA | NOTA FINAL
```

### Mapeo de columnas
| Columna | Origen |
|---|---|
| ALUMNO | `matriculas.nombre` |
| LABORATORIO ID | `laboratorios.nombre` |
| NO. CUENTA | `matriculas.numero_cuenta` |
| SECCION | `matriculas.seccion_clase` (el paralelo de la clase del alumno; en matrículas viejas sin el dato, cae a `secciones.grupo`) |
| DOCENTE | `matriculas.docente` (lo declaró cada alumno) |
| CLASE | `matriculas.clase_id → clases.nombre` (si la matrícula no la trae, se usa la del laboratorio) |
| HORARIO | `secciones.horario` |
| INSTRUCTOR | `perfiles.nombre` |
| NOTA FINAL | `matriculas.nota_final` |
| ASISTENCIAS / % | `sesiones` + `asistencias` |

### Encabezado del Excel
El periodo (y demás datos del reporte por sección) va en el **título**, no repetido en cada fila. Como `docente` es por alumno, el encabezado solo lleva lo que es propio de la sección:

```
┌─────────────────────────────────────────────────────┐
│ REPORTE DE NOTAS FINALES                            │
│ Periodo: Q1 2026          Laboratorio: Química 2    │
│ Seccion: 001              Horario: 07:00-09:00      │
│ Instructor: Ing. López                              │
├─────────────────────────────────────────────────────┤
│ ALUMNO | LABORATORIO ID | NO. CUENTA | ... | NOTA   │
```

- Reporte por sección: todos los datos del encabezado.
- Reporte global: solo `Periodo: Q1 2026` si filtró un trimestre, o `Periodo: Todos` si incluye todas las secciones.

---

## 6. Seguridad (RLS en Supabase)

- **Instructor**: solo puede leer/escribir filas donde `seccion.instructor_id = auth.uid()` (secciones, matriculas, sesiones, asistencias).
- **Admin**: acceso total.
- **Ruta pública de registro**: sin auth, pero solo con `token_registro` válido y `registro_abierto = true`; rate-limiting contra spam de registros.
- El perfil (`perfiles.rol`) se resuelve desde `auth.users` y se usa en middleware para rutas protegidas.

---

## 7. Estructura de carpetas (planificada)

```
src/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── admin/          # labs, instructores, reportes globales
│   │   └── instructor/     # secciones, registro QR, asistencia, notas, reportes
│   ├── registro/[token]/   # ruta pública de alumnos (primer día)
│   └── api/                # reportes excel, envío de correo
├── components/
├── lib/                    # supabase clients, helpers
└── types/
supabase/
└── migrations/
```

---

## 8. Roadmap de implementación

1. [x] Estructura del proyecto Next.js (App Router) + carpetas
2. [x] Tablas en Supabase + políticas RLS (+ seed de periodos Q1–Q4 por año)
3. [x] Auth y roles (admin / instructor)
4. [x] CRUD de admin (clases, laboratorios, cuentas de instructores)
5. [x] Secciones del instructor + generación de QR de registro
6. [x] Registro público por QR, marcado de asistencia, notas finales
7. [x] Reportes Excel (modos A/B) + preview + envío por correo

---

## 9. Puesta en marcha en producción

`pnpm build` ya compila las 15 rutas sin errores de TypeScript ni de prerender.
Lo que falta para publicar es del lado de Supabase y del hosting.

### 1. Variables de entorno

Son cuatro, y las `NEXT_PUBLIC_*` se **incrustan en el build**: tienen que estar
puestas antes de compilar.

```
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...     # solo servidor, nunca llega al navegador
POWERAPPS_URL=https://...         # trigger del flujo de correo (opcional)
```

Ojo con la precedencia: **`.env.local` gana sobre `.env`** en todas las
compilaciones. Si `.env.local` sigue apuntando a `http://127.0.0.1:54321`, el
cliente compilado queda hablando con el Supabase local aunque `.env` tenga la
URL de producción. Antes de un build de producción hay que quitar (o renombrar)
`.env.local`, o compilar en un entorno que no lo tenga.

Sin `POWERAPPS_URL` la app funciona igual: la pantalla de reportes avisa que el
envío no está configurado y la descarga sigue disponible.

### 2. Esquema

Las migraciones son la fuente de verdad y **no están aplicadas en el proyecto
remoto** todavía:

```bash
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push
```

`supabase/seed.sql` **no** corre con `db push`: contiene los periodos de ejemplo
y las cuentas demo (`admin@universidad.com` / `admin123` e
`instructor@universidad.com` / `instr123`). Esas cuentas no deben existir en
producción.

### 3. Periodos

`periodos` no viene en las migraciones (solo en el seed), y sin periodos el
instructor no puede crear secciones. Hay que insertar al menos el año en curso:

```sql
insert into public.periodos (year, nombre, fecha_inicio, fecha_fin) values
  (2026, 'Q1', '2026-01-01', '2026-03-31'),
  (2026, 'Q2', '2026-04-01', '2026-06-30'),
  (2026, 'Q3', '2026-07-01', '2026-09-30'),
  (2026, 'Q4', '2026-10-01', '2026-12-31')
on conflict (year, nombre) do nothing;
```

### 4. Primera cuenta de administrador

No hay pantalla para crear admins (el admin solo crea instructores). Se crea la
cuenta desde el panel de Supabase, en *Authentication → Add user*, y después se
asciende el perfil:

```sql
update public.perfiles set rol = 'admin' where email = 'tu-correo@unitec.edu';
```

Sin este paso nadie puede entrar al panel.

### 5. Comprobación final

- `pnpm build` sin errores.
- Las cuatro variables puestas en el hosting (no solo en `.env`).
- `select count(*) from public.periodos;` mayor que cero y un `perfiles.rol = 'admin'`.
- Entrar por `/login` como admin y generar un reporte de prueba.
- Abrir `/registro/<token>` desde un teléfono real y completar una inscripción.
