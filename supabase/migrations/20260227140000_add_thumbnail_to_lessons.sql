-- Add thumbnail_url to course_lessons
ALTER TABLE public.course_lessons ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Update RLS for lessons to ensure columns are accessible (already covered by existing policies)
