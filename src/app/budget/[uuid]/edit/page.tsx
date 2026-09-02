import { notFound, redirect } from "next/navigation";
import BudgetEditor from "@/src/components/BudgetEditor";
import { prisma } from "@/src/lib/prisma";
import { getEditableFund, BASELINE_RAISE } from "@/src/lib/budget";
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

  // Once submitted, the budget is locked — send to the final view.
  if (data?.submittedAt) redirect(`/budget/${uuid}`);

  const saved = data?.allocations ?? {};
  const savedName = data?.name ?? "";
  const savedTagline = data?.tagline ?? "";

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <BudgetEditor
        uuid={uuid}
        totalToSpend={fund.totalToSpend}
        departments={fund.departments}
        savedAllocations={saved}
        savedName={savedName}
        savedTagline={savedTagline}
        baselineRaise={BASELINE_RAISE}
        initialOutcomes={budget.outcomes}
        onSave={saveAllocations}
        onSaveIntro={saveIntro}
        onAddOutcome={addOutcome}
        onDeleteOutcome={deleteOutcome}
      />
    </main>
  );
}
