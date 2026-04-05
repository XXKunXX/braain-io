// One-time migration: BaustelleStatus Enum auf neue Werte aktualisieren
// Das vorherige Migrationsskript hat die Spalte bereits auf TEXT gesetzt und Werte migriert.
// Dieses Skript erstellt den neuen Enum-Typ und setzt die Spalte zurück.
// Ausführen MIT --env-file=.env.local

import pg from "pg";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const queries = [
  // Alten Enum droppen (CASCADE)
  `DROP TYPE IF EXISTS "BaustelleStatus" CASCADE`,

  // Neuen Enum erstellen
  `CREATE TYPE "BaustelleStatus" AS ENUM ('OPEN', 'DISPONIERT', 'IN_LIEFERUNG', 'VERRECHNET', 'ABGESCHLOSSEN')`,

  // Spalte vom TEXT-Typ auf den neuen Enum-Typ zurücksetzen
  `ALTER TABLE "Baustelle" ALTER COLUMN "status" DROP DEFAULT`,
  `ALTER TABLE "Baustelle" ALTER COLUMN "status" TYPE "BaustelleStatus" USING "status"::"BaustelleStatus"`,
  `ALTER TABLE "Baustelle" ALTER COLUMN "status" SET DEFAULT 'OPEN'`,
];

for (const q of queries) {
  console.log("→", q.slice(0, 80));
  await client.query(q);
}

console.log("\n✓ BaustelleStatus Migration abgeschlossen");
await client.end();
