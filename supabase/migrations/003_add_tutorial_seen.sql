-- Add tutorial_seen column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tutorial_seen BOOLEAN NOT NULL DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.profiles.tutorial_seen IS 'Whether the user has seen the tutorial screen';
