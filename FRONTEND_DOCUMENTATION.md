# Frontend Documentation

> Estado del frontend al **2026-05-26** · Commit base: `99da151` (rama `develop`)
> Stack: **Next.js 16.2.1** (App Router) · **React 19.2** · **TypeScript 5** · **Tailwind v4** · **Supabase JS (`@supabase/ssr` 0.9, `@supabase/supabase-js` 2.x)** · **DigitalPersona WebSDK** (huella) · **shadcn/ui** + Radix
> Puerto por defecto: `3000` · Doc generada como referencia de tracking para próximas sesiones.

---

## 1. Estructura general

```
frontend/
├── next.config.ts          (output: standalone, alias WebSdk → src/digitalpersona/websdk.ts,
│                            proxyClientMaxBodySize: 64MB, image patterns para covers)
├── Dockerfile              (node:22 → distroless/nodejs22, runtime ARG Supabase URL/anon)
├── vercel.json             (build con @vercel/next sobre frontend/package.json)
├── components.json         (config shadcn)
├── public/                 (logos, favicons, WebSDK bundles cargados en <Script>)
└── src/
    ├── proxy.ts            (Next middleware: refresh de sesión Supabase en cada request)
    ├── app/                (rutas App Router)
    │   ├── layout.tsx              (root: fuentes, Toaster, <Script> WebSDK)
    │   ├── page.tsx                (`/` → redirect a /dashboard)
    │   ├── health/route.ts         (GET/HEAD/OPTIONS · /health · combina backend)
    │   ├── welcome/page.tsx        (limbo: sin rol o pending)
    │   ├── not-approved/page.tsx   (admin no aprobado)
    │   ├── auth/confirm/route.ts   (callback OTP de Supabase)
    │   ├── (auth)/                 (route group sin guardas)
    │   │   ├── layout.tsx
    │   │   ├── login/
    │   │   ├── register/
    │   │   ├── recover-password/
    │   │   ├── reset-password/
    │   │   └── accept-invitation/
    │   ├── (dashboard)/            (route group con guardas SSR)
    │   │   ├── layout.tsx          (resolveCurrentUserAccess + redirects)
    │   │   ├── layout-client.tsx   (sidebar + DigitalPersona provider)
    │   │   └── dashboard/
    │   │       ├── page.tsx                                  (home)
    │   │       ├── admins/{page, create, [id], [id]/edit}
    │   │       ├── students/{page, new, [id], [id]/edit}
    │   │       ├── professors/{page, new, [id], [id]/edit}
    │   │       ├── courses/{page, new, [id], [id]/edit,
    │   │       │            [id]/materials/{page, content, students, grades,
    │   │       │                            folders/[folderId]}}
    │   │       ├── course-student-association/page.tsx
    │   │       ├── attendance/page.tsx
    │   │       ├── attendance-lists/{page, [idCurso], [idCurso]/[date]}
    │   │       ├── export/page.tsx
    │   │       ├── person-identification/page.tsx
    │   │       ├── payments/{process, report}
    │   │       ├── my-courses/page.tsx
    │   │       ├── my-payments/page.tsx
    │   │       └── my-profile/page.tsx
    │   ├── actions/                (Server Actions — "use server")
    │   │   ├── admins.ts
    │   │   ├── attendance.ts
    │   │   ├── auth.ts
    │   │   ├── course-materials.ts
    │   │   ├── courses.ts
    │   │   ├── payments.ts
    │   │   ├── professors.ts
    │   │   ├── self-service.ts
    │   │   └── students.ts
    │   └── api/                    (Route handlers — solo los que necesitan lógica extra)
    │       ├── admins/route.ts
    │       ├── attendance/identify/route.ts
    │       ├── auth/{sign-in, sign-up, sign-out, recover, session-user, update-password, verify-otp}/route.ts
    │       ├── course-materials/{cover, folders, folders/[id]/card,
    │       │                     files/upload, files/[id], files/youtube}/route.ts
    │       ├── courses/create/route.ts
    │       ├── person-identification/identify/route.ts
    │       ├── professors/{create, update}/route.ts
    │       ├── start-service/route.ts
    │       └── students/{create, update}/route.ts
    ├── components/                 (UI no-shadcn)
    │   ├── sidebar.tsx
    │   ├── admins-table.tsx
    │   ├── students-table.tsx
    │   ├── students-dashboard-content.tsx
    │   ├── professors-table.tsx
    │   ├── courses-table.tsx
    │   ├── detail-lookup.tsx
    │   ├── new-student-button.tsx
    │   ├── new-professor-button.tsx
    │   ├── enrollment-confirmation-pdf-button.tsx
    │   ├── user-profile-actions.tsx
    │   ├── course-materials/{folder-card, materials-nav, materials-home-client,
    │   │                     materials-content-client, materials-folder-explorer-client,
    │   │                     materials-grades-client}.tsx
    │   └── ui/                     (16 componentes shadcn: button, card, dialog,
    │                                alert-dialog, sheet, dropdown-menu, table, form,
    │                                input, label, textarea, badge, avatar, separator,
    │                                alert, sonner)
    ├── lib/
    │   ├── utils.ts                (cn = clsx + tailwind-merge)
    │   ├── types.ts                (Student, Professor, Course, Profile, Administrador)
    │   ├── identification-types.ts (CC/TI/CE/RCN/PAS/PPT)
    │   ├── student-options.ts      (grados, EPS, métodos de pago)
    │   ├── error-messages.ts       (translateErrorMessage, toAppErrorMessage)
    │   ├── attendance-export-excel.ts (ExcelJS export)
    │   ├── biometric-backend.ts    (resolveBiometricBackendBaseUrl, hint)
    │   ├── auth/
    │   │   ├── resolved-access.ts  (resolveCurrentUserAccess, ResolvedRole/Access)
    │   │   └── approved-admin.ts   (ensureApprovedAdmin, ensureApprovedRoles)
    │   ├── backend/
    │   │   └── server-api.ts       (callBackend, callBackendRaw)
    │   ├── biometrics/
    │   │   └── digitalpersona.ts   (Provider + useDigitalPersonaFingerprintReader)
    │   ├── crypto/
    │   │   └── aes-gcm.ts          (PBKDF2 + AES-GCM cliente)
    │   ├── course-materials/
    │   │   ├── page-context.ts     (getCourseMaterialsPageContext)
    │   │   └── mock-data.ts        (mocks de posts/folders/grades)
    │   └── supabase/
    │       ├── client.ts           (createBrowserClient)
    │       ├── server.ts           (createServerClient + cookies())
    │       ├── admin.ts            (service-role: invites, createManagedAuthUser)
    │       └── session.ts          (updateSession middleware)
    ├── digitalpersona/
    │   └── websdk.ts               (re-export del WebChannelClient global)
    └── types/
        └── digitalpersona-global.d.ts (declare global { WebSdk, dp })
```

