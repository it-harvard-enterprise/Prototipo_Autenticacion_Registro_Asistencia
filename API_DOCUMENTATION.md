# Backend API Documentation

> Estado del backend al **2026-05-26** · Commit base: `99da151` (rama `develop`)
> Stack: **Go 1.25** + **Gin v1.10** + **Supabase** (PostgREST + Auth + Storage) · Matching biométrico con **SourceAFIS**
> Puerto por defecto: `4000` · Doc generada como referencia de tracking para próximas sesiones.

---

## 1. Arquitectura general

```
┌─────────────────────────────────────────────────────────────┐
│  main.go  (router Gin, registro de rutas, lectura de env)   │
├─────────────────────────────────────────────────────────────┤
│  middleware/                                                │
│    · logging.go         → SecureRequestLogger (redacta IDs) │
│    · middleware.go      → CorsMiddleware                    │
│                          → FrontendOnlyMiddleware (origin   │
│                            allow-list + X-Backend-Access-Key│
│                            constant-time compare)           │
├─────────────────────────────────────────────────────────────┤
│  handlers/                                                  │
│    · handlers.go              → enrollment + biometría      │
│    · domain_handlers.go       → CRUD personas/cursos/etc    │
│    · course_materials_handlers.go                           │
├─────────────────────────────────────────────────────────────┤
│  services/  (capa de negocio, llama a Supabase REST)        │
│    · services.go        → App, CallSupabase, extracción     │
│                          de plantillas biométricas          │
│    · crypto.go          → AES-256-GCM, PBKDF2 (passphrase   │
│                          → key derivation, 100k iter)       │
│    · domain.go          → CRUD, asistencia, pagos, auth     │
│    · profiles.go        → ensureManagedProfile/delete       │
│    · course_materials.go→ snapshot, folders, files, covers  │
├─────────────────────────────────────────────────────────────┤
│  models/                                                    │
│    · models.go          → EncryptedPayload, biometric reqs  │
│    · domain.go          → request DTOs (CRUD, auth, ...)    │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────┐    ┌────────────────────────┐
│  Supabase PostgREST   │    │   Supabase Auth Admin  │
│  (/rest/v1/*)         │    │   (/auth/v1/*)         │
└───────────────────────┘    └────────────────────────┘
            │
            ▼
┌───────────────────────┐
│  Supabase Storage     │
│  (/storage/v1/*)      │
└───────────────────────┘
```

### 1.1 Variables de entorno (`backend/.env.example`)

| Variable | Obligatoria | Propósito |
|---|---|---|
| `SUPABASE_URL` | ✅ | URL base del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service-role JWT para PostgREST/Auth Admin |
| `SUPABASE_ANON_KEY` | recomendada | Usada en endpoints públicos `/api/auth/*` |
| `BIOMETRIC_PASSPHRASE_PNG` | ✅ | Passphrase para cifrar PNGs de huella (AES-GCM) |
| `BIOMETRIC_PASSPHRASE_TEMPLATE` | ✅ | Passphrase para cifrar plantillas CBOR |
| `FRONTEND_ORIGIN` | recomendada | CSV de orígenes permitidos por CORS y FrontendOnly |
| `FRONTEND_HEALTH_URL` | recomendada | Endpoint del frontend para `/health` |
| `BIOMETRIC_BACKEND_ACCESS_KEY` | opcional | Permite saltar el gate de origin con `X-Backend-Access-Key` |
| `MATCH_THRESHOLD` | opcional | Umbral SourceAFIS (default `40.0`) |
| `PORT` | opcional | Default `4000` |
| `SUPABASE_MATERIALS_BUCKET` | ✅ (materiales) | Bucket para covers/archivos de cursos |

> El binario aborta (`log.Fatal`) si faltan `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BIOMETRIC_PASSPHRASE_PNG` o `BIOMETRIC_PASSPHRASE_TEMPLATE`.

---

## 2. Convenciones globales

### 2.1 Forma de respuesta

