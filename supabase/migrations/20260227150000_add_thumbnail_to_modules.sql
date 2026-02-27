-- Add thumbnail_url to course_modules
ALTER TABLE public.course_modules ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
