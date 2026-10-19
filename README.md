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
- Gestiona los **laboratorios disponibles** (crear, editar, desactivar; no borrar, porque secciones existentes apuntan a ellos).
- Genera **reportes por sección** y **reportes globales** (todas las secciones), con opción de filtrar por el trimestre actual o incluir todos.

### Instructor
- Crea y administra **sus secciones** de laboratorio (asignando laboratorio, grupo, horario, docente, periodo).
- Genera el **QR/link de registro** (solo válido el primer día) para que los alumnos se inscriban en su sección.
- **Cierra el registro** de la sección cuando desea.
- Ingresa las **notas finales** de los alumnos de su sección.
- Marca la **asistencia manualmente** cada día de clase.
- Genera el **reporte Excel de su sección** (preview → descargar → enviar a un correo específico).

### Alumno (sin cuenta)
- Escanea el QR el primer día y se registra con: **número de cuenta, nombre, carrera, correo**.

---

## 3. Modelo de datos

> Decisión clave: **no existe una tabla global de alumnos**. Cada sección tiene su propia lista de inscritos (`matriculas`). Un mismo alumno en otro trimestre/laboratorio genera un **registro nuevo** en esa otra sección. Esto simplifica los permisos: todo cuelga de `seccion_id`.

```
USUARIOS (auth de Supabase)
perfiles      : id UUID PK (FK → auth.users), rol ('admin'|'instructor'),
                nombre, email (espejo de auth.users, lo llena el trigger),
                activo BOOL

CATÁLOGO (lo maneja el admin)
laboratorios  : id, nombre, ubicacion, capacidad INT, activo BOOL
periodos      : id, year INT, nombre ('Q1'|'Q2'|'Q3'|'Q4'),
                fecha_inicio DATE, fecha_fin DATE

SECCIONES (las crea el instructor)
secciones     : id, laboratorio_id FK → laboratorios,
                instructor_id FK → perfiles,
                periodo_id FK → periodos,
                grupo STRING,            -- "001", "002"... (la "sección" de la clase)
                horario STRING,          -- "07:00-09:00"
                docente STRING,          -- nombre del docente que da la clase (solo presentación)
                token_registro UUID UNIQUE,
                registro_abierto BOOL

INSCRITOS (se crean vía QR o manualmente)
matriculas    : id, seccion_id FK → secciones,
                numero_cuenta STRING,
                nombre STRING, carrera STRING, correo STRING,
                nota_final DECIMAL NULL,
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
- `docente` es un string a propósito (dato de presentación para reportes; no se usa lógica con él).
- `instructor_id` en `secciones` sí es FK: es lo que permite el aislamiento por instructor (RLS) y la columna INSTRUCTOR del reporte.
- `periodos` usa el nombre de campo `year` (en inglés).
- Los periodos son fijos Q1–Q4 por año; "trimestre actual" = hoy dentro de `fecha_inicio`..`fecha_fin`.

---

## 4. Flujos

### 4.1 Registro por QR (primer día)
1. Instructor crea la sección → se genera `token_registro` (UUID único).
2. La app expone una ruta pública `/registro/[token]` que muestra el formulario.
3. El alumno ingresa cuenta, nombre, carrera, correo → se inserta en `matriculas` con `origen='qr'`.
4. Protecciones de la ruta pública: token válido + `registro_abierto = true`, con ventana de validez (primer día) y rate-limiting.
5. El instructor puede cerrar el registro manualmente (`registro_abierto = false`).
6. También puede agregar alumnos manualmente (`origen='manual'`).

### 4.2 Asistencia manual
1. Cada día el instructor abre una **sesión** (asociada a la fecha de hoy; `UNIQUE(seccion_id, fecha)`).
2. Ve la lista de inscritos con toggle **presente/ausente** (o "marcar todos presentes" y corregir).
3. Cierra la sesión al terminar la clase.
4. UI recomendada: grilla tipo hoja de cálculo — **filas = alumnos, columnas = fechas** — para marcar rápido.
5. Métrica por alumno: `presentes / total sesiones = % asistencia`.

### 4.3 Notas finales
- El instructor ingresa **una sola nota final** por alumno al terminar el trimestre → `matriculas.nota_final`.
- Sin calificaciones por práctica.

---

## 5. Reportes Excel

Se generan **server-side** en Next.js. Los tres tipos comparten preview, descarga y envío por correo:

1. **Instructor** → solo sus secciones; preview → envía al correo que indique.
2. **Admin por sección** → cualquier sección.
3. **Admin global** → todas las secciones, con toggle *"solo trimestre actual"* o *"todas"*.

### Modos de reporte (elegibles en los 3 tipos)

**Modo A — Notas finales** *(por defecto en el reporte global del admin)*
```
ALUMNO | LABORATORIO ID | NO. CUENTA | SECCION | DOCENTE | HORARIO | INSTRUCTOR | NOTA FINAL
```

**Modo B — Asistencia** *(incluye la nota final)*
```
ALUMNO | LABORATORIO ID | NO. CUENTA | SECCION | DOCENTE | HORARIO | INSTRUCTOR |
ASISTENCIAS (presentes/total) | % ASISTENCIA | NOTA FINAL
```

### Mapeo de columnas
| Columna | Origen |
|---|---|
| ALUMNO | `matriculas.nombre` |
| LABORATORIO ID | `laboratorios.nombre` |
| NO. CUENTA | `matriculas.numero_cuenta` |
| SECCION | `secciones.grupo` (la sección de la clase, no del laboratorio) |
| DOCENTE | `secciones.docente` |
| HORARIO | `secciones.horario` |
| INSTRUCTOR | `perfiles.nombre` |
| NOTA FINAL | `matriculas.nota_final` |
| ASISTENCIAS / % | `sesiones` + `asistencias` |

### Encabezado del Excel
El periodo (y demás datos del reporte por sección) va en el **título**, no repetido en cada fila:

```
┌─────────────────────────────────────────────────────┐
│ REPORTE DE NOTAS FINALES                            │
│ Periodo: Q1 2026          Laboratorio: Química 2    │
│ Seccion: 001              Docente: Mtra. García     │
│ Horario: 07:00-09:00      Instructor: Ing. López    │
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
4. [x] CRUD de admin (laboratorios, cuentas de instructores)
5. [ ] Secciones del instructor + generación de QR de registro
6. [ ] Registro público por QR, marcado de asistencia, notas finales
7. [ ] Reportes Excel (modos A/B) + preview + envío por correo
