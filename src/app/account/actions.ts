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

/**
 * Deletes several budgets at once. Same authorization as deleteBudget: an
 * admin may remove any budget, everyone else only their own. Ids the caller
 * is not allowed to touch are skipped rather than failing the whole batch,
 * and the count reports what actually went.
 */
export async function deleteBudgets(
  budgetIds: string[],
): Promise<{ ok: boolean; deleted: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, deleted: 0, error: "You need to be signed in." };
  }
  if (budgetIds.length === 0) return { ok: true, deleted: 0 };

  // Resolve which of the requested ids this caller may actually delete.
  const scope = isAdmin(user.email)
    ? { id: { in: budgetIds } }
    : { id: { in: budgetIds }, userId: user.id };
  const allowed = await prisma.budget.findMany({
    where: scope,
    select: { id: true },
  });
  const ids = allowed.map((b) => b.id);
  if (ids.length === 0) {
    return { ok: false, deleted: 0, error: "No matching budgets to delete." };
  }

  await prisma.$transaction([
    prisma.outcome.deleteMany({ where: { budgetId: { in: ids } } }),
    prisma.budget.deleteMany({ where: { id: { in: ids } } }),
  ]);

  revalidatePath("/account");
  revalidatePath("/admin");
  return { ok: true, deleted: ids.length };
}

/**
 * Features or unfeatures a budget for /featured-budgets. Admin-only: this is
 * editorial curation, not something a budget's own author may set.
 */
export async function setBudgetFeatured(
  budgetId: string,
  featured: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!isAdmin(user?.email)) {
    return { ok: false, error: "Only admins can feature budgets." };
  }

  const updated = await prisma.budget.updateMany({
    where: { id: budgetId },
    data: { featuredAt: featured ? new Date() : null },
  });
  if (updated.count === 0) {
    return { ok: false, error: "That budget could not be found." };
  }

  revalidatePath("/admin");
  revalidatePath("/featured-budgets");
  return { ok: true };
}
