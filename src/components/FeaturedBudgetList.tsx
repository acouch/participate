import Link from "next/link";
import { prisma } from "@/src/lib/prisma";
import { summarizeBudget } from "@/src/lib/account-budgets";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** A featured budget with its outcome count, for display. */
export interface FeaturedBudget {
  id: string;
  name: string;
  tagline: string;
  changeCount: number;
  outcomeCount: number;
  submittedAt: string | null;
}

/**
 * Reads the admin-curated featured budgets, newest pick first.
 * `limit` caps the list for the home page teaser.
 */
export async function getFeaturedBudgets(
  limit?: number,
): Promise<FeaturedBudget[]> {
  const rows = await prisma.budget.findMany({
    where: { featuredAt: { not: null } },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      data: true,
      featuredAt: true,
      _count: { select: { outcomes: true } },
    },
    orderBy: { featuredAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  return rows.map((row) => {
    const summary = summarizeBudget(row);
    return {
      id: summary.id,
      name: summary.name,
      tagline: summary.tagline,
      changeCount: summary.changeCount,
      outcomeCount: row._count.outcomes,
      submittedAt: summary.submittedAt,
    };
  });
}

/** One featured budget, rendered as a linked card. */
export function FeaturedBudgetCard({ budget }: { budget: FeaturedBudget }) {
  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-5">
      <Link
        href={`/budget/${budget.id}`}
        className="text-xl font-bold text-blue-800 hover:underline"
      >
        {budget.name}
      </Link>
      {budget.tagline && (
        <p className="mt-1 text-base text-neutral-600 italic">
          {budget.tagline}
        </p>
      )}
      <p className="mt-3 text-sm text-neutral-500">
        {budget.changeCount} department{budget.changeCount === 1 ? "" : "s"}{" "}
        changed
        {budget.outcomeCount > 0 &&
          ` · ${budget.outcomeCount} outcome${budget.outcomeCount === 1 ? "" : "s"}`}
        {budget.submittedAt &&
          ` · Submitted ${dateFmt.format(new Date(budget.submittedAt))}`}
      </p>
    </li>
  );
}

/** A list of featured budget cards. */
export default function FeaturedBudgetList({
  budgets,
}: {
  budgets: FeaturedBudget[];
}) {
  return (
    <ul className="grid list-none gap-4">
      {budgets.map((budget) => (
        <FeaturedBudgetCard key={budget.id} budget={budget} />
      ))}
    </ul>
  );
}
