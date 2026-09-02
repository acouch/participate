"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import {
  sankey,
  sankeyLinkHorizontal,
  type SankeyGraph,
  type SankeyNode,
} from "d3-sankey";
import { ordinalColorScale } from "@/src/lib/colors";
import type { FundFlows, FlowNode, FlowLink } from "@/src/lib/budget";

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// d3-sankey mutates the node/link objects it's given (adding x0/y0/… and
// resolving source/target to node refs), so these are our data plus its layout.
type SNode = SankeyNode<FlowNode, FlowLink>;

const NEUTRAL = "#9ca3af"; // "Other" nodes (no category)

interface FundSankeyProps {
  flows: FundFlows;
  height?: number;
}

export default function FundSankey({ flows, height = 900 }: FundSankeyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Stable color per fund (left) and per category (right departments).
  const fundColor = useMemo(
    () =>
      ordinalColorScale(
        flows.nodes.filter((n) => n.kind === "fund").map((n) => n.id),
      ),
    [flows],
  );
  const categoryColor = useMemo(() => {
    const cats = Array.from(
      new Set(
        flows.nodes.filter((n) => n.category).map((n) => n.category as string),
      ),
    );
    return ordinalColorScale(cats);
  }, [flows]);

  const colorForNode = (n: FlowNode) =>
    n.kind === "fund"
      ? fundColor(n.id)
      : n.category
        ? categoryColor(n.category)
        : NEUTRAL;

  // Run the sankey layout whenever size or data changes. We clone the input so
  // d3's in-place mutation never touches the props object.
  const graph = useMemo<SankeyGraph<FlowNode, FlowLink> | null>(() => {
    if (width === 0) return null;
    const layout = sankey<FlowNode, FlowLink>()
      .nodeId((d) => d.id)
      .nodeWidth(16)
      .nodePadding(10)
      .nodeSort(null) // preserve our value-sorted input order
      .extent([
        [1, 8],
        [width - 1, height - 8],
      ]);
    return layout({
      nodes: flows.nodes.map((d) => ({ ...d })),
      links: flows.links.map((d) => ({ ...d })),
    });
  }, [flows, width, height]);

  const linkPath = sankeyLinkHorizontal<FlowNode, FlowLink>();

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {graph && width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Fund to department budget flows"
        >
          {/* Links */}
          <g fill="none">
            {graph.links.map((link, i) => {
              const target = link.target as SNode;
              const stroke =
                target.kind === "department" ? colorForNode(target) : NEUTRAL;
              const source = link.source as SNode;
              return (
                <path
                  key={i}
                  d={linkPath(link) ?? undefined}
                  stroke={stroke}
                  strokeOpacity={0.4}
                  strokeWidth={Math.max(1, link.width ?? 0)}
                  onMouseMove={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    setHover({
                      text: `${source.name} → ${target.name}: ${dollars.format(link.value)}`,
                      x: e.clientX - (rect?.left ?? 0),
                      y: e.clientY - (rect?.top ?? 0),
                    });
                  }}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {graph.nodes.map((node) => {
              const n = node as SNode;
              const x0 = n.x0 ?? 0;
              const y0 = n.y0 ?? 0;
              const x1 = n.x1 ?? 0;
              const y1 = n.y1 ?? 0;
              const isFund = n.kind === "fund";
              const labelLeft = !isFund; // funds label to the right, depts to the left
              return (
                <g key={n.id}>
                  <rect
                    x={x0}
                    y={y0}
                    width={x1 - x0}
                    height={Math.max(1, y1 - y0)}
                    fill={colorForNode(n)}
                    onMouseMove={(e) => {
                      const rect =
                        containerRef.current?.getBoundingClientRect();
                      setHover({
                        text: `${n.name}: ${dollars.format(n.value ?? 0)}`,
                        x: e.clientX - (rect?.left ?? 0),
                        y: e.clientY - (rect?.top ?? 0),
                      });
                    }}
                    onMouseLeave={() => setHover(null)}
                  >
                    <title>
                      {n.name}: {dollars.format(n.value ?? 0)}
                    </title>
                  </rect>
                  <text
                    x={labelLeft ? x0 - 6 : x1 + 6}
                    y={(y0 + y1) / 2}
                    dy="0.35em"
                    textAnchor={labelLeft ? "end" : "start"}
                    fontSize={11}
                    fontWeight={isFund ? 600 : 400}
                    fill="#333"
                    style={{ pointerEvents: "none" }}
                  >
                    {n.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {hover && (
        <div
          style={{
            position: "absolute",
            left: hover.x + 12,
            top: hover.y + 12,
            background: "rgba(17,17,17,0.92)",
            color: "#fff",
            padding: "0.35rem 0.55rem",
            borderRadius: "0.375rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {hover.text}
        </div>
      )}
    </div>
  );
}
