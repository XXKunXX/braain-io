// One-time migration: alte OrderStatus-Werte auf neue mappen
// PLANNED → OPEN, ACTIVE → DISPONIERT, PENDING → OPEN, INVOICED → VERRECHNET, COMPLETED → ABGESCHLOSSEN
// Ausführen MIT --env-file=.env.local VOR prisma migrate deploy

import pg from "pg";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// 1. Enum-Werte als Text-Spalte temporär umschreiben (PostgreSQL Enum-Migration Trick)
// Erst auf TEXT casten, dann umbenennen, dann neuen Enum setzen

const queries = [
  // Temporär auf Text casten
  `ALTER TABLE "Order" ALTER COLUMN "status" TYPE TEXT`,
  `ALTER TABLE "Baustelle" ALTER COLUMN "status" TYPE TEXT`,

  // Alte Werte mappen
  `UPDATE "Order" SET "status" = 'OPEN' WHERE "status" IN ('PLANNED', 'PENDING')`,
  `UPDATE "Order" SET "status" = 'DISPONIERT' WHERE "status" = 'ACTIVE'`,
  `UPDATE "Order" SET "status" = 'VERRECHNET' WHERE "status" = 'INVOICED'`,
  `UPDATE "Order" SET "status" = 'ABGESCHLOSSEN' WHERE "status" = 'COMPLETED'`,

  // Baustelle hat eigene Status-Spalte (String, kein Enum) – trotzdem konvertieren
  `UPDATE "Baustelle" SET "status" = 'OPEN' WHERE "status" IN ('PLANNED', 'PENDING')`,
  `UPDATE "Baustelle" SET "status" = 'DISPONIERT' WHERE "status" = 'ACTIVE'`,
  `UPDATE "Baustelle" SET "status" = 'VERRECHNET' WHERE "status" = 'INVOICED'`,
  `UPDATE "Baustelle" SET "status" = 'ABGESCHLOSSEN' WHERE "status" = 'COMPLETED'`,

  // Default entfernen damit DROP CASCADE funktioniert
  `ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT`,

  // Alten Enum droppen (CASCADE wegen default-Abhängigkeit)
  `DROP TYPE IF EXISTS "OrderStatus" CASCADE`,
  `CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'DISPONIERT', 'IN_LIEFERUNG', 'VERRECHNET', 'ABGESCHLOSSEN')`,

  // Spalte wieder auf Enum casten und Default setzen
  `ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::"OrderStatus"`,
  `ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'OPEN'`,
];

for (const q of queries) {
  console.log("→", q.slice(0, 80));
  await client.query(q);
}

console.log("\n✓ Migration abgeschlossen");
await client.end();
