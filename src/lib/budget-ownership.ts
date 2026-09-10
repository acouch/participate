/**
 * Whether the current visitor may edit a budget.
 *
 * Unowned budgets stay open to anyone with the link, which keeps the
 * anonymous /start flow and every budget made before accounts existed
 * working. Once a budget has an owner, only that owner — or an admin — may
 * change it.
 */
export function canEditBudget({
  currentUserId,
  ownerId,
  isAdmin = false,
}: {
  /** The signed-in user's id, or null when signed out. */
  currentUserId: string | null;
  /** The budget's owner, or null when unowned. */
  ownerId: string | null;
  /** Admins may edit and delete any budget. */
  isAdmin?: boolean;
}): boolean {
  if (isAdmin) return true;
  if (ownerId === null) return true;
  return currentUserId === ownerId;
}

/** The slice of Prisma's budget delegate this module needs. */
export interface BudgetClaimStore {
  updateMany(args: {
    where: { id: string; userId: null };
    data: { userId: string };
  }): Promise<{ count: number }>;
}

/**
 * Links an unowned budget to the signed-in user — the budget someone was
 * editing anonymously before signing up from the save-progress prompt.
 *
 * Returns true when this call did the claiming.
 *
 * Two rules the implementation depends on:
 *  - `userId: null` in the where clause means an already-owned budget can
 *    never change hands, however it is visited.
 *  - `updateMany` matches zero rows instead of throwing when a concurrent
 *    request claimed the budget first (a plain `update` raises P2025 there).
 */
export async function claimBudgetForUser(
  budgets: BudgetClaimStore,
  {
    budgetId,
    currentUserId,
    ownerId,
  }: {
    budgetId: string;
    /** The signed-in user's id, or null when signed out. */
    currentUserId: string | null;
    /** The budget's current owner, or null when unowned. */
    ownerId: string | null;
  },
): Promise<boolean> {
  if (!currentUserId || ownerId !== null) return false;

  const { count } = await budgets.updateMany({
    where: { id: budgetId, userId: null },
    data: { userId: currentUserId },
  });
  return count > 0;
}
