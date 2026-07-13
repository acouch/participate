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

/** A saved outcome for a department in a budget. */
export interface OutcomeItem {
  id: string;
  department: string;
  description: string;
}

/** Adds an outcome (a described result of a funding change) for a department. */
export async function addOutcome(
  uuid: string,
  department: string,
  description: string,
): Promise<OutcomeItem | null> {
  const text = description.trim();
  if (!text) return null;
  const outcome = await prisma.outcome.create({
    data: { budgetId: uuid, department, description: text },
    select: { id: true, department: true, description: true },
  });
  revalidatePath(`/budget/${uuid}`);
  return outcome;
}

/** Removes an outcome by id. */
export async function deleteOutcome(
  uuid: string,
  outcomeId: string,
): Promise<void> {
  await prisma.outcome.delete({ where: { id: outcomeId } });
  revalidatePath(`/budget/${uuid}`);
}
