# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two equally primary users (confirmed):

- **Instructor** — the daily user. University lab instructor who, during class, opens a session for the day and marks attendance for their section's enrolled students, enters one final grade per student at the end of the quarter, and produces their section's Excel report.
- **Admin** — the oversight user. Manages the instructor accounts and the laboratory catalog (create/edit/deactivate), and produces per-section and global reports filtered by quarter.

A third party, the **student**, is not a user with an account: they interact exactly once, scanning a QR/link on the first day of class to enroll with número de cuenta, nombre, carrera, and correo.

## Product Purpose

Internal university system for lab attendance, enrollment, final grades, and reporting. It replaces paper sign-in sheets that were typed up later: attendance is captured directly in the classroom and reports come out of the same data, so the typing step and its errors disappear. Success means an instructor can mark a full section's attendance in class in seconds and an admin can produce an accurate Excel report without touching a spreadsheet by hand.

## Positioning

Enrollment is section-scoped, not student-scoped: there is no global student table. Every student belongs to a concrete `seccion` (`matriculas`), and a student appearing in another quarter/lab is a new record there. That single decision makes permissions trivial (everything hangs off `seccion_id`, enforced by Postgres RLS) and makes the account-less QR registration safe: the public route can only write into one section's roster when its token is valid and registration is open. Neighboring systems typically start from a student database and bolt sections on; this one starts from the section.

## Operating Context

- University laboratories, quarterly periods fixed as Q1–Q4 per year; "current quarter" = today within `fecha_inicio`..`fecha_fin`.
- The QR enrollment route is used on the first day of class, in the lab, from students' own phones; the instructor may close registration manually and may also add students by hand.
- Attendance is marked live, in class, on the instructor's device — speed and low interaction cost matter more than expressiveness on that surface.
- Reports are generated server-side as Excel and can be previewed, downloaded, and emailed to a specific address; the period and section data belong in the report header, not repeated per row.
- The whole product is Spanish-language; the university is UNITEC.

## Capabilities and Constraints

Roles and capabilities (from the confirmed spec at [README.md](README.md), with a near-identical copy at `../README.md`):

- **Admin:** manage instructor accounts (create/edit/deactivate); manage laboratories (create/edit/deactivate — never delete, existing sections point at them); per-section and global reports with "current quarter only" or "all" toggle.
- **Instructor:** create and manage their own sections (lab, grupo, horario, docente, periodo); generate the first-day QR/registration link; close registration; mark daily attendance; enter one final grade per student; generate their section's Excel report (preview → download → email).
- **Student (no account):** one-time QR registration form; `origen='qr'`; unique (seccion_id, numero_cuenta) prevents duplicate scans.

Durable constraints:

- No student accounts, no student login — ever. The only student touchpoint is the public `/registro/[token]` route, protected by valid token + `registro_abierto = true` + rate limiting.
- No global students table; `seccion_id` is the root of every permission (RLS: instructors see only rows where `seccion.instructor_id = auth.uid()`; admins have full access).
- Labs are deactivated, never deleted. `docente` is a display string only (no logic on it). `numero_cuenta` is unique per section, not globally. `periodos.year` is spelled in English.
- One attendance session per section per day (`UNIQUE(seccion_id, fecha)`); one final grade per student; no per-practice grades.
- Excel has two modes shared by all three report types: A = final grades, B = attendance (presentes/total + % + final grade). Column order and the title-block header format are specified in the README and must be preserved.
- Spec'd UI direction for attendance: spreadsheet-like grid, rows = students, columns = dates, with "mark all present" then correct.

Implementation state (roadmap as recorded in the app README): Next.js structure, Supabase schema + RLS + seed, auth/roles, and admin CRUD (laboratorios, instructores) are done. Still open: instructor sections + QR generation, public QR registration, attendance marking, final grades, and Excel reports (modes A/B with preview and email).

Stack (recorded from the existing codebase, not open): Next.js 16 App Router + TypeScript, Tailwind CSS 4, Framer Motion, react-icons, Supabase (Postgres + Auth, `@supabase/ssr`), pnpm; Excel and email (Resend or similar) are spec'd but not yet implemented.

## Brand Commitments

- **UNITEC branding is binding** (confirmed by the user): the interface must read as UNITEC's.
- Logo asset already exists in the app: `public/UT2.png`, currently rendered in the dashboard shell (`components/dashboard-shell.tsx`).
- **Spanish-only UI** (`lang="es"` already set in the root layout); all copy, labels, and reports are in Spanish.
- No confirmed voice or tone statement beyond the institutional branding; no other binding visual references were declared during init.

## Evidence on Hand

- Full product spec with roles, data model, flows, report column mapping, RLS rules, and roadmap: [README.md](README.md) (this app's copy, one roadmap step ahead) and its near-identical parent copy at `../README.md`.
- Working code: app routes for login, admin (dashboard, laboratorios, instructores, reportes), instructor (dashboard, reportes), Supabase migrations + seed, server-side auth helpers, dashboard shell.
- Assets: `public/UT2.png` (UNITEC logo), `public/fondo2.webp` (background image).
- **Absent, and future work must not fabricate it:** no DESIGN.md and no documented visual system; no real student/attendance data beyond `supabase/seed.sql` periods; no testimonial, marketing, pricing, or deployment claims; no confirmed email copy or report email templates; no confirmed institution display name beyond "UNITEC".

## Product Principles

1. **The classroom moment wins.** Attendance marking happens live in class; the fastest correct path through that screen outranks anything else on the surface.
2. **Section-scoped truth.** Every datum hangs off a section; do not introduce global student concepts that break the permission model or the data model.
3. **Students are guests, not users.** The student's single QR interaction must need no account, no password, and as little typing as possible — and must never be a way in past the section boundary.
4. **The report is the artifact.** Excel output with its specified columns and header block is the thing that leaves the system and reaches the department; screen design serves its accuracy.
5. **One source, no retyping.** Anything that would make a human copy data between the system and a spreadsheet defeats the product's reason to exist.
