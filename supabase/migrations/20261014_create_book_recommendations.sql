-- Migration: Direct Friend-to-Friend Book Recommendations (Issue #38)

CREATE TABLE IF NOT EXISTS public.book_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  note TEXT,
  status TEXT NOT NULL CHECK (status IN ('unread', 'read', 'accepted', 'dismissed')) DEFAULT 'unread',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_recommendation CHECK (sender_id <> recipient_id)
);

-- Unique constraint: cannot recommend the same book twice while unread/read
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_recommendation
ON public.book_recommendations (sender_id, recipient_id, book_id)
WHERE status IN ('unread', 'read');

CREATE INDEX IF NOT EXISTS idx_recommendations_recipient
ON public.book_recommendations (recipient_id) WHERE status IN ('unread', 'read');

CREATE INDEX IF NOT EXISTS idx_recommendations_sender
ON public.book_recommendations (sender_id);

-- Row Level Security
ALTER TABLE public.book_recommendations ENABLE ROW LEVEL SECURITY;

-- 1. Users can view recommendations they sent or received
DROP POLICY IF EXISTS "Users can view own recommendations" ON public.book_recommendations;
CREATE POLICY "Users can view own recommendations" ON public.book_recommendations
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- 2. Only friends can recommend books to each other
DROP POLICY IF EXISTS "Friends can insert recommendations" ON public.book_recommendations;
CREATE POLICY "Friends can insert recommendations" ON public.book_recommendations
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND sender_id <> recipient_id
    AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = recipient_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = recipient_id)
        )
    )
  );

-- 3. Only recipient can update status (mark read, accept, dismiss)
DROP POLICY IF EXISTS "Recipients can update recommendation status" ON public.book_recommendations;
CREATE POLICY "Recipients can update recommendation status" ON public.book_recommendations
  FOR UPDATE USING (auth.uid() = recipient_id);

-- 4. Either party can delete a recommendation
DROP POLICY IF EXISTS "Sender or recipient can delete recommendation" ON public.book_recommendations;
CREATE POLICY "Sender or recipient can delete recommendation" ON public.book_recommendations
  FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

GRANT ALL ON TABLE public.book_recommendations TO authenticated, service_role;
