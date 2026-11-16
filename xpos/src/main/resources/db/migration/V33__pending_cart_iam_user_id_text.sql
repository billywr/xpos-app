-- Fix varchar operator ambiguity with citext extension by using text type
ALTER TABLE pending_cart ALTER COLUMN iam_user_id TYPE text;