### 1.1 Variables de entorno (`frontend/.env.example`)

| Variable | Lado | Propósito |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | URL del proyecto Supabase (browser SDK) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client+server | Anon key (browser SDK) |
| `NEXT_PUBLIC_BIOMETRIC_PASSPHRASE_PNG` | client | Passphrase para encriptar PNGs de huella antes de enviarlos al backend (PBKDF2 + AES-GCM) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Para `createAdminClient()` (invitaciones, gestión de auth users) |
| `BIOMETRIC_BACKEND_URL` | server | URL pública del backend Go (fallback) |
| `BIOMETRIC_BACKEND_INTERNAL_URL` | server | URL interna (Docker), preferida si está seteada (ej. `http://proto-backend:4000`) |
| `BIOMETRIC_BACKEND_ACCESS_KEY` | server | Header `X-Backend-Access-Key` para bypass del gate FrontendOnly |
| `FRONTEND_ORIGIN` | server | Header `X-Frontend-Origin` enviado al backend (primer valor del CSV) |

> El `Dockerfile` recibe `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` como build ARGs porque Next inlinea las `NEXT_PUBLIC_*` en bundle.

---

## 2. Arquitectura de capas

```
                       ┌──────────────────────────────────────┐
   Browser  ──────────►│  React 19 client components          │
                       │  · @supabase/supabase-js (anon)      │
                       │  · DigitalPersona WebSDK (USB)       │
                       │  · AES-GCM client encryption         │
                       └─────────────┬────────────────────────┘
                                     │ (server actions / fetch)
                                     ▼
                       ┌──────────────────────────────────────┐
   Next.js (SSR/RSC)   │  Server Components / Actions / API   │
                       │  · resolveCurrentUserAccess          │
                       │  · ensureApprovedAdmin/Roles         │
                       │  · @supabase/ssr (cookie session)    │
                       │  · createAdminClient (service-role)  │
                       └─────────────┬────────────────────────┘
                                     │ callBackend / callBackendRaw
                                     │ (X-Backend-Access-Key + X-Frontend-Origin)
                                     ▼
                       ┌──────────────────────────────────────┐
                       │  Go backend (Gin) en :4000           │
                       │  (FrontendOnlyMiddleware acepta el   │
                       │   origin o el shared key)            │
                       └──────────────────────────────────────┘
```

- Casi **toda** la comunicación con el backend va por el server (Server Actions + Route Handlers). Esto permite que la `SUPABASE_SERVICE_ROLE_KEY`, la `BIOMETRIC_BACKEND_ACCESS_KEY` y la base URL interna **nunca** se expongan al cliente.
- El cliente solo usa el SDK público de Supabase (auth con cookies + anon key) y el WebSDK de DigitalPersona.
- `proxy.ts` se ejecuta como middleware en cada request: refresca la sesión cookie de Supabase, y aplica dos redirects: `dashboard sin usuario → /login`, `usuario en /login|/register → /dashboard`.