La gran mayoría de endpoints devuelven JSON con esta envoltura:

```json
// éxito
{ "success": true, "data": <payload> }

// éxito con flags adicionales (auth, exists, etc.)
{ "success": true, "exists": true }
{ "success": true, "numero_identificacion": "...", "confidence": 0.83 }

// error
{ "success": false, "error": "mensaje legible en español" }
```

Algunos endpoints biométricos legacy devuelven `{ "error": "..." }` (sin `success: false`); ver tabla por endpoint.

### 2.2 Códigos HTTP comunes

| Código | Significado en este backend |
|---|---|
| 200 | OK genérico |
| 201 | Creación de recurso (estudiantes, profesores, cursos, folders, YouTube, archivos) |
| 204 | Preflight CORS |
| 302 | Redirect a URL externa (cover/card externos) |
| 400 | Body inválido, parámetros faltantes, validación de negocio |
| 403 | Origen no autorizado (FrontendOnly), RBAC denegado, deuda de estudiante |
| 404 | Recurso no encontrado |
| 409 | Conflicto (correo ya registrado, nombre duplicado de folder, FK conflict) |
| 413 | Archivo demasiado grande (uploads multipart) |
| 422 | Validación Supabase Auth (email format) |
| 500 | Error interno (encriptación, parsing) |
| 502 | Falla Supabase upstream |
| 503 | `/health` degradado (frontend no responde) |

### 2.3 Middleware aplicado

Todas las rutas pasan por:

1. **`SecureRequestLogger`** — log custom Gin; redacta secuencias numéricas de 6+ dígitos en el path (cédulas, IDs).
2. **`Recovery`** — recuperación de panics.
3. **`CorsMiddleware(FRONTEND_ORIGIN)`** — allow-list con normalización `localhost` ↔ `127.0.0.1`; `/health` y `/api/health` aceptan `*`. Headers permitidos: `Content-Type, Authorization, apikey, X-Backend-Access-Key, X-Frontend-Origin`. Métodos: `GET, HEAD, POST, OPTIONS`.
4. **`FrontendOnlyMiddleware(FRONTEND_ORIGIN, BIOMETRIC_BACKEND_ACCESS_KEY)`** — bloquea `/api/*` (excepto `/api/health`) cuando el `Origin`, `X-Frontend-Origin` o `Referer` no coinciden con la allow-list. Se puede bypass con `X-Backend-Access-Key` (comparación en tiempo constante).

### 2.4 RBAC (Role-Based Access Control)

Roles válidos: `administrador`, `profesor`, `estudiante`.

- El backend resuelve el rol consultando `profiles.role` (y `administrador` como fallback) usando `user_id` o `email` enviados por el frontend.
- **Materiales de curso** aplican gating estricto:
  - Mutaciones (folders/files/covers): solo `profesor` o `administrador`.
  - Lecturas (snapshot/download): `estudiante` aprobado **sin deuda** (`saldo_estudiantes.clases_adeudadas == 0`).
- **Asistencia, pagos, CRUD de personas y cursos** asumen contexto admin/profesor en el frontend (no hay gate explícito por endpoint todavía).

### 2.5 Zonas horarias

Todas las fechas/horas que generan rangos diarios usan `America/Bogota` (UTC-5).

---

## 3. Endpoints

### 3.1 Salud y arranque

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Health combinado (backend + frontend). Devuelve `200` si todo OK, `503` si `frontend != ok`. Setea headers `X-Health-Backend`, `X-Health-Frontend`, `X-Health-Frontend-Detail`, `X-Health-Overall`. |
| `GET` | `/api/health` | `{ ok: true, threshold: <float> }` |
| `HEAD` | `/api/health` | Solo `200` |
| `GET` | `/startService` | Devuelve `{ message: "Fingerprint capture service is up and running." }` (compatibilidad legacy) |

### 3.2 Estudiantes

Tabla principal: `estudiantes`. Tablas relacionadas: `saldo_estudiantes`, `profiles`, `cursos_x_estudiantes`, `registro_asistencia`, `pagos`.

