import { Suspense } from "react";
import { notFound } from "next/navigation";
import BudgetTreemap from "@/src/components/BudgetTreemap";
import type { TreemapDatum } from "@/src/components/Treemap";
import { prisma } from "@/src/lib/prisma";
import { getBudget, FISCAL_YEAR } from "@/src/lib/budget";

export const metadata = {
  title: "Budget",
};

interface BudgetPageProps {
  params: Promise<{ uuid: string }>;
}

export default async function BudgetPage({ params }: BudgetPageProps) {
  const { uuid } = await params;

  const budget = await prisma.budget.findUnique({ where: { id: uuid } });
  if (!budget) notFound();

  // The saved category data lives on the record; the fund grouping is loaded
  // from the source dataset so the "By fund" tab keeps working.
  const category = budget.data as unknown as TreemapDatum[];
  const fund = await getBudget("fund");

  return (
    <main className="lg:px-8 max-w-7xl md:text-center mx-auto px-4 sm:px-6">
      <div className="hero">
        <p className="eyebrow">City of Philadelphia</p>
        <h1>Budget by category and fund</h1>
        <p className="lede">
          City budget for FY {FISCAL_YEAR}, sized by expenses. Switch between
          grouping by category or by fund, and click a tile to drill down.
        </p>
      </div>
      <Suspense fallback={null}>
        <BudgetTreemap category={category} fund={fund} />
      </Suspense>
    </main>
  );
}
