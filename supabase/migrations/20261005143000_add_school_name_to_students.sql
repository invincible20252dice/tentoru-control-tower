-- Migration: Add school_name column to students table if not exists and reload PostgREST schema cache
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_name TEXT;

-- Reload schema cache in PostgREST
NOTIFY pgrst, 'reload schema';
