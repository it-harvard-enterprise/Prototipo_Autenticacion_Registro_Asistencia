# Prototipo_Autenticacion_Registro_Asistencia

Repository to host the source code associated with an in-house development of a solution to authenticate and track the attendance of students of a language school.

## Deploy frontend on Vercel

This repository contains backend and frontend code. To avoid a 404 deployment on Vercel, the project must build from the frontend directory.

The repository also includes a root `vercel.json` that forces Vercel to build the Next.js app from `frontend/package.json` to prevent monorepo root mis-detection.

### Vercel setup

1. Import the repository in Vercel (or open Project Settings if already imported).
2. In **General > Root Directory**, set `frontend`.
3. Confirm **Framework Preset** is `Next.js`.
4. Keep default commands unless you have custom needs:
   - Install Command: `npm ci`
   - Build Command: `npm run build`
5. Set all required environment variables (see list below) in **Project Settings > Environment Variables**.
6. Redeploy after saving settings.

### If you still see Vercel `NOT_FOUND`

1. Open the deployment URL from the latest successful deployment in Vercel and test it directly.
2. Confirm your custom domain is assigned to this same Vercel project and points to the latest production deployment.
3. In **Project Settings > General**, verify **Root Directory** is `frontend`.
4. In **Project Settings > Build & Development Settings**, clear any custom **Output Directory** value.
5. Trigger a new production deployment after confirming the settings.

### Required frontend environment variables (Vercel)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BIOMETRIC_BACKEND_URL` (public backend base URL, for example: `https://your-backend.onrender.com`)
- `FRONTEND_ORIGIN` (your Vercel frontend URL, for example: `https://your-project.vercel.app`)
- `BIOMETRIC_BACKEND_ACCESS_KEY` (optional, only if backend key mode is enabled)

For Vercel, keep `BIOMETRIC_BACKEND_INTERNAL_URL` empty unless you intentionally route to a private internal network.

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
