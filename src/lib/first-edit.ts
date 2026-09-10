/**
 * Whether saving these allocations is the first meaningful edit to a budget —
 * the moment it stops being an abandoned /start shell and becomes real work.
 *
 * Visiting /start creates an empty budget, and most are never touched again,
 * so creation is far too noisy to notify on. Moving money is the signal.
 */
export function isFirstMeaningfulEdit({
  allocations,
  alreadyNotified,
}: {
  allocations: Record<string, number>;
  /** True once admins have been notified for this budget. */
  alreadyNotified: boolean;
}): boolean {
  if (alreadyNotified) return false;
  return Object.keys(allocations).length > 0;
}
