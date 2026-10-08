-- Migration: Restrict email visibility in public.profiles to prevent public email harvesting (SEC-01 / Issue #18)

-- 1. Drop the overly permissive public policy that allowed anyone to SELECT all columns (including email)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profile fields viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2. Revoke broad table SELECT from anon and authenticated roles
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;

-- 3. Grant column-level SELECT on non-sensitive public profile fields only
-- Specifically OMITS the 'email' column to protect user privacy and prevent mass harvesting
GRANT SELECT (
  id,
  display_name,
  avatar_url,
  reading_goal,
  current_streak,
  taste_archetype,
  created_at,
  updated_at
) ON public.profiles TO anon;

GRANT SELECT (
  id,
  display_name,
  avatar_url,
  reading_goal,
  current_streak,
  taste_archetype,
  created_at,
  updated_at
) ON public.profiles TO authenticated;

-- 4. Re-establish Row Level Security policies
-- Public non-sensitive fields are viewable by anyone (e.g. for Reading DNA sharing and public avatars)
CREATE POLICY "Public profile fields viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

-- Authenticated users can manage their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
