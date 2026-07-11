import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma/client";
import { shortId } from "@/src/lib/id";
import { getBudget } from "@/src/lib/budget";

// Visiting /start creates a new saved Budget with a 5-character id and
// redirects to /budget/{id}.
export async function GET() {
  // Seed the new budget with the current category dataset.
  const data = await getBudget("category");

  let id = "";
  // Retry on the rare 5-char id collision (unique primary key violation).
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const budget = await prisma.budget.create({
        data: {
          id: shortId(),
          data: data as unknown as Prisma.InputJsonValue,
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

  redirect(`/budget/${id}`);
}
