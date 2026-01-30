-- Add email configuration columns to products table
ALTER TABLE public.products
ADD COLUMN resend_api_key TEXT,
ADD COLUMN sender_email TEXT,
ADD COLUMN email_subject TEXT;