---

## 3. Flujo de autenticación y RBAC

### 3.1 Resolución de acceso (`src/lib/auth/resolved-access.ts`)

`resolveCurrentUserAccess()` se llama desde Server Components y Server Actions. Hace:

1. `supabase.auth.getUser()` (cookie SSR) → si no hay user, devuelve estructura vacía.
2. Lee `user_metadata.role` (o `rol`) y `user_metadata.must_change_password`.
3. POST a `BIOMETRIC_BACKEND_URL/api/auth/resolve-access` con `{user_id, email, user_metadata}` → recibe `{role, approved, mustChangePassword, fullName, profileFound}` enriquecido (lee `profiles` + `administrador` server-side).
4. Aplica `shouldForcePasswordChange`: solo fuerza cambio si `role === "administrador"`.

Devuelve `ResolvedAccess`:

```ts
{
  user: { id, email?, user_metadata? } | null,
  role: "administrador" | "estudiante" | "profesor" | null,
  approved: boolean,
  mustChangePassword: boolean,
  fullName?: string,
  profileFound: boolean,
}
```

### 3.2 Guardas (`src/lib/auth/approved-admin.ts`)

| Helper | Reglas |
|---|---|
| `ensureApprovedRoles(allowed[], msg?)` | Logged-in → role ∈ allowed → approved. Devuelve `{ok, error?, access?}`. |
| `ensureApprovedAdmin()` | Atajo: `ensureApprovedRoles(["administrador"])` con mensaje específico de aprobación. |

Mensaje por defecto cuando no aprobado: `"Su usuario administrador no está aprobado para acceder a esta funcionalidad."` (constante exportada `APPROVAL_REQUIRED_MESSAGE`).

### 3.3 Layout del dashboard (`src/app/(dashboard)/layout.tsx`)

Aplica esta cadena de redirects (SSR):

1. `!user` → `/login`
2. `role === "administrador" && mustChangePassword` → `/reset-password?forced=1`
3. `!role` → `/welcome`
4. `!approved` → `/not-approved`

Pasa `userName`, `userEmail`, `userRole` al `DashboardLayoutClient`.

### 3.4 Middleware (`src/proxy.ts` + `src/lib/supabase/session.ts`)

Matcher: todas las rutas excepto `_next/static`, `_next/image`, `favicon.ico`, `/health`, `/api/health`, imágenes estáticas.

`updateSession(request)`:
- Crea `createServerClient` con cookies de la request.
- Llama `getUser()` para refrescar el JWT y propagar cookies actualizadas a la response.
- Redirect: `!user && /dashboard*` → `/login`; `user && (/login* | /register*)` → `/dashboard`.

> El archivo se llama `proxy.ts` (no `middleware.ts`). Verifica que tu setup de Next 16 efectivamente lo invoque como middleware si los redirects no aplican.

---

## 4. Comunicación con el backend Go

### 4.1 `src/lib/backend/server-api.ts`

```ts
callBackend<T>(path: string, init?: RequestInit): Promise<T>
callBackendRaw(path: string, init?: RequestInit): Promise<Response>
```

Comportamiento:
- Resuelve base URL con `resolveBiometricBackendBaseUrl()` (prefiere `BIOMETRIC_BACKEND_INTERNAL_URL`, cae a `BIOMETRIC_BACKEND_URL`, quita trailing slash).
- Headers automáticos:
  - `Content-Type: application/json` (a menos que el body sea `FormData` o falte).
  - `X-Frontend-Origin: <primer valor de FRONTEND_ORIGIN o "http://localhost:3000">`.
  - `X-Backend-Access-Key: <BIOMETRIC_BACKEND_ACCESS_KEY>` si está configurada.
- `cache: "no-store"` siempre.
- `callBackend` parsea JSON y, si `!response.ok`, lanza `Error` con `translateErrorMessage(payload?.error, "Error del backend: <status>")`.
- `callBackendRaw` no parsea; soporta `body` tipo `ReadableStream` (setea `duplex: "half"`). Útil para upload de archivos.

### 4.2 `src/lib/biometric-backend.ts`

```ts
resolveBiometricBackendBaseUrl(): string | null
biometricBackendConfigHint(): string  // texto sugiriendo cómo configurar las env vars
```

### 4.3 Supabase clients (`src/lib/supabase/`)

