-- Migration: Split contactPerson into firstName + lastName on Contact model

-- Add new columns
ALTER TABLE "Contact" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Contact" ADD COLUMN "lastName" TEXT;

-- Migrate existing data: split contactPerson on first space
UPDATE "Contact"
SET
  "firstName" = CASE
    WHEN "contactPerson" IS NULL THEN NULL
    WHEN POSITION(' ' IN "contactPerson") > 0 THEN SPLIT_PART("contactPerson", ' ', 1)
    ELSE "contactPerson"
  END,
  "lastName" = CASE
    WHEN "contactPerson" IS NULL THEN NULL
    WHEN POSITION(' ' IN "contactPerson") > 0 THEN SUBSTRING("contactPerson" FROM POSITION(' ' IN "contactPerson") + 1)
    ELSE NULL
  END;

-- Drop old column
ALTER TABLE "Contact" DROP COLUMN "contactPerson";
