-- Migration: Link Machine model to Resource model for disposition planning
-- Adds machineId to Resource so machines appear as plannable resources in disposition

ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "machineId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Resource_machineId_key" ON "Resource"("machineId");
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Resource_machineId_fkey'
    AND table_name = 'Resource'
  ) THEN
    ALTER TABLE "Resource" ADD CONSTRAINT "Resource_machineId_fkey"
    FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