| Archivo | Exporta | Notas |
|---|---|---|
| `client.ts` | `createClient()` (browser) | `createBrowserClient` con anon key, usado en componentes cliente para auth + listeners. |
| `server.ts` | `createClient()` async | `createServerClient` con `cookies()` de Next; usado en RSC, Server Actions, Route handlers. |
| `admin.ts` | `createAdminClient()`, `createManagedAuthUser(...)`, `deleteAuthUserById(id)`, helpers de invitación | Service-role; auto-refresh y persistencia de sesión desactivados. Solo se debe usar server-side. |
| `session.ts` | `updateSession(request)` | Middleware usado por `proxy.ts`. |

---

## 5. Páginas

### 5.1 Públicas

| Ruta | Archivo | Descripción |
|---|---|---|
| `/` | `app/page.tsx` | Redirect inmediato a `/dashboard`. |
| `/health` | `app/health/route.ts` | `GET`/`HEAD`/`OPTIONS`. Verifica backend con `HEAD` a `{backend}/health` (timeout 3s, query `?scope=frontend` salta backend). Responde JSON `{ frontend, backend, backend_detail, overall }` con `200` u `503`. CORS `*`. |
| `/auth/confirm` | `app/auth/confirm/route.ts` | Callback OAuth/OTP de Supabase (recover, magic link). Sanitiza `next=` y redirige según resultado. |
| `/welcome` | `app/welcome/page.tsx` | Estado intermedio: usuario logueado sin rol resuelto. |
| `/not-approved` | `app/not-approved/page.tsx` | Admin pendiente de aprobación. Botón sign-out. |

### 5.2 Auth group (`src/app/(auth)/`)

Layout sin guardas, centrado, con logo a la derecha. Metadata: `"SysAsistencia - Acceso"`.

| Ruta | Función |
|---|---|
| `/login` | Sign-in vía `POST /api/auth/sign-in`. Setea sesión Supabase y redirige a `/dashboard` o `/reset-password?forced=1`. |
| `/register` | Registro de **administrador**: cédula + nombre + email + password (≥8). Llama `POST /api/auth/sign-up` con `metadata.role = "administrador"`. Si Supabase requiere confirmación, instruye al usuario. |
| `/recover-password` | Form con solo email. `POST /api/auth/recover` con `redirect_to` apuntando a `/auth/confirm?next=/reset-password`. |
| `/reset-password` | Soporta tanto recuperación normal como `?forced=1` (admin obligado). Valida sesión vía `POST /api/auth/session-user`, exige password ≥8 con mayúscula, minúscula y dígito, llama `POST /api/auth/update-password` y luego `POST /api/auth/sign-out`. |
| `/accept-invitation` | Para usuarios invitados; valida que el `invited_email` del query coincida con el email de la sesión activa antes de permitir setear password. |

### 5.3 Dashboard group (`src/app/(dashboard)/dashboard/`)

Layout con sidebar (3 variantes según rol) y `DigitalPersonaFingerprintProvider` envolviendo todo el árbol cliente.

#### Navegación por rol (de `src/components/sidebar.tsx`)

**Administrador**: Dashboard · Estudiantes · Profesores · Administradores · Cursos · Asociar Cursos con Estudiantes y Profesores · Tomar Asistencia · Procesar pago · Reporte de Pagos · Identificar Persona · Listas de Asistencia.

**Profesor**: Dashboard · Mi Perfil · Mis Cursos · Mis Pagos.

**Estudiante**: Dashboard · Mi Perfil · Mis Cursos · Identificar Persona · Tomar Asistencia.

#### Páginas