| Método | Ruta | Body / Query | Notas |
|---|---|---|---|
| `POST` | `/api/students/enroll` | `StudentEnrollRequest` | Inserta estudiante **sin** crear usuario auth. Devuelve `{success, data:{numero_identificacion,nombres,apellidos,created_at}}`. Decifra huellas si vienen como `EncryptedPayload` (AES-GCM), extrae plantilla CBOR vía SourceAFIS y la re-encripta antes de guardar. Si la huella resuelve a `PENDING_FINGERPRINT` se guarda `null`. |
| `POST` | `/api/students/create` | `StudentEnrollRequest` (requiere `email`) | Crea **además** el usuario en Supabase Auth (`role:"estudiante"`, password = `numero_identificacion`, `approved_by_admin:true`). Si el insert falla, hace rollback del auth user. Respuesta: `{success, data, auth_user_id, requires_password_change:false}`. |
| `GET` | `/api/students` | — | Lista estudiantes ordenados por `apellidos asc`, con `saldo_estudiantes` embebido y campos derivados `estado_pago`, `deuda_actual`, `perfil_usuario`, `profile_id`, `profile_role`, `profile_approved`. |
| `GET` | `/api/students/:numero_identificacion` | — | Devuelve un estudiante con las mismas anotaciones. `404` si no existe. |
| `POST` | `/api/students/exists` | `{ numero_identificacion }` | `{success, exists: bool}` |
| `POST` | `/api/students/update` | `{ numero_identificacion, data:{...} }` | PATCH parcial. Campos válidos: `tipo_identificacion, numero_identificacion, nombres, apellidos, email, grado, telefono, direccion, barrio, nombre_acudiente, telefono_acudiente, eps, programa, fecha_inicio, fecha_matricula, valor_matricula, medio_pago_matricula, valor_apoyo_semanal`. |
| `POST` | `/api/students/delete` | `{ numero_identificacion }` | DELETE en `estudiantes`. No borra el usuario de Auth ni el `profile` asociado. |
| `POST` | `/api/students/:numero_identificacion/profile` | — | Crea (o re-activa) el `profiles` para el estudiante. Si no existía `auth_user_id`, crea usuario en Auth con el `email` registrado. Errores: `400` (sin email), `409` (correo ya en Auth), `502` (Supabase upstream). |
| `DELETE` | `/api/students/:numero_identificacion/profile` | — | Elimina la fila `profiles`. No borra el estudiante ni el usuario Auth. |
| `POST` | `/api/students/update-fingerprints` | `UpdateStudentFingerprintsRequest` | Actualiza una o ambas huellas. Si no se envía ningún payload válido, devuelve `200` con `message:"No fingerprint changes received"`. |
| `GET` | `/api/students/:numero_identificacion/attendance-summary` | — | `{ numero_identificacion, attended_count, absent_count, total_count }` |

#### `StudentEnrollRequest` (resumen)

```jsonc
{
  "tipo_identificacion": "CC",
  "numero_identificacion": "1234567890",
  "no_matricula": null,
  "nombres": "JUAN",
  "apellidos": "PEREZ",
  "email": "juan@example.com",
  "grado": "10",
  "telefono": null,
  "direccion": null,
  "barrio": null,
  "nombre_acudiente": null,
  "telefono_acudiente": null,
  "eps": null,
  "coordinador_academico": "Nicol Delgado",
  "programa": null,
  "fecha_inicio": null,
  "fecha_matricula": null,
  "valor_matricula": null,
  "medio_pago_matricula": "EFECTIVO",
  "valor_apoyo_semanal": 0,

  // Huellas: legacy (plaintext base64 PNG) o encriptado AES-GCM
  "huella_indice_derecho": "iVBORw0KG...",
  "huella_indice_izquierdo": null,
  "huella_indice_derecho_encrypted":   { "iv": "base64-12B", "ciphertext": "base64..." },
  "huella_indice_izquierdo_encrypted": null
}
```

