// One-time script: setzt alle PENDING Orders und Baustellen auf PLANNED
// Ausführen mit: node --env-file=.env.local scripts/fix-pending-status.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [orders, baustellen] = await Promise.all([
    prisma.order.updateMany({ where: { status: "PENDING" }, data: { status: "PLANNED" } }),
    prisma.baustelle.updateMany({ where: { status: "PENDING" }, data: { status: "PLANNED" } }),
  ]);

  console.log(`✓ Orders:     ${orders.count} auf PLANNED gesetzt`);
  console.log(`✓ Baustellen: ${baustellen.count} auf PLANNED gesetzt`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
