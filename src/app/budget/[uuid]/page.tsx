import { notFound } from "next/navigation";
import BudgetEditor from "@/src/components/BudgetEditor";
import { prisma } from "@/src/lib/prisma";
import { getEditableFund, BASELINE_RAISE } from "@/src/lib/budget";
import {
  saveAllocations,
  addOutcome,
  deleteOutcome,
  type BudgetData,
} from "./actions";

export const metadata = {
  title: "Make your own budget",
};

interface BudgetPageProps {
  params: Promise<{ uuid: string }>;
}

export default async function BudgetPage({ params }: BudgetPageProps) {
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

  // Saved edits, if any (a fresh budget has no allocations yet).
  const saved = (budget.data as unknown as BudgetData | null)?.allocations ?? {};

  return (
    <main className="lg:px-8 max-w-7xl mx-auto px-4 sm:px-6">
      <BudgetEditor
        uuid={uuid}
        totalToSpend={fund.totalToSpend}
        departments={fund.departments}
        savedAllocations={saved}
        baselineRaise={BASELINE_RAISE}
        initialOutcomes={budget.outcomes}
        onSave={saveAllocations}
        onAddOutcome={addOutcome}
        onDeleteOutcome={deleteOutcome}
      />
    </main>
  );
}
