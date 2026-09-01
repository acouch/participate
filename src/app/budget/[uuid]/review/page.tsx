import { notFound, redirect } from "next/navigation";
import BudgetReview from "@/src/components/BudgetReview";
import { prisma } from "@/src/lib/prisma";
import {
  getEditableFund,
  BASELINE_RAISE,
  FISCAL_YEAR,
} from "@/src/lib/budget";
import {
  saveIntro,
  submitBudget,
  addOutcome,
  deleteOutcome,
  type BudgetData,
} from "../actions";

export const metadata = {
  title: "Review your budget",
};

interface ReviewPageProps {
  params: Promise<{ uuid: string }>;
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { uuid } = await params;

  const [budget, fund] = await Promise.all([
    prisma.budget.findUnique({
      where: { id: uuid },
      include: {
        outcomes: {
          select: { id: true, department: true, description: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    getEditableFund(),
  ]);
  if (!budget) notFound();

  const data = budget.data as unknown as BudgetData | null;

  // Once submitted, the budget is locked — the review page is no longer
  // available; send to the final view.
  if (data?.submittedAt) redirect(`/budget/${uuid}`);

  const allocations = data?.allocations ?? {};

  // Department line items: current allocation (or baseline) + change vs 2026.
  const lineItems = fund.departments.map((d) => {
    const baselineAmount = Math.round(d.priorAmount * (1 + BASELINE_RAISE));
    const amount = allocations[d.name] ?? baselineAmount;
    return {
      name: d.name,
      category: d.category,
      priorAmount: d.priorAmount,
      baselineAmount,
      amount,
      percentChange:
        d.priorAmount > 0
          ? ((amount - d.priorAmount) / d.priorAmount) * 100
          : null,
    };
  });

  return (
    <main className="lg:px-8 max-w-7xl mx-auto px-4 sm:px-6">
      <BudgetReview
        uuid={uuid}
        fiscalYear={FISCAL_YEAR}
        totalToSpend={fund.totalToSpend}
        name={data?.name ?? ""}
        tagline={data?.tagline ?? ""}
        additionalInfo={data?.additionalInfo ?? ""}
        submittedAt={data?.submittedAt ?? null}
        lineItems={lineItems}
        outcomes={budget.outcomes}
        onSaveIntro={saveIntro}
        onSubmit={submitBudget}
        onAddOutcome={addOutcome}
        onDeleteOutcome={deleteOutcome}
      />
    </main>
  );
}
