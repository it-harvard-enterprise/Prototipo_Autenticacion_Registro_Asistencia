-- ============================================================
-- MIGRATION: Auto-create profiles when auth users are created via invitation
-- Ejecutar en la base de datos existente
-- ============================================================

BEGIN;

-- Update the existing handle_new_user() function to also create profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role VARCHAR(50) := 'administrador';
    user_nombres VARCHAR(100);
    user_apellidos VARCHAR(100);
BEGIN
    -- Extract role and names from user metadata if available
    user_role := COALESCE(NEW.raw_user_meta_data->>'rol', 'administrador');
    user_nombres := COALESCE(NEW.raw_user_meta_data->>'nombres', '');
    user_apellidos := COALESCE(NEW.raw_user_meta_data->>'apellidos', '');

    -- Create/update profile record for all auth users
    INSERT INTO public.profiles (id, nombre, apellido, email, role, approved)
    VALUES (
        NEW.id,
        user_nombres,
        user_apellidos,
        NEW.email,
        user_role::public.role_enum,
        CASE 
            WHEN user_role = 'administrador' THEN FALSE
            ELSE TRUE
        END
    )
    ON CONFLICT (id) DO UPDATE
    SET
        nombre = EXCLUDED.nombre,
        apellido = EXCLUDED.apellido,
        email = EXCLUDED.email,
        role = EXCLUDED.role;

    -- Create administrador record if it's an admin
    IF user_role = 'administrador' THEN
        INSERT INTO public.administrador (id, nombres, apellidos)
        VALUES (
            NEW.id,
            user_nombres,
            user_apellidos
        )
        ON CONFLICT (id) DO UPDATE
        SET
            nombres = EXCLUDED.nombres,
            apellidos = EXCLUDED.apellidos;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Create a trigger to update student/professor profile links when auth users are created
CREATE OR REPLACE FUNCTION public.link_user_to_student()
RETURNS TRIGGER AS $$
BEGIN
    -- Link the auth user to the student record if email matches
    UPDATE public.estudiantes
    SET auth_user_id = NEW.id
    WHERE email = NEW.email AND auth_user_id IS NULL
    LIMIT 1;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_link_user_to_student ON auth.users;
CREATE TRIGGER trg_link_user_to_student
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.link_user_to_student();

-- Create a trigger to update professor profile links when auth users are created
CREATE OR REPLACE FUNCTION public.link_user_to_professor()
RETURNS TRIGGER AS $$
BEGIN
    -- Link the auth user to the professor record if email matches
    UPDATE public.profesores
    SET auth_user_id = NEW.id
    WHERE email = NEW.email AND auth_user_id IS NULL
    LIMIT 1;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_link_user_to_professor ON auth.users;
CREATE TRIGGER trg_link_user_to_professor
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.link_user_to_professor();

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Approved admins can view all profiles" ON public.profiles;
CREATE POLICY "Approved admins can view all profiles"
    ON public.profiles
    FOR SELECT
    USING (is_approved_admin());

COMMIT;
