-- Migration: Add noInspectionRequired to Request + CalendarIntegration/CalendarEvent tables

-- 1. Add noInspectionRequired to Request (fixes quote.findUnique crash)
ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "noInspectionRequired" BOOLEAN NOT NULL DEFAULT false;

-- 2. Create CalendarProvider enum (if not exists)
DO $$ BEGIN
  CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'OUTLOOK', 'ICLOUD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create CalendarSyncStatus enum (if not exists)
DO $$ BEGIN
  CREATE TYPE "CalendarSyncStatus" AS ENUM ('ACTIVE', 'ERROR', 'DISCONNECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Create CalendarIntegration table (if not exists)
CREATE TABLE IF NOT EXISTS "CalendarIntegration" (
  "id"               TEXT NOT NULL,
  "clerkUserId"      TEXT NOT NULL,
  "provider"         "CalendarProvider" NOT NULL,
  "accountEmail"     TEXT NOT NULL,
  "accessToken"      TEXT,
  "refreshToken"     TEXT,
  "tokenExpiry"      TIMESTAMP(3),
  "calendarUrl"      TEXT,
  "calendarPassword" TEXT,
  "syncEnabled"      BOOLEAN NOT NULL DEFAULT true,
  "syncOrders"       BOOLEAN NOT NULL DEFAULT true,
  "syncBaustellen"   BOOLEAN NOT NULL DEFAULT true,
  "syncTasks"        BOOLEAN NOT NULL DEFAULT false,
  "lastSyncAt"       TIMESTAMP(3),
  "status"           "CalendarSyncStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarIntegration_clerkUserId_provider_key"
  ON "CalendarIntegration"("clerkUserId", "provider");

-- 5. If CalendarIntegration already existed without the new OAuth columns, add them
ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "accessToken"      TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "refreshToken"     TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "tokenExpiry"      TIMESTAMP(3);
ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "calendarPassword" TEXT;

-- 6. Create CalendarEvent table (if not exists)
CREATE TABLE IF NOT EXISTS "CalendarEvent" (
  "id"              TEXT NOT NULL,
  "integrationId"   TEXT NOT NULL,
  "externalEventId" TEXT NOT NULL,
  "resourceType"    TEXT NOT NULL,
  "resourceId"      TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarEvent_integrationId_resourceType_resourceId_key"
  ON "CalendarEvent"("integrationId", "resourceType", "resourceId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CalendarEvent_integrationId_fkey'
    AND table_name = 'CalendarEvent'
  ) THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_integrationId_fkey"
      FOREIGN KEY ("integrationId") REFERENCES "CalendarIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
