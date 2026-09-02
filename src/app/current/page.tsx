import { Suspense } from "react";
import BudgetTreemap from "@/src/components/BudgetTreemap";
import { getBudget, getFundFlows, FISCAL_YEAR } from "@/src/lib/budget";

export const metadata = {
  title: "Budget Treemap",
};

export default async function TreemapPage() {
  const [category, fund, flows] = await Promise.all([
    getBudget("category"),
    getBudget("fund"),
    getFundFlows(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 md:text-center lg:px-8">
      <div className="hero">
        <p className="eyebrow">City of Philadelphia</p>
        <h1>Budget by category and fund</h1>
        <p className="lede">
          City budget for FY {FISCAL_YEAR}, sized by expenses. To learn more
          about the budget process, visit the{" "}
          <a className="text-[#1a3cb9] underline" href="">
            People&apos;s Budget Office
          </a>
          .
        </p>
      </div>
      <Suspense fallback={null}>
        <BudgetTreemap category={category} fund={fund} flows={flows} />
      </Suspense>
    </main>
  );
}
