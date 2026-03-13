/**
 * Entfernt ASSIGNED aus OrderStatus Enum und konvertiert bestehende Einträge zu ACTIVE
 * node migrate-order-status.mjs
 */
import net from "net";
import tls from "tls";
import crypto from "crypto";

const DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:Felix_2020!!!@db.hysevwhwtbiebpuepyme.supabase.co:5432/postgres";

const url = new URL(DB_URL);
const HOST = url.hostname;
const PORT = parseInt(url.port) || 5432;
const USER = decodeURIComponent(url.username);
const PASS = decodeURIComponent(url.password);
const DATABASE = url.pathname.replace(/^\//, "");

const MIGRATION_SQL = `
-- 1. Spalte zu TEXT konvertieren damit UPDATE möglich ist
ALTER TABLE "Order" ALTER COLUMN "status" TYPE TEXT;

-- 2. ASSIGNED -> ACTIVE migrieren
UPDATE "Order" SET "status" = 'ACTIVE' WHERE "status" = 'ASSIGNED';

-- 3. Alten Enum droppen (CASCADE für abhängige Defaults)
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
DROP TYPE IF EXISTS "OrderStatus" CASCADE;

-- 4. Neuen Enum ohne ASSIGNED erstellen
CREATE TYPE "OrderStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

-- 5. Spalte zurück auf Enum-Typ setzen
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::"OrderStatus";

-- 6. Default wiederherstellen
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PLANNED'::"OrderStatus";

SELECT 'OrderStatus Migration erfolgreich' AS status;
`;

// ── Postgres wire protocol (SCRAM-SHA-256) ────────────────────────────────────

function int32BE(n) { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; }
function int16BE(n) { const b = Buffer.alloc(2); b.writeInt16BE(n); return b; }
function cstring(s) { return Buffer.concat([Buffer.from(s, "utf8"), Buffer.from([0])]); }

function makeStartup(user, database) {
  const params = Buffer.concat([cstring("user"), cstring(user), cstring("database"), cstring(database), cstring("client_encoding"), cstring("UTF8"), Buffer.from([0])]);
  return Buffer.concat([int32BE(4 + 4 + params.length), int32BE(196608), params]);
}

function makeQuery(sql) {
  const body = cstring(sql);
  return Buffer.concat([Buffer.from("Q"), int32BE(4 + body.length), body]);
}

function xorBufs(a, b) { return Buffer.from(a.map((v, i) => v ^ b[i])); }
function hi(password, salt, iterations) {
  let u = crypto.createHmac("sha256", password).update(Buffer.concat([salt, Buffer.from([0,0,0,1])])).digest();
  let result = u;
  for (let i = 1; i < iterations; i++) { u = crypto.createHmac("sha256", password).update(u).digest(); result = xorBufs(result, u); }
  return result;
}
function parseChallenge(data) {
  const parts = {};
  for (const p of data.toString("utf8").split(",")) { const eq = p.indexOf("="); if (eq !== -1) parts[p.slice(0,eq)] = p.slice(eq+1); }
  return parts;
}

async function run() {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: HOST, port: PORT });
    let tlsSock = null, buf = Buffer.alloc(0), phase = "ssl";
    let clientNonce, clientFirstBare, serverFirst, authDone = false;

    function send(d) { (tlsSock || sock).write(d); }

    function process_data(socket) {
      socket.on("data", chunk => {
        buf = Buffer.concat([buf, chunk]);
        outer: while (true) {
          if (phase === "ssl") {
            if (buf.length < 1) break;
            const r = buf[0]; buf = buf.slice(1);
            if (r === 83) {
              const ctx = tls.connect({ socket: sock, host: HOST, servername: HOST, rejectUnauthorized: false });
              ctx.on("secure", () => { tlsSock = ctx; buf = Buffer.alloc(0); phase = "startup"; process_data(tlsSock); send(makeStartup(USER, DATABASE)); });
              ctx.on("error", reject);
            } else reject(new Error("SSL not supported"));
            break;
          }
          if (buf.length < 5) break;
          const mt = buf[0], ml = buf.readInt32BE(1);
          if (buf.length < 1 + ml) break;
          const pl = buf.slice(5, 1 + ml); buf = buf.slice(1 + ml);

          if (mt === 82) { // Auth
            const at = pl.readInt32BE(0);
            if (at === 0) { authDone = true; }
            else if (at === 10) {
              clientNonce = crypto.randomBytes(18).toString("base64");
              clientFirstBare = `n=${USER},r=${clientNonce}`;
              const msg = `n,,${clientFirstBare}`;
              const body = Buffer.concat([cstring("SCRAM-SHA-256"), int32BE(msg.length), Buffer.from(msg)]);
              send(Buffer.concat([Buffer.from("p"), int32BE(4 + body.length), body]));
            } else if (at === 11) {
              serverFirst = pl.slice(4).toString("utf8");
              const { r: sn, s: sb64, i: it } = parseChallenge(serverFirst);
              const salt = Buffer.from(sb64, "base64");
              const sp = hi(Buffer.from(PASS.normalize("NFC"), "utf8"), salt, parseInt(it));
              const ck = crypto.createHmac("sha256", sp).update("Client Key").digest();
              const sk = crypto.createHash("sha256").update(ck).digest();
              const cfwp = `c=biws,r=${sn}`;
              const am = `${clientFirstBare},${serverFirst},${cfwp}`;
              const cs = crypto.createHmac("sha256", sk).update(am).digest();
              const cp = xorBufs(ck, cs).toString("base64");
              const fm = Buffer.from(`${cfwp},p=${cp}`);
              send(Buffer.concat([Buffer.from("p"), int32BE(4 + fm.length), fm]));
            }
          } else if (mt === 90) { // ReadyForQuery
            if (!authDone) authDone = true;
            if (phase === "startup") { phase = "query"; send(makeQuery(MIGRATION_SQL)); }
            else if (phase === "query") { console.log("Migration abgeschlossen."); send(Buffer.concat([Buffer.from("X"), int32BE(4)])); resolve(); }
          } else if (mt === 68) { // DataRow
            const nc = pl.readInt16BE(0); let off = 2; const cols = [];
            for (let i = 0; i < nc; i++) { const len = pl.readInt32BE(off); off += 4; if (len === -1) { cols.push(null); continue; } cols.push(pl.slice(off, off + len).toString("utf8")); off += len; }
            console.log("→", cols.join(" | "));
          } else if (mt === 69) { // Error
            let off = 0, msg = "";
            while (off < pl.length) { const f = String.fromCharCode(pl[off++]); const end = pl.indexOf(0, off); if (end === -1) break; const v = pl.slice(off, end).toString("utf8"); off = end + 1; if (f === "M") msg = v; }
            reject(new Error(`DB: ${msg}`));
          }
        }
      });
      socket.on("error", reject);
    }

    sock.on("connect", () => { sock.write(Buffer.concat([int32BE(8), int32BE(80877103)])); process_data(sock); });
    sock.on("error", reject);
  });
}

run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