> El handler normaliza varios campos a `UPPER` (`nombres`, `apellidos`, `tipo`, `grado`, `medio_pago_matricula`) y reintenta el insert con variantes del `coordinador_academico` cuando el check constraint `chk_estudiantes_coordinador` rechaza la primera escritura (mapping conocido para Nicol/Santiago/David Delgado y Elena Martinez).

### 3.3 Profesores

Tabla principal: `profesores`.

| Método | Ruta | Body | Notas |
|---|---|---|---|
| `POST` | `/api/professors/create` | `ProfessorCreateRequest` (requiere `email`) | Crea Auth user con `role:"profesor"` y password = `numero_identificacion`. Rollback del auth user si falla el insert. |
| `GET` | `/api/professors` | — | Lista ordenada por apellidos con anotaciones de perfil. |
| `GET` | `/api/professors/:numero_identificacion` | — | Detalle. |
| `POST` | `/api/professors/exists` | `{ numero_identificacion }` | `{success, exists}` |
| `POST` | `/api/professors/update` | `{ numero_identificacion, data:{...} }` | PATCH parcial. |
| `POST` | `/api/professors/delete` | `{ numero_identificacion }` | DELETE. |
| `POST` | `/api/professors/:numero_identificacion/profile` | — | Ensure profile (idéntico flujo a estudiantes). |
| `DELETE` | `/api/professors/:numero_identificacion/profile` | — | Borra `profiles`. |

`ProfessorCreateRequest`: `tipo_identificacion, numero_identificacion, nombres, apellidos, telefono, direccion, barrio, nombre_contacto_emergencia, telefono_contacto_emergencia, eps, email`.

### 3.4 Cursos

Tabla principal: `cursos`. Se tratan como **perpetuos** (defaults `fecha_inicio = 2000-01-01`, `fecha_fin = 2999-12-31`).

| Método | Ruta | Body / Query | Notas |
|---|---|---|---|
| `GET` | `/api/courses` | — | Lista completa ordenada por `nombre_curso asc`. |
| `GET` | `/api/courses/options` | — | Lista mínima `[{id_curso, nombre_curso}]` para selects. |
| `GET` | `/api/courses/:id_curso` | — | Detalle. `400` si `id_curso` no es entero. |
| `POST` | `/api/courses/exists` | `{ id_curso }` | `{success, exists}` |
| `POST` | `/api/courses/create` | objeto libre con campos: `nombre_curso, nivel_curso, hora_inicio, hora_fin, salon?, fecha_inicio?, fecha_fin?` | `201 Created`. |
| `POST` | `/api/courses/update` | `{ id_curso, data:{...} }` | PATCH parcial. |
| `POST` | `/api/courses/delete` | `{ id_curso }` | DELETE. |

#### Participantes (junction `cursos_x_estudiantes`, `cursos_x_profesores`)

| Método | Ruta | Body | Notas |
|---|---|---|---|
| `POST` | `/api/courses/participants/lookup` | `{ participant_ids:[string] }` | Resuelve por cédula: `role ∈ ESTUDIANTE \| PROFESOR \| ESTUDIANTE_Y_PROFESOR \| NO_ENCONTRADO`. |
| `POST` | `/api/courses/participants/associate` | `{ id_curso, participant_ids:[string] }` | Inserta enlaces en ambas tablas según rol. Devuelve `{insertedStudentsCount, insertedProfessorsCount, insertedCount}`. Idempotente (omite duplicados). |
| `POST` | `/api/courses/participants/dissociate` | igual | `{deletedStudentsCount, deletedProfessorsCount, deletedCount}` |
| `GET` | `/api/courses/:id_curso/participants` | — | Lista combinada (estudiantes + profesores) con datos básicos, ordenada por `apellidos, nombres, numero_identificacion`. |
| `GET` | `/api/courses/:id_curso/students` | — | Solo estudiantes del curso (`numero_identificacion, nombres, apellidos, no_matricula, grado, tipo_identificacion`). |

