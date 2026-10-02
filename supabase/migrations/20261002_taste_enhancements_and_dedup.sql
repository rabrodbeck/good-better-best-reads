-- 1. Add preferred_pacing and emotional_tone to taste_profiles
ALTER TABLE public.taste_profiles 
ADD COLUMN IF NOT EXISTS preferred_pacing TEXT,
ADD COLUMN IF NOT EXISTS emotional_tone TEXT;

-- 2. Guard against duplicate title + author entries in global books catalog
CREATE UNIQUE INDEX IF NOT EXISTS unique_books_title_author 
ON public.books (lower(trim(title)), lower(trim(author)));
