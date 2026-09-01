import { notFound, redirect } from "next/navigation";
import BudgetReview from "@/src/components/BudgetReview";
import { prisma } from "@/src/lib/prisma";
import {
  getEditableFund,
  BASELINE_RAISE,
  FISCAL_YEAR,
} from "@/src/lib/budget";
import { type BudgetData } from "./actions";

export const metadata = {
  title: "Proposed budget",
};

interface BudgetPageProps {
  params: Promise<{ uuid: string }>;
  searchParams: Promise<{ submitted?: string }>;
}

export default async function BudgetPage({
  params,
  searchParams,
}: BudgetPageProps) {
  const [{ uuid }, { submitted }] = await Promise.all([params, searchParams]);
  // Set only by the redirect right after submitting — see BudgetReview.submit.
  const justSubmitted = submitted === "1";

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

  // The bare URL is the final, submitted view. If not yet submitted, send the
  // user back to the editor.
  if (!data?.submittedAt) redirect(`/budget/${uuid}/edit`);

  const allocations = data.allocations ?? {};
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
        readOnly
        justSubmitted={justSubmitted}
        uuid={uuid}
        fiscalYear={FISCAL_YEAR}
        totalToSpend={fund.totalToSpend}
        name={data.name ?? ""}
        tagline={data.tagline ?? ""}
        additionalInfo={data.additionalInfo ?? ""}
        submittedAt={data.submittedAt}
        lineItems={lineItems}
        outcomes={budget.outcomes}
      />
    </main>
  );
}
