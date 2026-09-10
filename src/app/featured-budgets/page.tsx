import Link from "next/link";
import FeaturedBudgetList, {
  getFeaturedBudgets,
} from "@/src/components/FeaturedBudgetList";

export const metadata = {
  title: "Featured budgets",
};

export default async function FeaturedBudgetsPage() {
  const budgets = await getFeaturedBudgets();

  return (
    <main className="mx-auto max-w-7xl px-4 pt-5 pb-10 sm:px-6 lg:px-8">
      <div className="hero" style={{ marginBottom: "2rem" }}>
        <h1 className="py-2 text-3xl">Featured budgets</h1>
        <p className="lede" style={{ fontSize: "1.05rem" }}>
          Budgets from Philadelphians who reimagined how the city spends its
          General Fund.
        </p>
      </div>

      {budgets.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 px-4 py-8 text-center">
          <p className="mb-4 text-neutral-600">
            No budgets have been featured yet.
          </p>
          <Link
            href="/start"
            className="inline-block rounded-lg bg-blue-800 px-5 py-2.5 font-semibold text-white"
          >
            Make your own budget
          </Link>
        </div>
      ) : (
        <FeaturedBudgetList budgets={budgets} />
      )}

      <p className="mt-8 text-center">
        <Link href="/start" className="font-semibold text-blue-800">
          Make your own budget &rarr;
        </Link>
      </p>
    </main>
  );
}
