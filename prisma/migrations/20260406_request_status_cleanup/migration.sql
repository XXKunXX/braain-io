-- Migrate OPEN and IN_PROGRESS request status to NEU
UPDATE "Request" SET "status" = 'NEU' WHERE "status" IN ('OPEN', 'IN_PROGRESS');

-- Remove OPEN and IN_PROGRESS from the RequestStatus enum
ALTER TYPE "RequestStatus" RENAME TO "RequestStatus_old";
CREATE TYPE "RequestStatus" AS ENUM ('NEU', 'BESICHTIGUNG_GEPLANT', 'BESICHTIGUNG_DURCHGEFUEHRT', 'ANGEBOT_ERSTELLT', 'DONE');

-- Drop the default before changing the column type
ALTER TABLE "Request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Request" ALTER COLUMN "status" TYPE "RequestStatus" USING "status"::text::"RequestStatus";
ALTER TABLE "Request" ALTER COLUMN "status" SET DEFAULT 'NEU'::"RequestStatus";

DROP TYPE "RequestStatus_old";
