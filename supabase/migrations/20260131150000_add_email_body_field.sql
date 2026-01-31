-- Add email_body column to products table
ALTER TABLE public.products
ADD COLUMN email_body TEXT;
