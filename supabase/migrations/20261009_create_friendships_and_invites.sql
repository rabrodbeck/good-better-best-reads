-- Migration: Production-Hardened Social Graph (Friendships & Invites) (Issue #27)

-- 1. Friendships Table
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_friendship CHECK (requester_id <> addressee_id)
);

-- Unique pair constraint for active/pending friendships
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_friendship 
ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))
WHERE status IN ('pending', 'accepted');

-- Partial B-Tree indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_friendships_pending_incoming 
ON public.friendships (addressee_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friendships_accepted_user1 
ON public.friendships (requester_id) WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS idx_friendships_accepted_user2 
ON public.friendships (addressee_id) WHERE status = 'accepted';

-- 2. Friend Invites Table (Viral Growth / Option B)
CREATE TABLE IF NOT EXISTS public.friend_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days')
);

CREATE INDEX IF NOT EXISTS idx_friend_invites_lookup
ON public.friend_invites (LOWER(email)) WHERE status = 'pending';

-- 3. Row Level Security for Friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friendships;
CREATE POLICY "Users can view their own friendships" ON public.friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users can create friend requests" ON public.friendships;
CREATE POLICY "Users can create friend requests" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id AND requester_id <> addressee_id);

-- CRITICAL: Only addressee can accept or decline (prevents self-approval exploits)
DROP POLICY IF EXISTS "Only addressee can update status" ON public.friendships;
CREATE POLICY "Only addressee can update status" ON public.friendships
  FOR UPDATE USING (auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Either user can delete friendship" ON public.friendships;
CREATE POLICY "Either user can delete friendship" ON public.friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Invites RLS
DROP POLICY IF EXISTS "Users can view invites they sent" ON public.friend_invites;
CREATE POLICY "Users can view invites they sent" ON public.friend_invites
  FOR SELECT USING (auth.uid() = inviter_id);

DROP POLICY IF EXISTS "Users can create invites" ON public.friend_invites;
CREATE POLICY "Users can create invites" ON public.friend_invites
  FOR INSERT WITH CHECK (auth.uid() = inviter_id);

-- 4. High-Performance Inline EXISTS RLS on user_books (Friends-Only Shelf Access)
DROP POLICY IF EXISTS "Users can manage own user_books" ON public.user_books;
DROP POLICY IF EXISTS "Friends can view user_books" ON public.user_books;

CREATE POLICY "Users can manage own user_books" ON public.user_books
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Friends can view user_books" ON public.user_books
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = user_books.user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = user_books.user_id)
        )
    )
  );

-- 5. Permissions
GRANT ALL ON TABLE public.friendships TO authenticated, service_role;
GRANT ALL ON TABLE public.friend_invites TO authenticated, service_role;