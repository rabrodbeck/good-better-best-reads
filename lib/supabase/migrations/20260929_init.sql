-- 1. Enable pgvector extension for AI taste embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. User Profiles Table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  reading_goal INTEGER DEFAULT 12,
  current_streak INTEGER DEFAULT 0,
  taste_archetype TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Shared Global Books Catalog
-- Caches book metadata and high-res covers to prevent 429 API rate limits
CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT,
  isbn13 TEXT,
  cover_url TEXT,
  description TEXT,
  genres TEXT[] DEFAULT '{}',
  page_count INTEGER,
  published_year INTEGER,
  embedding VECTOR(768), -- Gemini 768-dimensional text embedding
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_isbn UNIQUE (isbn),
  CONSTRAINT unique_isbn13 UNIQUE (isbn13)
);

-- Fast Approximate Nearest Neighbor (HNSW) vector index for cosine distance
CREATE INDEX IF NOT EXISTS books_embedding_hnsw_idx 
ON public.books 
USING hnsw (embedding vector_cosine_ops);

-- 4. User Shelves & Reading Records
CREATE TABLE IF NOT EXISTS public.user_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  shelf TEXT NOT NULL CHECK (shelf IN ('read', 'currently-reading', 'to-read', 'did-not-finish')),
  rating NUMERIC(2, 1) CHECK (rating >= 0 AND rating <= 5),
  date_read TIMESTAMPTZ,
  user_review TEXT,
  user_shelves TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_book UNIQUE (user_id, book_id)
);

-- 5. User Taste Profiles & Holistic Vector
CREATE TABLE IF NOT EXISTS public.taste_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  archetype_name TEXT NOT NULL,
  archetype_summary TEXT NOT NULL,
  taste_vector VECTOR(768),
  top_tropes TEXT[] DEFAULT '{}',
  dealbreakers TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_taste UNIQUE (user_id)
);

-- 6. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taste_profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: Public can read, user updates own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Books: Anyone can read, authenticated users can insert (for crowd-sourced caching)
CREATE POLICY "Books are viewable by everyone" ON public.books
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert books" ON public.books
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update books" ON public.books
  FOR UPDATE USING (auth.role() = 'authenticated');

-- User Books: Users can manage their own shelves only
CREATE POLICY "Users can manage own user_books" ON public.user_books
  FOR ALL USING (auth.uid() = user_id);

-- Taste Profiles: Users can view and manage their own taste profile
CREATE POLICY "Users can manage own taste_profile" ON public.taste_profiles
  FOR ALL USING (auth.uid() = user_id);

-- 7. Personal Librarian Vector Search Function (RPC)
-- Matches books by cosine similarity, excluding books the user already read or DNF'd
CREATE OR REPLACE FUNCTION match_books (
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10,
  filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  author TEXT,
  cover_url TEXT,
  description TEXT,
  genres TEXT[],
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.title,
    b.author,
    b.cover_url,
    b.description,
    b.genres,
    1 - (b.embedding <=> query_embedding) AS similarity
  FROM public.books b
  WHERE
    b.embedding IS NOT NULL
    AND (1 - (b.embedding <=> query_embedding)) > match_threshold
    AND (
      filter_user_id IS NULL OR b.id NOT IN (
        SELECT ub.book_id 
        FROM public.user_books ub 
        WHERE ub.user_id = filter_user_id 
          AND ub.shelf IN ('read', 'did-not-finish')
      )
    )
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;