| Ruta | Server actions / API usadas | Notas |
|---|---|---|
| `/dashboard` | `getDashboardSummary`, `getCurrentUserCoursesOverview`, `getCurrentUserProfileOverview`, `getCurrentStudentPaymentsOverview` (según rol) | Vista resumen adaptable. |
| `/dashboard/admins` | `getAdmins` | Tabla con paginación (10/pág) y delete confirm. |
| `/dashboard/admins/create` | `createAdmin` → `POST /api/admins` | Form admin. |
| `/dashboard/admins/[id]`, `/[id]/edit` | lookup + update | Detalle y edición. |
| `/dashboard/students` | `getStudents` → `StudentsDashboardContent` | Filtros por grado/tipo/coordinador + buscador. |
| `/dashboard/students/new` | `createStudent` → `POST /api/students/create` | Form de matrícula completa con captura biométrica opcional. |
| `/dashboard/students/[id]`, `/[id]/edit` | `getStudentById`, `updateStudent` → `POST /api/students/update` | El update encripta huellas client-side antes de subir. |
| `/dashboard/professors` | `getProfessors` | Tabla. |
| `/dashboard/professors/new`, `/[id]`, `/[id]/edit` | `createProfessor` / `updateProfessor` | Forms. |
| `/dashboard/courses` | `getCourses` | Tabla. |
| `/dashboard/courses/new`, `/[id]`, `/[id]/edit` | `createCourse`, `getCourseById`, `updateCourse` | CRUD básico. |
| `/dashboard/courses/[id]/materials` | `getCourseMaterialsPageContext` + `MaterialsHomeClient` | Home: cover (upload o URL), folders, posts, miembros. |
| `/dashboard/courses/[id]/materials/content` | `MaterialsContentClient` | Crea/borra carpetas top-level. |
| `/dashboard/courses/[id]/materials/folders/[folderId]` | `MaterialsFolderExplorerClient` | Tree explorer, upload (≤2GB), YouTube embed, delete, navegación anidada. |
| `/dashboard/courses/[id]/materials/grades` | `MaterialsGradesClient` | Editor de columnas con peso + tabla de notas (datos mock). |
| `/dashboard/courses/[id]/materials/students` | members fetch | Lista miembros. |
| `/dashboard/course-student-association` | `getCourseOptions`, `getParticipantsByCourseId`, `lookupParticipantsByIdentification`, `associateParticipantsToCourse`, `dissociateParticipantsFromCourse` | Asocia/desasocia personas a cursos. |
| `/dashboard/attendance` | `getCourseOptions`, `getAttendanceRosterByCourseAndDate`, `saveAttendanceForCourseAndDate`, `deleteAttendanceForCourseAndDate` + `useDigitalPersonaFingerprintReader` | Toma de asistencia con captura biométrica o toggle manual. |
| `/dashboard/attendance-lists/{page,[idCurso],[idCurso]/[date]}` | `getCourseOptions`, `getAttendanceRosterByCourseAndDate` | Histórico navegable curso → fecha → detalle editable. |
| `/dashboard/export` | `getCourseOptions`, `getAttendanceExportByCourseAndDate`, `exportAttendanceRowsToExcel` (lib client) | Genera `.xlsx` con ExcelJS. |
| `/dashboard/person-identification` | `POST /api/person-identification/identify` + fingerprint hook | Lookup por cédula o por huella. |
| `/dashboard/payments/process` | `recordPayment` (server action) | Form para registrar pago manual. |
| `/dashboard/payments/report` | `getPaymentsReport` | Filtros: cédula, rango fechas, scope (`AMBOS\|ASISTENCIA\|PROCESADOR`), limit. |
| `/dashboard/my-courses` | `getCurrentUserCoursesOverview` | Cards de cursos del rol actual. |
| `/dashboard/my-profile` | `getCurrentUserProfileOverview` | Datos + summary de asistencia (estudiantes). |
| `/dashboard/my-payments` | `getCurrentStudentPaymentsOverview` | Solo estudiantes (admin/profesor reciben error). |

---

## 6. Server Actions (`src/app/actions/`)

Todos marcados `"use server"`. Patrón común: `ensureApprovedAdmin()` / `ensureApprovedRoles([...])` → `callBackend(...)` → respuesta `{success, data?, error?}` traducida con `toAppErrorMessage`.

### `auth.ts`
Funciones de sign-in/up/out, recover, update password (mayoría duplicadas en route handlers para uso desde cliente).

### `admins.ts`
`createAdmin`, `getAdmins`, `updateAdmin`, `deleteAdmin`. Todas requieren `ensureApprovedAdmin`. La creación llama `POST /api/admins` (que orquesta Supabase admin SDK + backend Go).

### `students.ts` (confirmado)
| Función | Backend |
|---|---|
| `createStudent(StudentFormData)` | `POST /api/students/create` (normaliza UPPER, envía huellas raw o nulas) |
| `updateStudent(numero, partial)` | `POST /api/students/update` (PATCH parcial; sólo campos definidos) |
| `deleteStudent(numero)` | `POST /api/students/delete` |
| `createStudentUserProfile(numero)` | `POST /api/students/:numero/profile` |
| `deleteStudentUserProfile(numero)` | `DELETE /api/students/:numero/profile` |
| `getStudents()` | `GET /api/students` |
| `getStudentById(numero)` | `GET /api/students/:numero` |
| `studentExists(numero)` | `POST /api/students/exists` |

Todas requieren `ensureApprovedAdmin`.

### `professors.ts`
CRUD análogo a `students.ts` contra `/api/professors/*`.

### `courses.ts`
- `createCourse`, `getCourses`, `getCourseById`, `updateCourse`, `deleteCourse`.
- Participantes: `getParticipantsByCourseId`, `lookupParticipantsByIdentification`, `associateParticipantsToCourse`, `dissociateParticipantsFromCourse`.
- `getCourseOptions` (lista mínima para selects).

### `attendance.ts`
- `getAttendanceRosterByCourseAndDate`, `saveAttendanceForCourseAndDate`, `deleteAttendanceForCourseAndDate`.
- `getAttendanceExportByCourseAndDate`, `getAttendanceDatesByCourse`.

