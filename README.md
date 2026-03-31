# Prototipo_Autenticacion_Registro_Asistencia

Repository to host the source code associated with an in-house development of a solution to authenticate and track the attendance of students of a language school.

## Deploy frontend on Render (Docker)

The frontend includes a production-safe Docker image at `frontend/Dockerfile`.

### Render setup

1. Create a **Web Service** in Render.
2. Select **Environment: Docker**.
3. Set **Root Directory** to `frontend`.
4. Set **Dockerfile Path** to `Dockerfile`.
5. Set **Health Check Path** to `/health`.

### Required frontend environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BIOMETRIC_BACKEND_URL` (backend base URL, example: `https://your-backend.onrender.com`)
- `BIOMETRIC_BACKEND_INTERNAL_URL` (optional, recommended for local Docker networking, example: `http://proto-backend:4000`)
- `FRONTEND_ORIGIN` (frontend public URL, example: `https://your-frontend.onrender.com`)
- `BIOMETRIC_BACKEND_ACCESS_KEY` (optional, only if backend key mode is enabled)

### Notes for production reliability

- The Docker image uses Next.js standalone output for a smaller runtime image.
- `/health` stays publicly reachable and bypasses auth/session proxy middleware.
- If backend key mode is enabled, set the same `BIOMETRIC_BACKEND_ACCESS_KEY` in both services.
- For local Docker with both services on the same Docker network, set `BIOMETRIC_BACKEND_INTERNAL_URL=http://proto-backend:4000` in the frontend container.
