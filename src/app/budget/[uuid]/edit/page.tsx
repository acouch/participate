import { notFound, redirect } from "next/navigation";
import BudgetEditor from "@/src/components/BudgetEditor";
import { prisma } from "@/src/lib/prisma";
import { getCurrentUser } from "@/src/lib/session";
import { claimBudgetForUser } from "@/src/lib/budget-ownership";
import {
  getEditableFund,
  FISCAL_YEAR,
  PRIOR_FISCAL_YEAR,
  BASELINE_RAISE,
} from "@/src/lib/budget";
import {
  saveAllocations,
  saveIntro,
  addOutcome,
  deleteOutcome,
  type BudgetData,
} from "../actions";

export const metadata = {
  title: "Make your own budget",
};

interface EditPageProps {
  params: Promise<{ uuid: string }>;
}

export default async function EditPage({ params }: EditPageProps) {
  const { uuid } = await params;

  const [budget, fund, user] = await Promise.all([
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
    getCurrentUser(),
  ]);
  if (!budget) notFound();

  // Someone who signs up from the save-progress prompt comes back here; adopt
  // the budget they were working on if nobody owns it yet.
  await claimBudgetForUser(prisma.budget, {
    budgetId: uuid,
    currentUserId: user?.id ?? null,
    ownerId: budget.userId,
  });

  const data = budget.data as unknown as BudgetData | null;

  // Once submitted, the budget is locked — send to the final view.
  if (data?.submittedAt) redirect(`/budget/${uuid}`);

  const saved = data?.allocations ?? {};
  const savedName = data?.name ?? "";
  const savedTagline = data?.tagline ?? "";

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <BudgetEditor
        uuid={uuid}
        signedIn={user !== null}
        totalToSpend={fund.totalToSpend}
        fiscalYear={FISCAL_YEAR}
        priorFiscalYear={PRIOR_FISCAL_YEAR}
        baselineRaise={BASELINE_RAISE}
        departments={fund.departments}
        savedAllocations={saved}
        savedName={savedName}
        savedTagline={savedTagline}
        initialOutcomes={budget.outcomes}
        onSave={saveAllocations}
        onSaveIntro={saveIntro}
        onAddOutcome={addOutcome}
        onDeleteOutcome={deleteOutcome}
      />
    </main>
  );
}
