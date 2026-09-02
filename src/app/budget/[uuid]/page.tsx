import { notFound, redirect } from "next/navigation";
import BudgetReview from "@/src/components/BudgetReview";
import { prisma } from "@/src/lib/prisma";
import { buildLineItems } from "@/src/lib/budget-math";
import {
  getEditableFund,
  FISCAL_YEAR,
  PRIOR_FISCAL_YEAR,
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
  const lineItems = buildLineItems(fund.departments, allocations);

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <BudgetReview
        readOnly
        justSubmitted={justSubmitted}
        uuid={uuid}
        fiscalYear={FISCAL_YEAR}
        priorFiscalYear={PRIOR_FISCAL_YEAR}
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
