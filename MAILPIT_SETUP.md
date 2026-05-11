# Email Invitation Workflow Setup Guide

This guide explains how to configure and use the email invitation system for students and professors with Mailpit for local testing.

## Overview

The invitation workflow allows administrators to:

1. Create a student or professor record
2. Automatically send an invitation email to the provided email address
3. User receives an email with a secure invitation link
4. User clicks the link and is directed to the password setup page
5. User sets their password and their username is automatically set to their email
6. User can now log in to the system
7. A profile record is automatically created with their information

## Prerequisites

- Node.js 16+ and npm/yarn
- Docker and Docker Compose (for Supabase local development)
- Mailpit (for local email testing)

## Installation & Setup

### 1. Install Mailpit

Mailpit is a local SMTP server that captures all emails sent by your application. This is perfect for development and testing.

**On Windows:**

```powershell
# Using Scoop
scoop install mailpit

# Or download from: https://github.com/axllent/mailpit/releases
```

**On macOS:**

```bash
brew install mailpit
```

**On Linux:**

```bash
# Download the binary from: https://github.com/axllent/mailpit/releases
```

### 2. Start Mailpit

Run Mailpit to start the local SMTP server:

```bash
mailpit
```

By default, Mailpit will:

- Listen for SMTP connections on `localhost:1025`
- Provide a web UI at `http://localhost:8025`

Leave this running in a separate terminal while testing.

### 3. Configure Supabase CLI

The `supabase/config.toml` file is already configured with Mailpit settings. The configuration includes:

```toml
[auth]
enabled = true
email_auto_confirm = false
smtp_admin_email = "admin@example.com"
smtp_sender_name = "Escuela de Idiomas"
smtp_host = "localhost"
smtp_port = 1025
smtp_user = ""
smtp_pass = ""
```

### 4. Start Supabase Locally

```bash
cd Prototipo_Autenticacion_Registro_Asistencia
supabase start
```

This will start the local Supabase instance with all services configured.

### 5. Apply Database Migrations

The migration file `supabase/migrations/20260507_auto_create_profiles.sql` sets up:

- Auto-creation of profile records when auth users are created
- Linking of auth users to student/professor records
- RLS policies for profile access

The migrations are automatically applied when Supabase starts.

## Workflow Steps

### For Administrators

1. **Create a Student/Professor:**
   - Navigate to Dashboard > Students (or Professors)
   - Click "New Student" (or "New Professor")
   - Fill in all required information including email
   - Click "Create"

2. **Email Invitation Sent:**
   - The system automatically sends an invitation email
   - Check Mailpit UI at `http://localhost:8025` to see the email
   - The email contains a secure link to set the password

### For Students/Professors

1. **Receive Email Invitation:**
   - Open the email from the application
   - Find the invitation link

2. **Set Password:**
   - Click the invitation link
   - You'll be redirected to `/accept-invitation` page
   - See your email address as your username
   - Set your password (minimum 8 characters, must include uppercase, lowercase, and numbers)
   - Confirm password
   - Click "Configure Password"

3. **First Login:**
   - Go to Login page
   - Use your email as username
   - Use the password you just created
   - You're now logged in!

4. **Automatic Profile Creation:**
   - A profile record is automatically created in the `profiles` table
   - Your role is set based on the invitation metadata (student/professor)
   - Your name and apellido are populated from the respective table

## Technical Implementation

### Backend (Go)

**File:** `backend/services/services.go`

- `InviteUserByEmail()` function calls Supabase Admin API to send invitations

**File:** `backend/handlers/handlers.go`

- `EnrollStudentHandler()` calls the invitation function after student creation
- Handles errors gracefully (student created, but invitation email failed)

### Frontend (Next.js)

**File:** `frontend/src/app/(auth)/accept-invitation/page.tsx`

- Page where users set their password
- Shows email as username
- Enforces strong password requirements
- Handles confirmation and success messages

**File:** `frontend/src/app/actions/professors.ts`

- `createProfessor()` action sends invitation emails via `inviteUserByEmail()`
- Updated to redirect to `/accept-invitation` instead of `/login`

**File:** `frontend/src/lib/supabase/admin.ts`

- `inviteUserByEmail()` uses Supabase Admin API
- Handles already-registered users gracefully

### Database

**File:** `supabase/migrations/20260507_auto_create_profiles.sql`

Key components:

1. **Updated `handle_new_user()` function:**
   - Extracts role and names from auth metadata
   - Creates profile records for all invited users
   - Stores role information

2. **`link_user_to_student()` trigger:**
   - Automatically links auth users to student records
   - Matches by email address

3. **`link_user_to_professor()` trigger:**
   - Automatically links auth users to professor records
   - Matches by email address

4. **RLS Policies:**
   - Users can view/update their own profile
   - Approved admins can view all profiles

## Troubleshooting

### Emails not appearing in Mailpit

1. Verify Mailpit is running: `http://localhost:8025`
2. Check that Supabase is configured with correct SMTP settings
3. Restart Supabase: `supabase stop && supabase start`
4. Check backend logs for invitation errors

### Password Reset Link Not Working

1. Ensure the `/accept-invitation` page exists and is accessible
2. Check that `FRONTEND_ORIGIN` environment variable is set correctly
3. Verify the Supabase URL and keys are correct

### Profile Not Created

1. Check database migrations were applied: `supabase db list`
2. Verify triggers exist: `SELECT trigger_name FROM information_schema.triggers`
3. Check for RLS policy restrictions

### Email Link Redirects to Wrong Page

1. Verify `FRONTEND_ORIGIN` in professor creation is correct
2. Check the redirect URL being sent to `inviteUserByEmail()`
3. Ensure `/accept-invitation` page is properly deployed

## Environment Variables

Make sure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
FRONTEND_ORIGIN=http://localhost:3000
```

## Testing Checklist

- [ ] Mailpit is running and accessible
- [ ] Supabase is running locally
- [ ] Database migrations are applied
- [ ] Create a student with email
- [ ] Check email appears in Mailpit
- [ ] Click link in Mailpit email
- [ ] Set password on `/accept-invitation` page
- [ ] Log in with email and new password
- [ ] Verify profile was created in database
- [ ] Verify student/professor record is linked to auth user

## Production Considerations

For production deployment:

1. **Email Provider:** Replace Mailpit with a real email service (SendGrid, AWS SES, etc.)
   - Update `config.toml` with production SMTP settings
   - Or use environment variables for secret credentials

2. **Password Requirements:** Ensure password policy meets security standards
   - Current: 8 chars, 1 uppercase, 1 lowercase, 1 number
   - Consider increasing complexity as needed

3. **RLS Policies:** Review and strengthen as needed
   - Current: Users can view/edit their own profile
   - Admins can view all profiles

4. **Email Templates:** Customize invitation email templates
   - Supabase Dashboard > Authentication > Email Templates

5. **Redirect URLs:** Update `FRONTEND_ORIGIN` to production URL

## References

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)
- [Mailpit Documentation](https://mailpit.axllent.org/)
- [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
