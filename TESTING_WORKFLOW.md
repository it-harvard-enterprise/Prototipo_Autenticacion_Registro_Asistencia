# Email Invitation Workflow - Testing Guide

This guide provides step-by-step instructions to test the complete email invitation workflow for students and professors.

## Prerequisites

Before testing, ensure:

1. ✅ Mailpit is installed and running on `localhost:1025`
2. ✅ Supabase CLI is configured with `config.toml` pointing to Mailpit
3. ✅ Supabase local development is running (`supabase start`)
4. ✅ Backend is running on `http://localhost:8080`
5. ✅ Frontend is running on `http://localhost:3000`
6. ✅ Database migrations have been applied (specifically `20260507_auto_create_profiles.sql`)

## Quick Start Verification

### 1. Verify Mailpit is Running

Open your browser and navigate to:

```
http://localhost:8025
```

You should see the Mailpit UI with an empty inbox. Mailpit is ready to capture emails.

### 2. Verify Database Migrations

Connect to the local Supabase database:

```bash
# Get the connection string from supabase start output
# Usually: postgres://postgres:postgres@localhost:54322/postgres
```

Check that the profiles table exists:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'profiles';
```

Should show columns: `id`, `nombre`, `apellido`, `email`, `role`, `approved`, `created_at`, `updated_at`

Check that the triggers exist:

```sql
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table IN ('auth.users', 'estudiantes', 'profesores');
```

Should show: `trg_on_auth_user_created`, `trg_link_user_to_student`, `trg_link_user_to_professor`

### 3. Verify Frontend Pages

Test that the pages are accessible:

- Login page: `http://localhost:3000/login`
- Register page: `http://localhost:3000/register`
- Invitation acceptance: `http://localhost:3000/accept-invitation`
- Dashboard: `http://localhost:3000/dashboard`

## Test Scenario: Create Student and Accept Invitation

### Step 1: Create Admin Account (First Time Setup)

1. Go to `http://localhost:3000/register`
2. Create an admin account with test credentials
3. Verify it logs in successfully

### Step 2: Create a Student

1. Log in as admin
2. Go to **Dashboard > Students**
3. Click **"New Student"**
4. Fill in the form:
   - Tipo de Identificación: **CC**
   - Número de Identificación: **12345678**
   - Nombres: **Juan**
   - Apellidos: **Pérez**
   - Email: **juan.perez@test.com**
   - Grado: **1**
   - Teléfono: **3001234567**
   - Dirección: **Calle 1 #1-1**
   - Barrio: **Centro**
   - Nombre Acudiente: **María García**
   - Teléfono Acudiente: **3007654321**
   - EPS: **Nueva EPS**
   - Coordinador Académico: **Nicol Delgado**
   - Programa: **English Level 1**
   - Fecha Inicio: **2024-01-15**
   - Fecha Matrícula: **2024-01-15**
   - Valor Matrícula: **500,000**
   - Medio Pago Matrícula: **Efectivo**
   - Valor Apoyo Semanal: **50,000**
   - Skip fingerprint capture (or set as PENDING_FINGERPRINT)
5. Click **"Crear Estudiante"**
6. Should see success message: "Estudiante creado correctamente"

### Step 3: Verify Email Sent

1. Go to `http://localhost:8025` (Mailpit UI)
2. Check the inbox - should have a new email from "Escuela de Idiomas"
3. Subject should contain something like: "You have been invited"
4. Click on the email to view the invitation link
5. Look for a URL containing `/accept-invitation?code=...&type=...`

### Step 4: Accept Invitation and Set Password

1. Copy the invitation link from the Mailpit email
2. Open the link in a new browser tab (or click it in Mailpit)
3. You should be redirected to `http://localhost:3000/accept-invitation`
4. The page should show:
   - "Configurar contraseña" heading
   - Your email displayed as the username: **juan.perez@test.com**
5. Enter a password:
   - **Password:** `SecurePassword123`
   - **Confirm Password:** `SecurePassword123`
   - Must have: 8+ chars, uppercase, lowercase, number
6. Click **"Configurar contraseña"**
7. Should see success message: "Contraseña configurada exitosamente"
8. Should be redirected to login page after 2 seconds

### Step 5: Log In with New Account

1. You should be on the login page: `http://localhost:3000/login`
2. Enter credentials:
   - **Email:** `juan.perez@test.com`
   - **Password:** `SecurePassword123`
3. Click **"Iniciar sesión"**
4. Should successfully log in and see the dashboard

### Step 6: Verify Profile Was Created

1. Connect to the database:

   ```bash
   supabase db connect
   ```

2. Verify profile exists:

   ```sql
   SELECT id, nombre, apellido, email, role FROM public.profiles
   WHERE email = 'juan.perez@test.com';
   ```

   Should return:

   ```
   id          | nombre | apellido | email                | role
   ------------|--------|----------|----------------------|----------
   <UUID>      | Juan   | Pérez    | juan.perez@test.com  | estudiante
   ```

3. Verify student is linked to auth user:

   ```sql
   SELECT numero_identificacion, nombres, apellidos, email, auth_user_id
   FROM public.estudiantes
   WHERE email = 'juan.perez@test.com';
   ```

   The `auth_user_id` should NOT be NULL and should match the UUID from the profiles table.

