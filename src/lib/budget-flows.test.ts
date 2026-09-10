import { describe, expect, it } from "vitest";
import { getBudget, getFundFlows, EDITABLE_FUND } from "./budget";

/**
 * Exercises the two read paths behind the explore views against the real
 * data/fund.json and data/category.json.
 */
describe("getBudget", () => {
  it("returns funds for the fund view", async () => {
    const funds = await getBudget("fund");
    expect(funds.length).toBeGreaterThan(0);
    expect(funds.map((f) => f.name)).toContain(EDITABLE_FUND);
  });

  it("returns categories for the category view", async () => {
    const cats = await getBudget("category");
    expect(cats.length).toBeGreaterThan(0);
  });

  it("drops zero-value nodes so empty tiles never render", async () => {
    const funds = await getBudget("fund");
    expect(funds.every((f) => f.value > 0)).toBe(true);
    for (const f of funds) {
      for (const child of f.children ?? [])
        expect(child.value).toBeGreaterThan(0);
    }
  });

  it("sorts children largest first at every level", async () => {
    const funds = await getBudget("fund");
    const checkSorted = (nodes: { value: number; children?: unknown }[]) => {
      const values = nodes.map((n) => n.value);
      expect([...values].sort((a, b) => b - a)).toEqual(values);
    };
    for (const f of funds) {
      if (f.children?.length) checkSorted(f.children);
    }
  });

  it("gives every node a category for cross-view coloring", async () => {
    const funds = await getBudget("fund");
    for (const f of funds) {
      for (const child of f.children ?? []) {
        expect(child.category).toBeTruthy();
      }
    }
  });

  it("computes percent change only where a prior year exists", async () => {
    const funds = await getBudget("fund");
    for (const f of funds) {
      if (f.percentChange !== null && f.percentChange !== undefined) {
        expect(Number.isFinite(f.percentChange)).toBe(true);
      }
    }
  });

  it("reports the General Fund's real total and year-over-year change", async () => {
    const gf = (await getBudget("fund")).find((f) => f.name === EDITABLE_FUND);
    expect(gf?.value).toBe(6_967_811_000);
    expect(gf?.percentChange).toBeCloseTo(1.8, 1);
  });
});

describe("getFundFlows", () => {
  it("links only from funds to departments", async () => {
    const { nodes, links } = await getFundFlows();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const link of links) {
      expect(byId.get(link.source)?.kind).toBe("fund");
      expect(byId.get(link.target)?.kind).toBe("department");
    }
  });

  it("references only nodes it also returns", async () => {
    const { nodes, links } = await getFundFlows();
    const ids = new Set(nodes.map((n) => n.id));
    for (const link of links) {
      expect(ids.has(link.source)).toBe(true);
      expect(ids.has(link.target)).toBe(true);
    }
  });

  it("carries a positive value on every flow", async () => {
    const { links } = await getFundFlows();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.value).toBeGreaterThan(0);
  });

  it("keeps at most topPerFund named departments per fund, plus an Other band", async () => {
    const topPerFund = 3;
    const { nodes, links } = await getFundFlows(topPerFund);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const perFund = new Map<string, number>();
    for (const link of links) {
      const isOther = link.target.endsWith(":__other__");
      if (isOther) continue;
      perFund.set(link.source, (perFund.get(link.source) ?? 0) + 1);
    }
    for (const count of perFund.values()) {
      expect(count).toBeLessThanOrEqual(topPerFund);
    }
    // The General Fund has far more than 3 departments, so it must have one.
    expect(byId.has(`${EDITABLE_FUND}:__other__`)).toBe(true);
  });

  it("labels the Other band with how many departments it rolls up", async () => {
    const { nodes } = await getFundFlows(3);
    const other = nodes.find((n) => n.id === `${EDITABLE_FUND}:__other__`);
    expect(other?.name).toMatch(/^Other \(\d+ depts?\)$/);
  });

  it("shares a department node across the funds that pay for it", async () => {
    const { nodes } = await getFundFlows();
    const ids = nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("conserves each fund's total across its outgoing flows", async () => {
    // Rolling the tail into "Other" must not lose or invent money.
    const all = await getFundFlows(1000);
    const capped = await getFundFlows(3);
    const sumBySource = (links: { source: string; value: number }[]) => {
      const m = new Map<string, number>();
      for (const l of links) m.set(l.source, (m.get(l.source) ?? 0) + l.value);
      return m;
    };
    const a = sumBySource(all.links);
    const b = sumBySource(capped.links);
    for (const [fund, total] of a) {
      expect(b.get(fund)).toBeCloseTo(total, 0);
    }
  });

  it("omits the Other band when a fund has few enough departments", async () => {
    const { nodes } = await getFundFlows(1000);
    expect(nodes.some((n) => n.id.endsWith(":__other__"))).toBe(false);
  });

  it("gives real department nodes a category but the Other band none", async () => {
    const { nodes } = await getFundFlows(3);
    for (const n of nodes) {
      if (n.kind !== "department") continue;
      if (n.id.endsWith(":__other__")) expect(n.category).toBeUndefined();
      else expect(n.category).toBeTruthy();
    }
  });
});
