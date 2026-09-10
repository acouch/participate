"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { getCurrentUser } from "@/src/lib/session";

/**
 * Deletes one of the signed-in user's own budgets.
 *
 * The userId in the where clause is the authorization check: budget ids are
 * short and shareable, so a request for someone else's id must delete nothing
 * rather than trust the caller.
 */
export async function deleteBudget(
  budgetId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const owned = await prisma.budget.findFirst({
    where: { id: budgetId, userId: user.id },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "That budget could not be found." };

  // Outcomes reference the budget, so they go first.
  await prisma.$transaction([
    prisma.outcome.deleteMany({ where: { budgetId } }),
    prisma.budget.deleteMany({ where: { id: budgetId, userId: user.id } }),
  ]);

  revalidatePath("/account");
  return { ok: true };
}

/** Renames one of the signed-in user's own budgets. */
export async function renameBudget(
  budgetId: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give your budget a name." };

  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, userId: user.id },
    select: { data: true },
  });
  if (!budget) return { ok: false, error: "That budget could not be found." };

  // Preserve every other field in the JSON blob.
  const data = { ...((budget.data as object) ?? {}), name: trimmed };
  await prisma.budget.updateMany({
    where: { id: budgetId, userId: user.id },
    data: { data },
  });

  revalidatePath("/account");
  revalidatePath(`/budget/${budgetId}`);
  revalidatePath(`/budget/${budgetId}/edit`);
  return { ok: true };
}