### 3.5 Materiales de curso

Tablas: `course_material_folders`, `course_material_files`, `course_material_course_settings`. Storage bucket: `SUPABASE_MATERIALS_BUCKET` (más pseudo-buckets `youtube_link` y `external_url`).

> **RBAC**: todas las mutaciones requieren `profesor`/`administrador`. Lecturas requieren rol aprobado; los `estudiantes` con `saldo_estudiantes.clases_adeudadas > 0` reciben `403`.
> **`user_id`** se resuelve en este orden: header `X-Materials-User-Id` → form field `user_id` → query `user_id` → campo `user_id` del JSON. Es **requerido**.

| Método | Ruta | Body / Form | Notas |
|---|---|---|---|
| `GET` | `/api/course-materials/snapshot` | query `id_curso`, `user_id` | Devuelve `{ cover_updated_at, folders:[{id,id_curso,parent_folder_id,name,created_at,updated_at,card_updated_at,files_count}], files:[{id,id_curso,folder_id,file_name,content_type,file_size,created_at,youtube_url}] }`. |
| `POST` | `/api/course-materials/folders/create` | `{ id_curso, parent_folder_id?, name, user_id }` | `201`. `409` si el nombre ya existe en el mismo nivel. |
| `PATCH` | `/api/course-materials/folders/update` | `{ id_curso, folder_id, name, user_id }` | Sin cambios reales → no-op. |
| `POST` | `/api/course-materials/folders/delete` | `{ id_curso, folder_id, user_id }` | Borra recursivamente carpetas, archivos y limpia Storage (incluyendo cards). |
| `POST` | `/api/course-materials/files/upload` | multipart: fields `id_curso`, `folder_id`, `user_id`, `files[]` | Streaming upload. Límite **2 GB por archivo**. Sube a `courses/{id_curso}/folders/{folder_id}/{timestamp}-{rand}-{name}`. |
| `POST` | `/api/course-materials/files/delete` | `{ id, user_id }` | Borra fila + objeto en Storage si no es YouTube/external. |
| `POST` | `/api/course-materials/files/youtube/create` | `{ id_curso, folder_id, url, title, user_id }` | Valida y normaliza la URL (`youtube.com`, `youtu.be`, `m.`, `music.`). Guarda con `content_type:"video/youtube"`, `storage_bucket:"youtube_link"`. |
| `GET` | `/api/course-materials/files/:id/download` | query `user_id` | Devuelve bytes + `Content-Disposition: inline`. `400` si el archivo es un enlace YouTube. |
| `POST` | `/api/course-materials/cover/upload` | multipart: `id_curso`, `user_id`, `image` | Límite **10 MB**, solo `image/*`. Path: `courses/{id_curso}/cover/{ts}-{rand}-{name}`. Borra cover anterior si existía. |
| `POST` | `/api/course-materials/cover/url` | `{ id_curso, image_url, user_id }` | Guarda URL externa en `course_material_course_settings` con bucket `external_url`. |
| `GET` | `/api/course-materials/cover` | query `id_curso`, `user_id` | Si la cover es externa: `302` al URL. Si es interna: bytes con `Cache-Control: no-store`. |
| `POST` | `/api/course-materials/folders/card/upload` | multipart: `id_curso`, `folder_id`, `user_id`, `image` | Límite **10 MB**. Path: `courses/{id_curso}/folders/{folder_id}/card/...`. |
| `POST` | `/api/course-materials/folders/card/url` | `{ id_curso, folder_id, image_url, user_id }` | Igual que cover/url pero por folder. |
| `GET` | `/api/course-materials/folders/:id/card/download` | query `user_id` | `302` para URL externa, bytes para upload interno. |

### 3.6 Asistencia

Tabla principal: `registro_asistencia`. Afecta `saldo_estudiantes` cuando un pago se registra durante la asistencia.