### `payments.ts`
- `getPaymentsReport(filters)` → `GET /api/payments/report`.
- `recordPayment(data)` → `POST /api/payments/process`.
- Updates manuales de saldo → `POST /api/payments/manual-status`.

### `course-materials.ts`
Lectura/mutación del snapshot, folders y archivos. Coordina con los route handlers de `/api/course-materials/*` que hacen streaming.

### `self-service.ts` (confirmado)
Wrapper específico para estudiante/profesor (no requiere admin). Funciones:

| Función | Returns |
|---|---|
| `getCurrentUserCoursesOverview()` | `{role, numeroIdentificacion, fullName, courses: PersonCourseInfo[]}` — usa `GET /api/person/by-id/:numero` |
| `getCurrentUserProfileOverview()` | Extiende lo anterior con `student?` o `professor?` + `attendance` (estudiante: `GET /api/students/:numero/attendance-summary`) |
| `getCurrentStudentPaymentsOverview()` | Solo estudiante: añade `deudaValorTotal = clases_adeudadas × valor_apoyo_semanal` |

Internamente resuelve `numero_identificacion` desde `user_metadata.numero_identificacion` (o `numeroIdentificacion`).

---

## 7. Route Handlers (`src/app/api/`)

Existen **solo** cuando hace falta lógica fuera del server action (orquestación de Supabase admin SDK, streaming, multipart, llamado desde cliente directo, etc.). Todos los demás CRUD usan server actions directamente.

| Ruta | Métodos | Lo que hace |
|---|---|---|
| `/api/start-service` | GET | Pings al backend (`/startService`) para asegurar disponibilidad del lector biométrico. |
| `/api/auth/*` (sign-in, sign-up, sign-out, recover, session-user, update-password, verify-otp) | POST | Proxies a `/api/auth/*` del backend Go. Usados desde forms cliente. |
| `/api/admins` | (GET/POST/etc.) | Orquesta Supabase admin SDK (crear/borrar auth user) + backend Go (`/api/admins/*`). |
| `/api/students/create` | POST | Llama backend `/api/students/create` que ya crea el auth user en Supabase (sin orquestación extra). |
| `/api/students/update` | POST | **Especial**: separa el payload de huellas. Si vienen huellas (raw o encriptadas) → POST aparte a `{backend}/api/students/update-fingerprints` (vía `callBackendRaw`). Resto de campos → `POST /api/students/update`. |
| `/api/professors/{create,update}` | POST | Análogo a estudiantes. |
| `/api/courses/create` | POST | Proxy a backend. |
| `/api/attendance/identify` | POST | Resuelve backend URL y `POST /api/attendance/identify` (matching biométrico restringido al curso). |
| `/api/person-identification/identify` | POST | Proxy a `/api/person/identify-by-fingerprint`. |
| `/api/course-materials/cover` | GET (image), POST | GET sirve la imagen (con cache-busting); POST sube archivo o setea URL externa. Verifica permisos con `ensureCanManageMaterials` cuando aplica. |
| `/api/course-materials/folders` | POST/PATCH/DELETE | CRUD de carpetas. |
| `/api/course-materials/folders/[id]/card` | GET/POST | Card por carpeta. |
| `/api/course-materials/files/upload` | POST | Multipart streaming hacia `callBackendRaw` (max 2GB por archivo enforcement backend). Requiere `ensureCanManageMaterials` (admin/profesor aprobado). |
| `/api/course-materials/files/[id]` | GET/DELETE | Download/delete por id. |
| `/api/course-materials/files/youtube` | POST | Crea enlace YouTube en una carpeta. |

> Nota: las páginas de auth usan **route handlers** (no server actions) para poder consumir el JSON desde `fetch` en el cliente y luego llamar `supabase.auth.setSession(...)` directamente con los tokens.

---

## 8. Componentes destacados

### Layout / chrome
- **`sidebar.tsx`** — sidebar responsive (drawer en mobile), avatar + nombre + rol + logout. Nav definido inline por rol (ver §5.3).
- **`(dashboard)/layout-client.tsx`** — wraps con `DigitalPersonaFingerprintProvider` y maneja toggle del drawer mobile.

### Tablas y formularios
- **`students-dashboard-content.tsx`** — wrapper con filtros (grado, tipo ID, coordinador), buscador y orden; renderiza `students-table`.
- **`students-table.tsx`**, **`professors-table.tsx`**, **`admins-table.tsx`**, **`courses-table.tsx`** — todas con paginación interna (10/pág) y dialog de confirmación de delete.
- **`detail-lookup.tsx`** — input + botón para buscar persona/curso por ID y navegar al detalle.
- **`new-student-button.tsx`** — pre-llama `/api/start-service` (warm-up del lector) y luego navega a `/dashboard/students/new`.
- **`new-professor-button.tsx`** — navega a `/dashboard/professors/new`.
- **`user-profile-actions.tsx`** — toggle activar/desactivar perfil de un usuario (estudiante/profesor), con confirm dialog.
- **`enrollment-confirmation-pdf-button.tsx`** — genera PDF de confirmación de matrícula con jsPDF (logo, encabezado rojo, campos dinámicos).

