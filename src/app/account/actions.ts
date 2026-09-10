"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/src/lib/prisma";
import { getCurrentUser } from "@/src/lib/session";
import { isAdmin } from "@/src/lib/admin";

/**
 * Deletes a budget the signed-in user owns — or any budget, for an admin.
 *
 * The userId in the where clause is the authorization check for ordinary
 * users: budget ids are short and shareable, so a request for someone else's
 * id must delete nothing rather than trust the caller.
 */
export async function deleteBudget(
  budgetId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  // Admins may act on any budget; everyone else only on their own.
  const scope = isAdmin(user.email)
    ? { id: budgetId }
    : { id: budgetId, userId: user.id };
  const owned = await prisma.budget.findFirst({
    where: scope,
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "That budget could not be found." };

  // Outcomes reference the budget, so they go first.
  await prisma.$transaction([
    prisma.outcome.deleteMany({ where: { budgetId } }),
    prisma.budget.deleteMany({ where: scope }),
  ]);

  revalidatePath("/account");
  return { ok: true };
}

/** Renames a budget the signed-in user owns — or any budget, for an admin. */
export async function renameBudget(
  budgetId: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give your budget a name." };

  const scope = isAdmin(user.email)
    ? { id: budgetId }
    : { id: budgetId, userId: user.id };
  const budget = await prisma.budget.findFirst({
    where: scope,
    select: { data: true },
  });
  if (!budget) return { ok: false, error: "That budget could not be found." };

  // Preserve every other field in the JSON blob.
  const data = { ...((budget.data as object) ?? {}), name: trimmed };
  await prisma.budget.updateMany({ where: scope, data: { data } });

  revalidatePath("/account");
  revalidatePath(`/budget/${budgetId}`);
  revalidatePath(`/budget/${budgetId}/edit`);
  return { ok: true };
}