| Método | Ruta | Body / Query | Notas |
|---|---|---|---|
| `GET` | `/api/attendance/roster` | query `id_curso`, `date` (YYYY-MM-DD) | Devuelve el roster con: `numero_identificacion, nombres, apellidos, asistio, saldo, metodo_pago, marcado_en, clases_adelantadas`. |
| `POST` | `/api/attendance/save` | `AttendanceSaveRequest` | Upsert manual por fila. Si `asistio=false` se limpian `saldo`, `metodo_pago`, `marcado_en`. Si `saldo="debe"` se limpia `metodo_pago`. Actualiza `saldo_estudiantes` cuando se registra un pago `cancelado` nuevo. |
| `POST` | `/api/attendance/delete` | `{ id_curso, date }` | Borra todas las filas de asistencia del curso/fecha. |
| `GET` | `/api/attendance/export` | query `id_curso`, `date` | Filas planas con `tipo_identificacion, nombres, apellidos, nombre_curso` embebidos para exportar (ordenado por `numero_identificacion asc`). |
| `GET` | `/api/attendance/dates` | query `id_curso` | Lista única de fechas (YYYY-MM-DD, TZ Bogotá) en orden `desc`. |
| `POST` | `/api/attendance/identify` | `AttendanceIdentifyRequest` | Identificación biométrica restringida al curso. Devuelve `{success, numero_identificacion, confidence}`; `numero_identificacion=null` si el score < umbral. |

#### `AttendanceSaveRequest`

```jsonc
{
  "id_curso": 12,
  "date": "2026-05-26",
  "registrado_por": "uuid del usuario",  // opcional
  "save_timestamp_iso": "2026-05-26T...", // opcional
  "rows": [
    {
      "numero_identificacion": "1234567890",
      "asistio": true,
      "saldo": "cancelado",            // "debe" | "cancelado" | null
      "metodo_pago": "EFECTIVO",       // EFECTIVO | TRANSFERENCIA | OTRO | null
      "marcado_en": "2026-05-26T..."
    }
  ]
}
```

### 3.7 Pagos

Tablas: `pagos`, `saldo_estudiantes`, vista `vista_reporte_pagos`.

| Método | Ruta | Body / Query | Notas |
|---|---|---|---|
| `GET` | `/api/payments/student/:numero_identificacion/status` | — | `{ student, recent_payments }`. |
| `POST` | `/api/payments/process` | `ProcessStudentPaymentRequest` | Inserta en `pagos` y ajusta `saldo_estudiantes` (resta deuda o suma adelanto). Modalidades: `DEUDA_TOTAL`, `DEUDA_PARCIAL`, `ADELANTO`. Métodos: `EFECTIVO`, `TRANSFERENCIA`, `OTRO`. |
| `POST` | `/api/payments/manual-status` | `ManualStudentPaymentStatusUpdateRequest` | Sobrescribe `clases_adeudadas` y `clases_adelantadas` directamente. Crea la fila si no existe. |
| `GET` | `/api/payments/report` | query `numero_identificacion?`, `from? (YYYY-MM-DD)`, `to?`, `scope? (AMBOS \| ASISTENCIA \| PROCESADOR)`, `limit?` (default 50, max 5000) | Consulta `vista_reporte_pagos`. Ordenada por `fecha_pago desc`. |

`ProcessStudentPaymentRequest`:
```jsonc
{
  "numero_identificacion": "1234567890",
  "registrado_por": "uuid",
  "metodo_pago": "EFECTIVO",
  "modalidad": "ADELANTO",
  "clases": 4,
  "notas": null,
  "id_curso": null
}
```

