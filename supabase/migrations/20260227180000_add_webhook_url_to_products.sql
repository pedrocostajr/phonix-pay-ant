-- Add webhook_url column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Comment on the column for clarity
COMMENT ON COLUMN products.webhook_url IS 'External URL to be notified via POST on successful payment';
