import { redirect } from "next/navigation";
import AccountBudgets from "@/src/components/account/AccountBudgets";
import { prisma } from "@/src/lib/prisma";
import { getCurrentUser } from "@/src/lib/session";
import { sortBudgets, summarizeBudget } from "@/src/lib/account-budgets";
import { deleteBudget, renameBudget } from "./actions";

export const metadata = {
  title: "Your account",
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  // The only gated page in the app — everything else stays open.
  if (!user) redirect("/sign-in?next=%2Faccount");

  const rows = await prisma.budget.findMany({
    where: { userId: user.id },
    select: { id: true, createdAt: true, updatedAt: true, data: true },
  });
  const budgets = sortBudgets(rows.map(summarizeBudget));

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
      <div className="hero" style={{ marginBottom: "2rem" }}>
        <h1>Your account</h1>
        <p className="lede" style={{ fontSize: "1rem" }}>
          Signed in as <strong>{user.email}</strong>
        </p>
      </div>

      <AccountBudgets
        budgets={budgets}
        onRename={renameBudget}
        onDelete={deleteBudget}
      />
    </main>
  );
}
