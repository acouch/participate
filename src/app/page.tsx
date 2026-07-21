
import { getBudget } from "@/src/lib/budget";
import Image from "next/image";
import budgetviz from '@/src/assets/budgetvisual.jpg';
import Link from "next/link";

export const metadata = {
  title: "Budget Treemap",
};

export default async function Home() {
  const [category, fund] = await Promise.all([
    getBudget("category"),
    getBudget("fund"),
  ]);

  return (
    <main className="lg:pt-8 lg:px-8 max-w-7xl mx-auto pb-10 pt-20 px-4 sm:px-6">
        <div className="md:flex">
          <div className="flex-1 md:w-1/2">
            <h1>Make your budget for Philly</h1>
            <p className="py-5">This is your chance to make a realistic budget for the city.</p>
            <Link className="text-center group inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 bg-blue-800 text-white hover:text-slate-100 hover:bg-blue-600 active:bg-blue-900 active:text-blue-100 focus-visible:outline-blue-800" href="/start"><span>Get started</span></Link>
          </div>
          <div className="flex-1 sm:py-12 md:py-0">
            <h2 className="text-3xl py-2">View this year's budget</h2>
            <Link href="/current"><Image loading="eager" src={budgetviz} width={0} height={0} sizes="100vw" className="w-full h-auto filter grayscale hover:grayscale-0 transition duration-300 ease-in-out" alt="Budget visual"/></Link>
          </div>
        </div>
    </main>
  );
}