### Materiales de curso (todos `*-client.tsx`)
- **`materials-nav.tsx`** — tabs Home / Content / Grades / Students.
- **`materials-home-client.tsx`** — cover (upload o URL), folder grid, posts y miembros.
- **`materials-content-client.tsx`** — CRUD de carpetas top-level (visibilidad `canManage`).
- **`materials-folder-explorer-client.tsx`** — explorador anidado con upload de archivos (≤2GB), creación de enlaces YouTube, delete, drag-drop.
- **`materials-grades-client.tsx`** — columnas con peso + tabla de notas (datos mock por ahora).
- **`folder-card.tsx`** — card con icono, nombre, contador de archivos y barra de progreso.

### `ui/` (shadcn)
16 componentes: `alert`, `alert-dialog`, `avatar`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `separator`, `sheet`, `sonner`, `table`, `textarea`, `tooltip`-equivalente, etc.

---

## 9. Biometría y crypto cliente

### 9.1 DigitalPersona WebSDK

- **Bundles** servidos desde `public/` y cargados con `<Script>` en `app/layout.tsx`: `websdk.client.bundle.min.js`, `websdk.compat.js`, `dp.core.bundle.js`, `dp.devices.bundle.js`.
- **Alias `WebSdk` → `src/digitalpersona/websdk.ts`** definido en `next.config.ts` (Turbopack y Webpack). El archivo simplemente reexporta `globalThis.WebSdk.WebChannelClient` y truena si no está cargado.
- **`src/lib/biometrics/digitalpersona.ts`** expone:
  - `<DigitalPersonaFingerprintProvider>` — provider React que envuelve el árbol del dashboard.
  - `useDigitalPersonaFingerprintReader()` — hook con `{ready, isCapturing, isReconnecting, deviceStatus, captureStatus, lastQuality, capture(mode), reconnect()}`. Modos: `"enroll-right" | "enroll-left" | "attendance"`. Maneja auto-reconnect con backoff exponencial.
- **`src/types/digitalpersona-global.d.ts`** declara `globalThis.WebSdk` y `globalThis.dp` para TypeScript.

### 9.2 AES-GCM cliente (`src/lib/crypto/aes-gcm.ts`)

Espejo del crypto del backend (`backend/services/crypto.go`):

- `deriveKeyFromPassphrase(passphrase, salt = "student-biometric-salt", iterations = 100_000)` — PBKDF2-SHA256.
- `generateAESKey()` — clave AES-256 random extractable.
- `encryptAESGCM(plaintext, key)` → `{iv: base64, ciphertext: base64}`.
- `decryptAESGCM(payload, key)` → `Uint8Array`.
- `exportKeyToRaw`, `importKeyFromRaw`.

La passphrase se lee de `NEXT_PUBLIC_BIOMETRIC_PASSPHRASE_PNG` (debe coincidir con `BIOMETRIC_PASSPHRASE_PNG` del backend). El PNG se cifra antes de enviarlo en `huella_indice_*_encrypted`.

---

## 10. Tipos y catálogos (`src/lib/`)

### `types.ts`
- `Profile { id, nombre, apellido, email, role, approved, created_at, updated_at? }`
- `Administrador { id, nombres, apellidos, role, created_at }`
- `Student { tipo_identificacion, numero_identificacion, no_matricula, nombres, apellidos, email?, grado, telefono, direccion, barrio, nombre_acudiente, telefono_acudiente, eps, coordinador_academico, programa, fecha_inicio, fecha_matricula, valor_matricula, medio_pago_matricula, valor_apoyo_semanal, clases_adelantadas?, clases_adeudadas?, total_pagado?, deuda_actual?, estado_pago?, perfil_usuario?, profile_id?, ... huellas, fechas }`
- `Professor { tipo_identificacion, numero_identificacion, nombres, apellidos, telefono, direccion, barrio, nombre_contacto_emergencia, telefono_contacto_emergencia, eps, email, perfil_usuario?, profile_id?, ... }`
- `Course { id_curso, nombre_curso, nivel_curso, hora_inicio, hora_fin, salon?, fecha_inicio?, fecha_fin?, created_at, updated_at? }`

