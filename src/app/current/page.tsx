import { Suspense } from "react";
import BudgetTreemap from "@/src/components/BudgetTreemap";
import { getBudget, FISCAL_YEAR } from "@/src/lib/budget";

export const metadata = {
  title: "Budget Treemap",
};

export default async function TreemapPage() {
  const [category, fund] = await Promise.all([
    getBudget("category"),
    getBudget("fund"),
  ]);

  return (
    <main className="lg:px-8 max-w-7xl md:text-center mx-auto px-4 sm:px-6">
      <div className="hero">
        <p className="eyebrow">City of Philadelphia</p>
        <h1>Budget by category and fund</h1>
        <p className="lede">
          City budget for FY {FISCAL_YEAR}, sized by expenses. To learn more about the budget process, visit the <a className="text-[#1a3cb9] underline" href="">People's Budget Office</a>.
        </p>
      </div>
      <Suspense fallback={null}>
        <BudgetTreemap category={category} fund={fund} />
      </Suspense>
    </main>
  );
}
