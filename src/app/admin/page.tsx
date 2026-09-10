import { notFound } from "next/navigation";
import AdminBudgets from "@/src/components/admin/AdminBudgets";
import { prisma } from "@/src/lib/prisma";
import { getCurrentUser } from "@/src/lib/session";
import { isAdmin } from "@/src/lib/admin";
import { sortBudgets, summarizeBudget } from "@/src/lib/account-budgets";
import {
  deleteBudget,
  deleteBudgets,
  renameBudget,
  setBudgetFeatured,
} from "@/src/app/account/actions";

export const metadata = {
  title: "All budgets",
};

export default async function AdminPage() {
  const user = await getCurrentUser();
  // 404 rather than a redirect: a non-admin should not learn this page exists.
  if (!isAdmin(user?.email)) notFound();

  const rows = await prisma.budget.findMany({
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      data: true,
      featuredAt: true,
      user: { select: { email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const budgets = sortBudgets(rows.map(summarizeBudget)).map((summary) => ({
    ...summary,
    ownerEmail: rows.find((r) => r.id === summary.id)?.user?.email ?? null,
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="hero" style={{ marginBottom: "2rem" }}>
        <h1>All budgets</h1>
        <p className="lede" style={{ fontSize: "1rem" }}>
          {budgets.length} budget{budgets.length === 1 ? "" : "s"} across every
          account. You can edit or delete any of them.
        </p>
      </div>

      <AdminBudgets
        budgets={budgets}
        onRename={renameBudget}
        onDelete={deleteBudget}
        onDeleteMany={deleteBudgets}
        onSetFeatured={setBudgetFeatured}
      />
    </main>
  );
}