## Test Scenario: Create Professor and Accept Invitation

### Step 1: Create a Professor

1. Log in as admin
2. Go to **Dashboard > Professors**
3. Click **"New Professor"**
4. Fill in the form:
   - Tipo de Identificación: **CC**
   - Número de Identificación: **87654321**
   - Nombres: **María**
   - Apellidos: **García**
   - Email: **maria.garcia@test.com**
   - Teléfono: **3009876543**
   - Dirección: **Calle 2 #2-2**
   - Barrio: **Norte**
   - Nombre Contacto Emergencia: **José García**
   - Teléfono Contacto Emergencia: **3008765432**
   - EPS: **Sura**
5. Click **"Crear Profesor"** (or equivalent button)
6. Should see success message

### Step 2-6: Follow Same Steps as Student

The workflow is identical to the student process.

## Test Scenario: Already Registered Email

### Step 1: Try to Create Student with Existing Email

1. Create a student with email: `existing@test.com`
2. Accept invitation and set password
3. Try to create another student with the same email
4. The system should:
   - Option A: Show error "This email is already registered"
   - Option B: Accept it and not send duplicate invitation

Check the application behavior and adjust if needed.

## Test Scenario: Error Handling

### Test 1: Invalid Password

1. Accept invitation and try to set password
2. Try invalid passwords:
   - **Too short:** `Pass1` (less than 8 chars)
   - **No uppercase:** `password123`
   - **No lowercase:** `PASSWORD123`
   - **No number:** `PasswordTest`
3. Should show validation errors for each case

### Test 2: Password Mismatch

1. Accept invitation
2. Enter password: `SecurePassword123` in first field
3. Enter different in confirm: `SecurePassword124`
4. Should show error: "Las contraseñas no coinciden"

### Test 3: Expired/Invalid Invitation Link

1. Create student and get invitation link
2. Modify the link (change some characters in the code)
3. Open modified link
4. Should show error and not allow setting password

## Verification Checklist

After running the tests, verify:

- [ ] Email appears in Mailpit inbox
- [ ] Email contains valid invitation link
- [ ] Clicking link redirects to accept-invitation page
- [ ] Email is displayed as username on accept-invitation page
- [ ] Password validation works correctly
- [ ] Successfully setting password redirects to login
- [ ] Can log in with email and new password
- [ ] Profile record exists in database
- [ ] Profile has correct role (estudiante/profesor)
- [ ] Profile has correct nombre/apellido
- [ ] Student/professor record is linked to auth user via auth_user_id
- [ ] Role-based access control works (admin can see profiles, students can't see others)

## Troubleshooting During Testing

### Email Not Appearing in Mailpit

**Problem:** Invitation sent but email doesn't appear in Mailpit

**Solutions:**

1. Verify Mailpit is running: `http://localhost:8025`
2. Check backend logs for SMTP errors
3. Restart Supabase: `supabase stop && supabase start`
4. Verify SMTP configuration in `config.toml`:
   ```toml
   smtp_host = "localhost"
   smtp_port = 1025
   ```

### Invitation Link Not Working

**Problem:** Click link but get error or wrong page

**Solutions:**

1. Check the full URL in Mailpit email
2. Verify URL contains `type=invite` and a valid `code` parameter
3. Verify `/accept-invitation` page exists at `src/app/(auth)/accept-invitation/page.tsx`
4. Check browser console for JavaScript errors
5. Verify Supabase client is properly configured

### Can't Log In After Setting Password

**Problem:** Set password but login fails

**Solutions:**

1. Verify password was actually updated in auth.users
   ```sql
   SELECT id, email, created_at FROM auth.users
   WHERE email = 'test@test.com';
   ```
2. Try password reset/recovery flow
3. Check auth logs in Supabase dashboard
4. Verify email matches exactly (case-sensitive)

### Profile Not Created

**Problem:** User logs in but profile doesn't exist

**Solutions:**

1. Verify migration was applied:
   ```sql
   SELECT function_name FROM information_schema.routines
   WHERE function_name = 'handle_new_user';
   ```
2. Check trigger exists:
   ```sql
   SELECT * FROM information_schema.triggers
   WHERE trigger_name = 'trg_on_auth_user_created';
   ```
3. Manually trigger function:
   ```sql
   SELECT public.handle_new_user();
   ```

## Performance Testing

For larger scale testing:

1. **Bulk creation:** Create 100+ students and verify invitations are sent
2. **Email rate limiting:** Verify Mailpit handles high email volume
3. **Database performance:** Monitor database during profile creation
4. **API response time:** Verify invitation sending doesn't slow down creation

## Next Steps

After successful testing:

1. Review email templates in Supabase dashboard
2. Customize invitation email with branding
3. Set up production email service (SendGrid, AWS SES, etc.)
4. Configure email rate limiting
5. Set up email bounce handling
6. Deploy to production

## Additional Resources

- [Supabase Auth Email Templates](https://supabase.com/dashboard/project/_/auth/email-templates)
- [Mailpit Documentation](https://mailpit.axllent.org/)
- [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
