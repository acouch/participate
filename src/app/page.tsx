
import { getBudget, FISCAL_YEAR } from "@/src/lib/budget";

export const metadata = {
  title: "Budget Treemap",
};

export default async function Home() {
  const [category, fund] = await Promise.all([
    getBudget("category"),
    getBudget("fund"),
  ]);

  return (
    <main className="lg:px-8 max-w-7x mx-auto px-4 sm:px-6">
      <div className="lg:pt-8 lg:px-8 max-w-7xl mx-auto pb-10 pt-20 px-4 sm:px-6">
        <h1>Make your budget for Philly</h1>
        <p className="py-5">This website allows you to create your own budget for the city.</p>
      <a className="text-center group inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 bg-blue-800 text-white hover:text-slate-100 hover:bg-blue-600 active:bg-blue-900 active:text-blue-100 focus-visible:outline-blue-800" href="/start"><span>Start</span></a>
      </div>
    </main>
  );
}
