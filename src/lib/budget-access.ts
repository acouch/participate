import { prisma } from "@/src/lib/prisma";
import { getCurrentUser } from "@/src/lib/session";
import { canEditBudget } from "@/src/lib/budget-ownership";
import { isAdmin as isAdminEmail } from "@/src/lib/admin";

/**
 * Resolves whether the current visitor may edit a budget, reading both the
 * session and the budget's owner. Returns exists:false for a missing budget.
 */
export async function getBudgetAccess(budgetId: string): Promise<{
  exists: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  ownerId: string | null;
  currentUserId: string | null;
}> {
  const [user, budget] = await Promise.all([
    getCurrentUser(),
    prisma.budget.findUnique({
      where: { id: budgetId },
      select: { userId: true },
    }),
  ]);

  const currentUserId = user?.id ?? null;
  const admin = isAdminEmail(user?.email);
  if (!budget) {
    return {
      exists: false,
      canEdit: false,
      isAdmin: admin,
      ownerId: null,
      currentUserId,
    };
  }
  return {
    exists: true,
    canEdit: canEditBudget({
      currentUserId,
      ownerId: budget.userId,
      isAdmin: admin,
    }),
    isAdmin: admin,
    ownerId: budget.userId,
    currentUserId,
  };
}

/**
 * Throws unless the current visitor may edit the budget. Every mutating
 * server action calls this first: server actions are POST endpoints that
 * accept a budget id from the caller, so the page-level check is not a
 * security boundary on its own.
 */
export async function assertCanEditBudget(budgetId: string): Promise<void> {
  const { exists, canEdit } = await getBudgetAccess(budgetId);
  if (!exists) throw new Error("Budget not found.");
  if (!canEdit) {
    throw new Error("This budget belongs to someone else.");
  }
}
