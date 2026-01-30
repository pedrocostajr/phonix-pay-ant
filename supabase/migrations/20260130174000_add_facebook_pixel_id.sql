-- Add facebook_pixel_id column to products table
ALTER TABLE public.products
ADD COLUMN facebook_pixel_id TEXT;
