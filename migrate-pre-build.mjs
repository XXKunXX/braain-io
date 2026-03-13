/**
 * Pre-build migration — läuft auf Vercel vor prisma db push
 * Behebt Enum-Konflikte die prisma db push nicht selbst lösen kann.
 * Idempotent: kann mehrfach ohne Fehler ausgeführt werden.
 */
import net from "net";
import tls from "tls";
import crypto from "crypto";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("DATABASE_URL nicht gesetzt"); process.exit(1); }

const url = new URL(DB_URL);
const HOST = url.hostname;
const PORT = parseInt(url.port) || 5432;
const USER = decodeURIComponent(url.username);
const PASS = decodeURIComponent(url.password);
const DATABASE = url.pathname.replace(/^\//, "");

console.log(`Migration gegen: ${HOST}/${DATABASE}`);

// ── SQL (idempotent) ──────────────────────────────────────────────────────────

const SQL = `
-- ============================================================
-- 1. OrderStatus: ASSIGNED entfernen (nur wenn noch vorhanden)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'OrderStatus' AND e.enumlabel = 'ASSIGNED'
  ) THEN
    -- Spalte zu TEXT konvertieren
    EXECUTE 'ALTER TABLE "Order" ALTER COLUMN "status" TYPE TEXT';
    -- ASSIGNED -> ACTIVE migrieren
    EXECUTE 'UPDATE "Order" SET "status" = ''ACTIVE'' WHERE "status" = ''ASSIGNED''';
    -- Default entfernen
    EXECUTE 'ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT';
    -- Alten Enum droppen
    DROP TYPE "OrderStatus";
    -- Neuen Enum erstellen
    CREATE TYPE "OrderStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');
    -- Spalte zurück auf Enum
    EXECUTE 'ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::"OrderStatus"';
    EXECUTE 'ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT ''PLANNED''::"OrderStatus"';
    RAISE NOTICE 'OrderStatus ASSIGNED entfernt';
  ELSE
    RAISE NOTICE 'OrderStatus bereits migriert, überspringe';
  END IF;
END $$;

-- ============================================================
-- 2. MachineStatus Enum
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "MachineStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE');
  RAISE NOTICE 'MachineStatus erstellt';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'MachineStatus bereits vorhanden';
END $$;

-- ============================================================
-- 3. MaintenanceType Enum
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "MaintenanceType" AS ENUM ('INSPECTION', 'REPAIR', 'SERVICE');
  RAISE NOTICE 'MaintenanceType erstellt';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'MaintenanceType bereits vorhanden';
END $$;

-- ============================================================
-- 4. Machine Tabelle
-- ============================================================
CREATE TABLE IF NOT EXISTS "Machine" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "name"         TEXT NOT NULL,
  "machineType"  TEXT NOT NULL,
  "manufacturer" TEXT,
  "model"        TEXT,
  "year"         INTEGER,
  "serialNumber" TEXT,
  "licensePlate" TEXT,
  "hourlyRate"   DECIMAL(10,2),
  "status"       "MachineStatus" NOT NULL DEFAULT 'AVAILABLE',
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. MachineUsage Tabelle
-- ============================================================
CREATE TABLE IF NOT EXISTS "MachineUsage" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "machineId"  TEXT NOT NULL,
  "orderId"    TEXT,
  "driverName" TEXT,
  "startDate"  TIMESTAMP(3) NOT NULL,
  "endDate"    TIMESTAMP(3),
  "hours"      DECIMAL(10,2),
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MachineUsage_machineId_fkey') THEN
    ALTER TABLE "MachineUsage" ADD CONSTRAINT "MachineUsage_machineId_fkey"
      FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MachineUsage_orderId_fkey') THEN
    ALTER TABLE "MachineUsage" ADD CONSTRAINT "MachineUsage_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- 6. MachineMaintenance Tabelle
-- ============================================================
CREATE TABLE IF NOT EXISTS "MachineMaintenance" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "machineId"       TEXT NOT NULL,
  "maintenanceType" "MaintenanceType" NOT NULL,
  "description"     TEXT,
  "date"            TIMESTAMP(3) NOT NULL,
  "cost"            DECIMAL(10,2),
  "nextServiceDate" TIMESTAMP(3),
  "performedBy"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MachineMaintenance_machineId_fkey') THEN
    ALTER TABLE "MachineMaintenance" ADD CONSTRAINT "MachineMaintenance_machineId_fkey"
      FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- 7. BaustelleStatus Enum
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "BaustelleStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');
  RAISE NOTICE 'BaustelleStatus erstellt';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'BaustelleStatus bereits vorhanden';
END $$;

-- ============================================================
-- 8. Baustelle Tabelle
-- ============================================================
CREATE TABLE IF NOT EXISTS "Baustelle" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "orderId"       TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "address"       TEXT,
  "postalCode"    TEXT,
  "city"          TEXT,
  "country"       TEXT NOT NULL DEFAULT 'Österreich',
  "startDate"     TIMESTAMP(3) NOT NULL,
  "endDate"       TIMESTAMP(3),
  "status"        "BaustelleStatus" NOT NULL DEFAULT 'PLANNED',
  "bauleiter"     TEXT,
  "contactPerson" TEXT,
  "phone"         TEXT,
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Baustelle_orderId_fkey') THEN
    ALTER TABLE "Baustelle" ADD CONSTRAINT "Baustelle_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- 9. Tagesrapport Tabelle
-- ============================================================
CREATE TABLE IF NOT EXISTS "Tagesrapport" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "baustelleId" TEXT NOT NULL,
  "date"        TIMESTAMP(3) NOT NULL,
  "driverName"  TEXT,
  "machineName" TEXT,
  "hours"       DECIMAL(10,2),
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Tagesrapport_baustelleId_fkey') THEN
    ALTER TABLE "Tagesrapport" ADD CONSTRAINT "Tagesrapport_baustelleId_fkey"
      FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- 10. baustelleId zu DispositionEntry
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'DispositionEntry' AND column_name = 'baustelleId') THEN
    ALTER TABLE "DispositionEntry" ADD COLUMN "baustelleId" TEXT;
    ALTER TABLE "DispositionEntry" ADD CONSTRAINT "DispositionEntry_baustelleId_fkey"
      FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE SET NULL;
    RAISE NOTICE 'baustelleId zu DispositionEntry hinzugefügt';
  ELSE
    RAISE NOTICE 'DispositionEntry.baustelleId bereits vorhanden';
  END IF;
END $$;

-- ============================================================
-- 11. baustelleId zu MachineUsage
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'MachineUsage' AND column_name = 'baustelleId') THEN
    ALTER TABLE "MachineUsage" ADD COLUMN "baustelleId" TEXT;
    ALTER TABLE "MachineUsage" ADD CONSTRAINT "MachineUsage_baustelleId_fkey"
      FOREIGN KEY ("baustelleId") REFERENCES "Baustelle"("id") ON DELETE SET NULL;
    RAISE NOTICE 'baustelleId zu MachineUsage hinzugefügt';
  ELSE
    RAISE NOTICE 'MachineUsage.baustelleId bereits vorhanden';
  END IF;
END $$;

-- ============================================================
-- 12. licensePlate + driverResourceId zu Resource
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Resource' AND column_name = 'licensePlate') THEN
    ALTER TABLE "Resource" ADD COLUMN "licensePlate" TEXT;
    RAISE NOTICE 'Resource.licensePlate hinzugefügt';
  ELSE
    RAISE NOTICE 'Resource.licensePlate bereits vorhanden';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Resource' AND column_name = 'driverResourceId') THEN
    ALTER TABLE "Resource" ADD COLUMN "driverResourceId" TEXT;
    ALTER TABLE "Resource" ADD CONSTRAINT "Resource_driverResourceId_fkey"
      FOREIGN KEY ("driverResourceId") REFERENCES "Resource"("id") ON DELETE SET NULL;
    RAISE NOTICE 'Resource.driverResourceId hinzugefügt';
  ELSE
    RAISE NOTICE 'Resource.driverResourceId bereits vorhanden';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Resource' AND column_name = 'vehicleManufacturer') THEN
    ALTER TABLE "Resource" ADD COLUMN "vehicleManufacturer" TEXT;
    RAISE NOTICE 'Resource.vehicleManufacturer hinzugefügt';
  ELSE RAISE NOTICE 'Resource.vehicleManufacturer bereits vorhanden'; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Resource' AND column_name = 'vehicleModel') THEN
    ALTER TABLE "Resource" ADD COLUMN "vehicleModel" TEXT;
    RAISE NOTICE 'Resource.vehicleModel hinzugefügt';
  ELSE RAISE NOTICE 'Resource.vehicleModel bereits vorhanden'; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Resource' AND column_name = 'vehicleYear') THEN
    ALTER TABLE "Resource" ADD COLUMN "vehicleYear" INTEGER;
    RAISE NOTICE 'Resource.vehicleYear hinzugefügt';
  ELSE RAISE NOTICE 'Resource.vehicleYear bereits vorhanden'; END IF;
END $$;

SELECT 'Pre-build Migration erfolgreich' AS result;
`;

// ── Postgres wire protocol ────────────────────────────────────────────────────

function i32(n) { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; }
function cs(s)  { return Buffer.concat([Buffer.from(s, "utf8"), Buffer.from([0])]); }

function startup(user, db) {
  const p = Buffer.concat([cs("user"), cs(user), cs("database"), cs(db), cs("client_encoding"), cs("UTF8"), Buffer.from([0])]);
  return Buffer.concat([i32(8 + p.length), i32(196608), p]);
}
function query(sql) {
  const b = cs(sql);
  return Buffer.concat([Buffer.from("Q"), i32(4 + b.length), b]);
}
function xor(a, b) { return Buffer.from(a.map((v, i) => v ^ b[i])); }
function hi(pass, salt, iter) {
  let u = crypto.createHmac("sha256", pass).update(Buffer.concat([salt, Buffer.from([0,0,0,1])])).digest();
  let r = u;
  for (let i = 1; i < iter; i++) { u = crypto.createHmac("sha256", pass).update(u).digest(); r = xor(r, u); }
  return r;
}
function parseChallenge(s) {
  const o = {};
  for (const p of s.split(",")) { const eq = p.indexOf("="); if (eq > -1) o[p.slice(0,eq)] = p.slice(eq+1); }
  return o;
}

async function run() {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: HOST, port: PORT });
    let tls_sock = null, buf = Buffer.alloc(0), phase = "ssl";
    let c_nonce, c_first_bare, s_first, auth_ok = false, query_done = false;

    const send = d => (tls_sock || sock).write(d);

    const onData = socket => socket.on("data", chunk => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (phase === "ssl") {
          if (buf.length < 1) return;
          const r = buf[0]; buf = buf.slice(1);
          if (r !== 83) return reject(new Error("Server unterstützt kein SSL"));
          const ctx = tls.connect({ socket: sock, host: HOST, servername: HOST, rejectUnauthorized: false });
          ctx.on("secure", () => { tls_sock = ctx; buf = Buffer.alloc(0); phase = "auth"; onData(ctx); send(startup(USER, DATABASE)); });
          ctx.on("error", reject);
          return;
        }
        if (buf.length < 5) return;
        const mt = buf[0], ml = buf.readInt32BE(1);
        if (buf.length < 1 + ml) return;
        const pl = buf.slice(5, 1 + ml); buf = buf.slice(1 + ml);

        if (mt === 82) { // Authentication
          const at = pl.readInt32BE(0);
          if (at === 0) { auth_ok = true; }
          else if (at === 10) { // SASL
            c_nonce = crypto.randomBytes(18).toString("base64");
            c_first_bare = `n=${USER},r=${c_nonce}`;
            const fm = `n,,${c_first_bare}`;
            const b = Buffer.concat([cs("SCRAM-SHA-256"), i32(fm.length), Buffer.from(fm)]);
            send(Buffer.concat([Buffer.from("p"), i32(4 + b.length), b]));
          } else if (at === 11) { // SASL Continue
            s_first = pl.slice(4).toString("utf8");
            const { r: sn, s: sb, i: it } = parseChallenge(s_first);
            const sp = hi(Buffer.from(PASS.normalize("NFC"), "utf8"), Buffer.from(sb, "base64"), +it);
            const ck = crypto.createHmac("sha256", sp).update("Client Key").digest();
            const sk = crypto.createHash("sha256").update(ck).digest();
            const cfwp = `c=biws,r=${sn}`;
            const am = `${c_first_bare},${s_first},${cfwp}`;
            const cs2 = crypto.createHmac("sha256", sk).update(am).digest();
            const cp = xor(ck, cs2).toString("base64");
            const msg = Buffer.from(`${cfwp},p=${cp}`);
            send(Buffer.concat([Buffer.from("p"), i32(4 + msg.length), msg]));
          }
        } else if (mt === 78) { // Notice
          let off = 0;
          while (off < pl.length) {
            const f = pl[off++]; if (f === 0) break;
            const end = pl.indexOf(0, off); if (end === -1) break;
            if (f === 77 /* M */) console.log(" NOTICE:", pl.slice(off, end).toString("utf8"));
            off = end + 1;
          }
        } else if (mt === 90) { // ReadyForQuery
          if (phase === "auth") { phase = "query"; send(query(SQL)); }
          else if (phase === "query") {
            console.log("Migration abgeschlossen."); send(Buffer.concat([Buffer.from("X"), i32(4)])); resolve();
          }
        } else if (mt === 68) { // DataRow
          const nc = pl.readInt16BE(0); let off = 2; const cols = [];
          for (let i = 0; i < nc; i++) { const len = pl.readInt32BE(off); off += 4; if (len < 0) { cols.push("null"); continue; } cols.push(pl.slice(off, off + len).toString("utf8")); off += len; }
          console.log("→", cols.join(" | "));
        } else if (mt === 69) { // Error
          let off = 0, msg = "";
          while (off < pl.length) {
            const f = pl[off++]; if (f === 0) break;
            const end = pl.indexOf(0, off); if (end === -1) break;
            if (f === 77) msg = pl.slice(off, end).toString("utf8");
            off = end + 1;
          }
          return reject(new Error(`DB Fehler: ${msg}`));
        }
      }
    });

    sock.on("connect", () => { send(Buffer.concat([i32(8), i32(80877103)])); onData(sock); });
    sock.on("error", reject);
  });
}

run().then(() => { console.log("✓ Pre-build Migration OK"); process.exit(0); })
     .catch(e => { console.error("✗ Migration fehlgeschlagen:", e.message); process.exit(1); });
