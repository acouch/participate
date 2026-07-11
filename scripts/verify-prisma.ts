import { prisma } from "../src/lib/prisma";

async function main() {
  const count = await prisma.budget.count();
  console.log(`✅ Connected — budget rows: ${count}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Prisma verify failed:", e);
  process.exit(1);
});
