"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma/client";

/** Shape stored in Budget.data for the editor. */
export interface BudgetData {
  allocations: Record<string, number>;
}

/**
 * Persists the edited department allocations for a budget, then revalidates
 * the page so the chart reflects the change.
 */
export async function saveAllocations(
  uuid: string,
  allocations: Record<string, number>,
): Promise<void> {
  const data: BudgetData = { allocations };
  await prisma.budget.update({
    where: { id: uuid },
    data: { data: data as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(`/budget/${uuid}`);
}
