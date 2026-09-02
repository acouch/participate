import { notFound, redirect } from "next/navigation";
import BudgetReview from "@/src/components/BudgetReview";
import { prisma } from "@/src/lib/prisma";
import { buildLineItems } from "@/src/lib/budget-math";
import {
  getEditableFund,
  FISCAL_YEAR,
  PRIOR_FISCAL_YEAR,
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
  const lineItems = buildLineItems(fund.departments, allocations);

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <BudgetReview
        uuid={uuid}
        fiscalYear={FISCAL_YEAR}
        priorFiscalYear={PRIOR_FISCAL_YEAR}
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