### 3.8 Dashboard y lookup

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/api/dashboard/summary` | Métricas para el dashboard (totales de estudiantes, cursos, deudores, asistidos/ausentes en el mes calendario actual en `America/Bogota`). |
| `GET` | `/api/person/by-id/:numero_identificacion` | Busca en `estudiantes` y `profesores`. Devuelve `{ found, numero_identificacion, records:[{role, tipo_identificacion, numero_identificacion, nombres, apellidos, cursos:[{id_curso, nombre_curso, nivel_curso, salon, hora_inicio, hora_fin}]}] }`. |
| `POST` | `/api/person/identify-by-fingerprint` | `{ fingerprint_template: "<base64 PNG>" }`. Itera todas las huellas (encriptadas en DB), elige mejor score con SourceAFIS. `confidence` normalizado a `[0,1]` (score/threshold, redondeado a 4 decimales). |

### 3.9 Auth y resolución de acceso

> Estos endpoints proxyean Supabase Auth para que el frontend no exponga su anon key. Todos vuelven `{success, data}` o `{success:false, error}`.

| Método | Ruta | Body | Notas |
|---|---|---|---|
| `POST` | `/api/auth/sign-in` | `{ email, password }` | `/auth/v1/token?grant_type=password`. |
| `POST` | `/api/auth/sign-up` | `{ email, password, metadata?, email_redirect_to? }` | `/auth/v1/signup`. |
| `POST` | `/api/auth/recover` | `{ email, redirect_to? }` | `/auth/v1/recover`. |
| `POST` | `/api/auth/verify-otp` | `{ type, token_hash }` | `/auth/v1/verify`. |
| `POST` | `/api/auth/session-user` | `{ access_token }` | `/auth/v1/user` (GET con bearer). |
| `POST` | `/api/auth/update-password` | `{ access_token, password, data? }` | `/auth/v1/user` (PUT). |
| `POST` | `/api/auth/sign-out` | `{ access_token }` | `/auth/v1/logout`. |
| `POST` | `/api/auth/resolve-access` | `{ user_id, email, user_metadata }` | Consulta `profiles` y `administrador` y devuelve `{role, approved, mustChangePassword, fullName, profileFound, email, user_id}`. |

---

## 4. Biometría: pipeline AES-GCM

1. **Frontend captura** PNG de la huella → la cifra con `BIOMETRIC_PASSPHRASE_PNG` (key = PBKDF2-SHA256, 100k iter, salt `student-biometric-salt`) → envía `EncryptedPayload { iv (base64 12B), ciphertext (base64) }`.
2. **Backend desencripta** el PNG → `services.App.ExtractTemplate` decodifica el PNG (≥1024 bytes, ≥80×80 px, DPI 500), extrae minutiae con SourceAFIS y serializa a CBOR base64.
3. **Backend re-encripta** la plantilla con `BIOMETRIC_PASSPHRASE_TEMPLATE` y guarda el `EncryptedPayload` serializado en `estudiantes.huella_indice_derecho/izquierdo` (columna `jsonb`/`text`).
4. **Identificación** (`/api/attendance/identify`, `/api/person/identify-by-fingerprint`): se decifran todas las plantillas guardadas, se construye `sourceafis.NewMatcher` con la probe y se elige el mejor score. Si `< Threshold` → `numero_identificacion=null`.

> **Compatibilidad legacy**: si llega un PNG en texto plano (`huella_indice_derecho` sin sufijo `_encrypted`) el backend lo procesa igual. En storage también se soportan plantillas guardadas como texto plano (deserialización directa CBOR cuando el `json.Unmarshal` a `EncryptedPayload` falla).

`EncryptedPayload`:
```json
{ "iv": "base64 12 bytes", "ciphertext": "base64 (incluye tag GCM)" }
```

`PENDING_FINGERPRINT` es el sentinela para "sin huella registrada"; se convierte en `null` antes de persistir.

---

## 5. Tablas Supabase referenciadas

```
estudiantes
profesores
cursos
saldo_estudiantes
pagos
profiles
administrador
cursos_x_estudiantes
cursos_x_profesores
registro_asistencia
course_material_folders
course_material_files
course_material_course_settings
vista_reporte_pagos      (VIEW)
```

Storage buckets:

```
${SUPABASE_MATERIALS_BUCKET}   (covers, cards, archivos reales)
youtube_link                    (pseudo: storage_path = URL canónica YouTube)
external_url                    (pseudo: storage_path = URL externa de imagen)
```

> No se invocan RPCs (`/rest/v1/rpc/...`) desde `services/domain.go`.

---

## 6. Constantes y enumeraciones

| Concepto | Valores |
|---|---|
| Roles | `administrador`, `profesor`, `estudiante` |
| Estado pago (derivado) | `AL_DIA`, `DEBE`, `ADELANTADO` |
| Asistencia.saldo | `debe`, `cancelado`, `null` |
| Métodos de pago | `EFECTIVO`, `TRANSFERENCIA`, `OTRO` |
| Modalidad de pago | `DEUDA_TOTAL`, `DEUDA_PARCIAL`, `ADELANTO` |
| Origen de pago (`scope`) | `AMBOS` (default), `ASISTENCIA`, `PROCESADOR` |
| Perfil usuario (derivado) | `activo`, `inactivo` |
| Lookup de persona (role) | `ESTUDIANTE`, `PROFESOR`, `ESTUDIANTE_Y_PROFESOR`, `NO_ENCONTRADO` |
| Coordinadores con variantes de case | `Nicol/Santiago/David Delgado`, `Elena Martinez` |
| Defaults | `MATCH_THRESHOLD=40`, `PORT=4000`, `DefaultFingerprint="PENDING_FINGERPRINT"`, `nonceSize=12`, `encryptionKeySize=32`, `maxCourseMaterialFileBytes=2GB`, `maxCourseMaterialCoverBytes=10MB`, `maxCourseMaterialFolderCardBytes=10MB`, course `fecha_inicio="2000-01-01"`, `fecha_fin="2999-12-31"` |

---

## 7. Notas operativas y deuda técnica conocida

- **Auth admin con service-role**: todas las llamadas a `/auth/v1/admin/*` y `/rest/v1/*` usan la `SUPABASE_SERVICE_ROLE_KEY`. El gate de seguridad real es el `FrontendOnlyMiddleware`; cuidado al exponer el puerto sin allow-list.
- **Sin RBAC enforcement en backend** para CRUD de personas/cursos/asistencia/pagos (solo materiales lo aplican). El gating actual depende del frontend que respete el rol del usuario.
- **Passwords iniciales = `numero_identificacion`**: los usuarios creados administrativamente (`/api/students/create`, `/api/professors/create`) reciben la cédula como password y `requires_password_change:false` (flag no honrado todavía).
- **Rollback parcial**: si falla el insert en `estudiantes`/`profesores` se borra el auth user, pero si falla el `EnsureProfile` post-creación queda inconsistencia silenciosa.
- **`InsertStudent` reintenta con variantes de coordinador** cuando el check constraint `chk_estudiantes_coordinador` rechaza la primera escritura.
- **Salt biométrico estático** (`student-biometric-salt`) — comentado como "en producción usar per-tenant salt o random".
- **Plantillas legacy** (sin encriptación) siguen soportadas para retrocompatibilidad; migración tracked en `db_migration_encrypted_fingerprints.sql`.
- **Streaming uploads** vía `multipart.NextPart` evitan cargar todo el archivo en memoria; sí cuentan bytes para enforce el límite de 2 GB.
- **Folder card / cover** soportan tanto upload directo como URL externa; al reemplazar se borra siempre el storage object viejo (excepto si era `external_url`).
- **Logging** redacta secuencias numéricas ≥6 dígitos en el path (`/api/students/[REDACTED]`).

---

## 8. Cómo correr el backend

```bash
cd backend
cp .env.example .env
# completar SUPABASE_URL, SERVICE_ROLE_KEY, BIOMETRIC_PASSPHRASE_*, FRONTEND_ORIGIN
go mod download
go run ./main.go
# escucha en :4000 por defecto
```

Build de producción (multi-stage, distroless):

```bash
docker build -t fingerprint-backend ./backend
docker run --rm -p 4000:4000 --env-file backend/.env fingerprint-backend
```

---

_Última actualización: 2026-05-26 · Generado automáticamente desde el código fuente._
