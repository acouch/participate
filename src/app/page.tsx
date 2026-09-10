import Image from "next/image";
import budgetviz from "@/src/assets/budgetvisual.jpg";
import Link from "next/link";

export const metadata = {
  title: "Make your own Philly Budget",
};

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 pt-20 pb-10 sm:px-6 lg:px-8 lg:pt-5">
      <div className="md:flex">
        <div className="flex-1 md:w-1/2">
          <h1 className="py-2 text-3xl">Make your budget for Philly</h1>
          <p className="py-5">
            This is your chance to make a realistic budget for the city.
          </p>
          <Link
            className="group inline-flex items-center justify-center rounded-full bg-blue-800 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-600 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 active:bg-blue-900 active:text-blue-100"
            href="/start"
          >
            <span>Get started</span>
          </Link>
        </div>
        <div className="flex-1 sm:py-12 md:py-0">
          <h2
            className="py-2 text-3xl"
            style={{ paddingBottom: "1rem", paddingTop: "0.5rem" }}
          >
            View this year&apos;s budget
          </h2>
          <Link href="/current">
            <Image
              loading="eager"
              src={budgetviz}
              width={0}
              height={0}
              sizes="100vw"
              className="h-auto w-full grayscale filter transition duration-300 ease-in-out hover:grayscale-0"
              alt="Budget visual"
            />
          </Link>
        </div>
      </div>
    </main>
  );
}
