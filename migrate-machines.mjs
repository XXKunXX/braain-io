/**
 * Maschinen-Migration: Erstellt Machine, MachineUsage, MachineMaintenance Tabellen
 * Ausführen: node migrate-machines.mjs
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

// ── SQL ───────────────────────────────────────────────────────────────────────

const MIGRATION_SQL = `
-- MachineStatus enum
DO $$ BEGIN
  CREATE TYPE "MachineStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- MaintenanceType enum
DO $$ BEGIN
  CREATE TYPE "MaintenanceType" AS ENUM ('INSPECTION', 'REPAIR', 'SERVICE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Machine table
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

-- MachineUsage table
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
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MachineUsage_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE,
  CONSTRAINT "MachineUsage_orderId_fkey"   FOREIGN KEY ("orderId")   REFERENCES "Order"("id")   ON DELETE SET NULL
);

-- MachineMaintenance table
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
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MachineMaintenance_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE
);

SELECT 'Migration erfolgreich' AS status;
`;

// ── Postgres wire protocol ────────────────────────────────────────────────────

function int32BE(n) {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n);
  return b;
}
function int16BE(n) {
  const b = Buffer.alloc(2);
  b.writeInt16BE(n);
  return b;
}
function cstring(s) {
  return Buffer.concat([Buffer.from(s, "utf8"), Buffer.from([0])]);
}

function makeStartup(user, database) {
  const params = Buffer.concat([
    cstring("user"), cstring(user),
    cstring("database"), cstring(database),
    cstring("client_encoding"), cstring("UTF8"),
    Buffer.from([0]),
  ]);
  const len = 4 + 4 + params.length;
  return Buffer.concat([int32BE(len), int32BE(196608), params]);
}

function makeQuery(sql) {
  const body = cstring(sql);
  const len = 4 + body.length;
  return Buffer.concat([Buffer.from("Q"), int32BE(len), body]);
}

// SCRAM-SHA-256
function xorBuffers(a, b) {
  return Buffer.from(a.map((v, i) => v ^ b[i]));
}
function hi(password, salt, iterations) {
  let u = crypto.createHmac("sha256", password).update(Buffer.concat([salt, Buffer.from([0, 0, 0, 1])])).digest();
  let result = u;
  for (let i = 1; i < iterations; i++) {
    u = crypto.createHmac("sha256", password).update(u).digest();
    result = xorBuffers(result, u);
  }
  return result;
}

function parseScramChallenge(data) {
  const str = data.toString("utf8");
  const parts = {};
  for (const part of str.split(",")) {
    const eq = part.indexOf("=");
    if (eq !== -1) parts[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return parts;
}

async function run() {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: HOST, port: PORT });
    let tlsSock = null;
    let buf = Buffer.alloc(0);
    let phase = "ssl";
    let clientNonce = null;
    let clientFirstBareMsg = null;
    let serverFirstMsg = null;
    let authDone = false;

    function send(data) {
      (tlsSock || sock).write(data);
    }

    function processMessages(socket) {
      socket.on("data", (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        while (true) {
          if (phase === "ssl") {
            if (buf.length < 1) break;
            const resp = buf[0];
            buf = buf.slice(1);
            if (resp === 83) { // 'S'
              const ctx = tls.connect({ socket: sock, host: HOST, servername: HOST, rejectUnauthorized: false });
              ctx.on("secure", () => {
                tlsSock = ctx;
                buf = Buffer.alloc(0);
                phase = "startup";
                processMessages(tlsSock);
                send(makeStartup(USER, DATABASE));
              });
              ctx.on("error", reject);
            } else {
              reject(new Error("SSL not supported"));
            }
            break;
          }

          if (buf.length < 5) break;
          const msgType = buf[0];
          const msgLen = buf.readInt32BE(1);
          if (buf.length < 1 + msgLen) break;
          const payload = buf.slice(5, 1 + msgLen);
          buf = buf.slice(1 + msgLen);

          if (msgType === 82) { // 'R' = Auth
            const authType = payload.readInt32BE(0);
            if (authType === 0) {
              authDone = true;
            } else if (authType === 10) { // SASL
              // Send SASL initial
              clientNonce = crypto.randomBytes(18).toString("base64");
              clientFirstBareMsg = `n=${USER},r=${clientNonce}`;
              const clientFirstMsg = `n,,${clientFirstBareMsg}`;
              const mechanism = "SCRAM-SHA-256";
              const body = Buffer.concat([
                cstring(mechanism),
                int32BE(clientFirstMsg.length),
                Buffer.from(clientFirstMsg),
              ]);
              const msg = Buffer.concat([Buffer.from("p"), int32BE(4 + body.length), body]);
              send(msg);
            } else if (authType === 11) { // SASL Continue
              serverFirstMsg = payload.slice(4).toString("utf8");
              const { r: serverNonce, s: saltB64, i: iterStr } = parseScramChallenge(serverFirstMsg);
              const salt = Buffer.from(saltB64, "base64");
              const iterations = parseInt(iterStr);
              const normalizedPass = Buffer.from(PASS.normalize("NFC"), "utf8");
              const saltedPassword = hi(normalizedPass, salt, iterations);
              const clientKey = crypto.createHmac("sha256", saltedPassword).update("Client Key").digest();
              const storedKey = crypto.createHash("sha256").update(clientKey).digest();
              const channelBinding = "biws"; // base64("n,,")
              const clientFinalWithoutProof = `c=${channelBinding},r=${serverNonce}`;
              const authMessage = `${clientFirstBareMsg},${serverFirstMsg},${clientFinalWithoutProof}`;
              const clientSignature = crypto.createHmac("sha256", storedKey).update(authMessage).digest();
              const clientProof = xorBuffers(clientKey, clientSignature).toString("base64");
              const clientFinalMsg = `${clientFinalWithoutProof},p=${clientProof}`;
              const body2 = Buffer.from(clientFinalMsg);
              const msg2 = Buffer.concat([Buffer.from("p"), int32BE(4 + body2.length), body2]);
              send(msg2);
            } else if (authType === 12) { // SASL Final — OK
              // nothing
            }
          } else if (msgType === 75) { // 'K' BackendKeyData
          } else if (msgType === 90) { // 'Z' ReadyForQuery
            if (!authDone) { authDone = true; }
            else {
              // All done
            }
            if (phase === "startup") {
              phase = "query";
              send(makeQuery(MIGRATION_SQL));
            } else if (phase === "query") {
              console.log("Migration abgeschlossen.");
              send(Buffer.concat([Buffer.from("X"), int32BE(4)]));
              resolve();
            }
          } else if (msgType === 67) { // 'C' CommandComplete
          } else if (msgType === 84) { // 'T' RowDescription
          } else if (msgType === 68) { // 'D' DataRow
            const ncols = payload.readInt16BE(0);
            let offset = 2;
            const cols = [];
            for (let i = 0; i < ncols; i++) {
              const len = payload.readInt32BE(offset); offset += 4;
              if (len === -1) { cols.push(null); continue; }
              cols.push(payload.slice(offset, offset + len).toString("utf8")); offset += len;
            }
            console.log("→", cols.join(" | "));
          } else if (msgType === 69) { // 'E' Error
            let offset = 0;
            let errMsg = "";
            while (offset < payload.length) {
              const field = String.fromCharCode(payload[offset++]);
              const end = payload.indexOf(0, offset);
              const val = payload.slice(offset, end).toString("utf8");
              offset = end + 1;
              if (field === "M") errMsg = val;
              if (offset >= payload.length) break;
            }
            reject(new Error(`DB Error: ${errMsg}`));
          } else if (msgType === 83) { // 'S' ParameterStatus
          } else if (msgType === 78) { // 'N' Notice
          }
        }
      });
      socket.on("error", reject);
      socket.on("end", () => resolve());
    }

    sock.on("connect", () => {
      phase = "ssl";
      const sslRequest = Buffer.concat([int32BE(8), int32BE(80877103)]);
      sock.write(sslRequest);
      processMessages(sock);
    });
    sock.on("error", reject);
  });
}

run().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
