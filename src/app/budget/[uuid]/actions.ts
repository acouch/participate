"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { Prisma } from "@/src/generated/prisma/client";
import { assertCanEditBudget } from "@/src/lib/budget-access";
import { notifyBudgetStarted, notifyBudgetSubmitted } from "@/src/lib/email";
import { isFirstMeaningfulEdit } from "@/src/lib/first-edit";

/** Shape stored in Budget.data for the editor. */
export interface BudgetData {
  allocations: Record<string, number>;
  /** The user's mayoral / project name (set on the welcome step). */
  name?: string;
  /** What the budget delivers — the user's tagline / vision. */
  tagline?: string;
  /** Free-text context the user adds on the review page. */
  additionalInfo?: string;
  /** ISO timestamp when the budget was submitted; unset while a draft. */
  submittedAt?: string;
  /**
   * Set once admins have been told this budget is real work, so the
   * notification fires on the first meaningful edit and never again.
   */
  notifiedAt?: string;
}

/** Reads the current Budget.data, tolerating a missing/legacy record. */
async function readData(uuid: string): Promise<BudgetData> {
  const budget = await prisma.budget.findUnique({ where: { id: uuid } });
  const data = (budget?.data as unknown as BudgetData | null) ?? {
    allocations: {},
  };
  return {
    allocations: data.allocations ?? {},
    name: data.name,
    tagline: data.tagline,
    additionalInfo: data.additionalInfo,
    submittedAt: data.submittedAt,
    notifiedAt: data.notifiedAt,
  };
}

/**
 * Persists the edited department allocations for a budget, preserving the
 * saved name, then revalidates the page so the chart reflects the change.
 */
export async function saveAllocations(
  uuid: string,
  allocations: Record<string, number>,
): Promise<void> {
  await assertCanEditBudget(uuid);
  const current = await readData(uuid);
  const data: BudgetData = { ...current, allocations };

  // Moving money is the first sign a budget is real work rather than an
  // abandoned /start. Stamp the flag in the same write so concurrent saves
  // cannot both decide they were first.
  const firstMeaningfulEdit = isFirstMeaningfulEdit({
    allocations,
    alreadyNotified: Boolean(current.notifiedAt),
  });
  if (firstMeaningfulEdit) data.notifiedAt = new Date().toISOString();

  await prisma.budget.update({
    where: { id: uuid },
    data: { data: data as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(`/budget/${uuid}`);

  if (firstMeaningfulEdit) {
    await notifyBudgetStarted({
      budgetId: uuid,
      name: data.name,
      changeCount: Object.keys(allocations).length,
    });
  }
}

/**
 * Saves the intro / review text fields, preserving any allocations and
 * unspecified fields. Editing after submission reverts the budget to a draft.
 */
export async function saveIntro(
  uuid: string,
  fields: { name?: string; tagline?: string; additionalInfo?: string },
): Promise<void> {
  await assertCanEditBudget(uuid);
  const current = await readData(uuid);
  const data: BudgetData = { ...current };
  if (fields.name !== undefined) data.name = fields.name.trim();
  if (fields.tagline !== undefined) data.tagline = fields.tagline.trim();
  if (fields.additionalInfo !== undefined) {
    data.additionalInfo = fields.additionalInfo.trim();
  }
  await prisma.budget.update({
    where: { id: uuid },
    data: { data: data as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(`/budget/${uuid}`);
  revalidatePath(`/budget/${uuid}/review`);
}

/** Marks the budget as submitted (finalized). */
export async function submitBudget(
  uuid: string,
  submittedAtIso: string,
): Promise<void> {
  await assertCanEditBudget(uuid);
  const current = await readData(uuid);
  const data: BudgetData = { ...current, submittedAt: submittedAtIso };
  await prisma.budget.update({
    where: { id: uuid },
    data: { data: data as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(`/budget/${uuid}`);
  revalidatePath(`/budget/${uuid}/review`);

  await notifyBudgetSubmitted({
    budgetId: uuid,
    name: data.name,
    tagline: data.tagline,
    changeCount: Object.keys(data.allocations ?? {}).length,
  });
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
  await assertCanEditBudget(uuid);
  const text = description.trim();
  if (!text) return null;
  const outcome = await prisma.outcome.create({
    data: { budgetId: uuid, department, description: text },
    select: { id: true, department: true, description: true },
  });
  revalidatePath(`/budget/${uuid}`);
  revalidatePath(`/budget/${uuid}/review`);
  return outcome;
}

/** Removes an outcome by id. */
export async function deleteOutcome(
  uuid: string,
  outcomeId: string,
): Promise<void> {
  await assertCanEditBudget(uuid);
  // Scoped to the budget just authorized: deleting by outcome id alone would
  // let a caller pass their own budget's id with someone else's outcome.
  await prisma.outcome.deleteMany({ where: { id: outcomeId, budgetId: uuid } });
  revalidatePath(`/budget/${uuid}`);
  revalidatePath(`/budget/${uuid}/review`);
}
