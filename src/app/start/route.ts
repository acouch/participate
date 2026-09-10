import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma/client";
import { shortId } from "@/src/lib/id";
import { getCurrentUser } from "@/src/lib/session";
import type { BudgetData } from "@/src/app/budget/[uuid]/actions";

// Visiting /start creates a new (empty) Budget with a 5-character id and
// redirects to the editor at /budget/{id}/edit. Signing in is not required;
// budgets made while signed in are linked to that user.
export async function GET() {
  const data: BudgetData = { allocations: {} };
  const user = await getCurrentUser();

  let id = "";
  // Retry on the rare 5-char id collision (unique primary key violation).
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const budget = await prisma.budget.create({
        data: {
          id: shortId(),
          data: data as unknown as Prisma.InputJsonValue,
          userId: user?.id ?? null,
        },
      });
      id = budget.id;
      break;
    } catch (err) {
      // P2002 = unique constraint failed; try a fresh id.
      const code = (err as { code?: string }).code;
      if (code === "P2002" && attempt < 4) continue;
      throw err;
    }
  }

  redirect(`/budget/${id}/edit`);
}
