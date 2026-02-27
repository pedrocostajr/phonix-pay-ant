-- Add thumbnail_url to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