### Enumeraciones y opciones
| Archivo | Constantes |
|---|---|
| `identification-types.ts` | `IDENTIFICATION_TYPE_VALUES = ["CC","TI","CE","RCN","PAS","PPT"]` + opciones `{value,label}` |
| `student-options.ts` | `STUDENT_GRADE_OPTIONS` (1–11, T, B), `COLOMBIA_EPS_OPTIONS` (~20 EPS + OTRO), `PAYMENT_METHOD_OPTIONS` (`EFECTIVO`, `TRANSFERENCIA`, `NEQUI`, `DAVIPLATA`, `OTRO`) |
| `error-messages.ts` | `translateErrorMessage(raw?, fallback?)`, `toAppErrorMessage(err, fallback?)` — traduce mensajes de Supabase/PostgREST a español (duplicate key, network, 409/422 etc.) |
| `utils.ts` | `cn(...inputs)` = clsx + tailwind-merge |
| `attendance-export-excel.ts` | `exportAttendanceRowsToExcel({rows, selectedDate, selectedCourseName})` — genera `.xlsx` con header rojo, fila de título mergeada y formato tabular (ExcelJS) |
| `course-materials/page-context.ts` | `getCourseMaterialsPageContext(courseId)` → `{course, access, canManage}` (`canManage = role ∈ {admin, profesor}`) |
| `course-materials/mock-data.ts` | Datos mock para grades/posts/members (a reemplazar cuando se conecte) |

> **Nota frontend**: los enums del frontend incluyen `NEQUI` y `DAVIPLATA` como métodos de pago, mientras que el backend (`backend/services/domain.go`) solo lista `EFECTIVO`, `TRANSFERENCIA`, `OTRO`. Verificar si esto es deuda técnica o si el backend acepta los strings tal cual sin validación.

---

## 11. Patrón típico de un flujo CRUD

Tomando `crear estudiante` como ejemplo:

```
[Form en /dashboard/students/new]
        │
        │ onSubmit → invoca server action createStudent(form)
        ▼
[src/app/actions/students.ts → createStudent]
        │ ensureApprovedAdmin() → ok
        │ callBackend("/api/students/create", {POST, body JSON normalizado})
        ▼
[Backend Go /api/students/create]
        │ FrontendOnlyMiddleware acepta (X-Backend-Access-Key o origin)
        │ Crea auth user en Supabase + insert en `estudiantes`
        │ Rollback de auth user si falla el insert
        ▼
        Response { success, data, auth_user_id, requires_password_change }
        │
        ▼ (de vuelta en el server action → de vuelta al client)
        toast.success / toast.error usando translateErrorMessage
```

Para `update` con huellas hay un paso extra: el route handler `/api/students/update` **separa** el payload, manda los campos al endpoint normal y las huellas a `/api/students/update-fingerprints` con `callBackendRaw`.

---

## 12. Cómo correr el frontend

```bash
cd frontend
cp .env.example .env.local
# completar las variables (ver §1.1)
npm install
npm run dev       # next dev --webpack en :3000
```

Build de producción:

```bash
npm run build
npm run start     # node .next/standalone/server.js
```

Docker:

```bash
docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
             --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
             -t frontend ./frontend
docker run -p 3000:3000 --env-file frontend/.env.local frontend
```

Load test (script de stress, opcional):
```bash
npm run load:test
```

---

## 13. Deuda técnica / notas operativas

- **Mocks en course materials/grades**: `materials-grades-client` y partes de `materials-home-client` consumen `mock-data.ts`. Falta integrar con backend real.
- **Métodos de pago divergentes**: frontend permite `NEQUI`/`DAVIPLATA`, backend solo enumera `EFECTIVO`/`TRANSFERENCIA`/`OTRO`.
- **`proxy.ts` vs `middleware.ts`**: archivo nombrado `proxy.ts`. Si los redirects de `updateSession` no aplican en tu entorno, renombrar a `middleware.ts` o ajustar tu setup Next 16.
- **Password inicial = cédula** para users administrados (lo enfoca el backend pero el frontend no obliga el primer cambio para estudiantes/profesores; sí lo hace para admins vía `mustChangePassword`).
- **Tamaño max body**: `proxyClientMaxBodySize: "64mb"` en `next.config.ts`. Para uploads >64MB usa `callBackendRaw` con streaming (sin parsear el body en el route handler de Next).
- **Imagenes locales**: `next.config.ts` permite `/api/course-materials/cover` y `/logos/**` como `localPatterns` de `<Image>`.
- **WebSDK requiere Windows + drivers DigitalPersona** instalados en el equipo cliente para que `globalThis.WebSdk` exista. En dispositivos sin lector la app debería degradar (vía `deviceStatus`/`ready === false`).
- **`SUPABASE_SERVICE_ROLE_KEY`** solo debe usarse en server runtime; verificar que ningún componente client la importe.
- **`auth_user_id`** se almacena en `estudiantes`/`profesores`, pero la sesión del frontend recupera el rol mediante `user_metadata.role`. Cuando los dos divergen, `resolveCurrentUserAccess` confía en lo que diga el backend (`/api/auth/resolve-access`).

---

_Última actualización: 2026-05-26 · Generado automáticamente desde el código fuente._
