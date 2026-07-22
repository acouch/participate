"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  hierarchy,
  treemap,
  treemapSquarify,
  type HierarchyRectangularNode,
} from "d3-hierarchy";
import { scaleLinear } from "d3-scale";
import { format } from "d3-format";
import { hcl } from "d3-color";
import { ordinalColorScale } from "@/src/lib/colors";

export interface TreemapDatum {
  name: string;
  value: number;
  /** Percent change from the prior year; null when unknown. */
  percentChange?: number | null;
  /** People's Budget category this node belongs to (for cross-view coloring). */
  category?: string;
  /** Sub-categories, shown when this tile is clicked (drill-down). */
  children?: TreemapDatum[];
}

type ColorMode = "category" | "change";

// Diverging scale: red (decrease) → pale yellow (no change) → green (increase),
// clamped to ±20%.
const changeColorScale = scaleLinear<string>()
  .domain([-20, 0, 20])
  .range(["rgb(230,20,20)", "rgb(255,255,230)", "rgb(20,230,20)"])
  .clamp(true);

const NO_CHANGE_COLOR = "rgb(200,200,200)"; // unknown percent change

/** Picks black or white text for legibility against any CSS color fill. */
function readableTextColor(fill: string): string {
  const c = hcl(fill);
  // HCL lightness (0–100) tracks perceived brightness well enough here.
  return Number.isFinite(c.l) && c.l > 65 ? "#1a1a1a" : "#fff";
}

/**
 * Returns a shade of `base` for child `i` of `count`, varying lightness in HCL
 * space while keeping the hue. Used so a drilled-in box's children read as
 * tints of the parent's color.
 */
function shadeOf(base: string, i: number, count: number): string {
  const c = hcl(base);
  if (!Number.isFinite(c.l)) return base;
  // Spread lightness around the base across a readable band.
  const t = count <= 1 ? 0.5 : i / (count - 1);
  const l = 78 - t * 48; // light (78) → dark (30)
  return hcl(c.h, c.c, l).formatHex();
}

/** Desaturates a color to gray (keeps its lightness) for de-emphasis. */
function toGray(fill: string): string {
  const c = hcl(fill);
  if (!Number.isFinite(c.l)) return "#cccccc";
  return hcl(0, 0, c.l).formatHex();
}

interface TreemapProps {
  data: TreemapDatum[];
  /** Height in pixels. The width fills the container. */
  height?: number;
  /** Prefix for the formatted value, e.g. "$". */
  valuePrefix?: string;
  /**
   * Controlled drill-down path (names from the root to the current level).
   * When provided with `onPathChange`, the parent owns the path (e.g. to sync
   * it to the URL); otherwise the component manages it internally.
   */
  path?: string[];
  onPathChange?: (path: string[]) => void;
  /**
   * When set, tiles below `colorByCategoryFromDepth` are colored by their
   * People's Budget `category` (via `categoryColor`) instead of by tile name,
   * so departments share the color of their category across views.
   */
  categoryColor?: (category: string) => string;
  /** Drill depth at/after which category coloring kicks in (default off). */
  colorByCategoryFromDepth?: number;
  /**
   * Optional override for the top-level tile color scale (by name). Use when
   * the top-level tiles ARE categories (the "By category" view) so they share
   * the same colors as the shared category scale.
   */
  nameColor?: (name: string) => string;
  /**
   * Called when a category segment in the color key is clicked. The parent
   * uses this to switch to the "By category" view and drill into that category.
   */
  onKeySegmentClick?: (category: string) => void;
  /**
   * Called when a tile is clicked. Takes precedence over drilling — used by the
   * budget editor to open an edit panel for the clicked department.
   */
  onTileClick?: (datum: TreemapDatum) => void;
  /** Hides the proportional color key even when category coloring is active. */
  hideKey?: boolean;
  /** Forces the color mode and hides the mode toggle (e.g. always % change). */
  forceColorMode?: ColorMode;
  view: "fund" | "category"
  help?: ReactElement
}

// Internal hierarchy shape: a synthetic root wrapping the flat top-level data.
// Leaves are the TreemapDatum objects, so it carries their fields too.
interface TreemapRoot {
  name: string;
  children?: TreemapDatum[];
  value?: number;
  percentChange?: number | null;
  category?: string;
}

const formatValue = format(",.0f");

const PADDING = 6; // px inset for label text
const LINE_HEIGHT = 15; // px per wrapped line
const CHAR_WIDTH = 6.8; // conservative px per char at 12px sans-serif

/**
 * Greedily wraps `text` into lines that fit `maxWidth` (in px), estimating
 * width from character count. Words longer than the line are hard-broken.
 */
function wrapText(text: string, maxWidth: number): string[] {
  const maxChars = Math.max(1, Math.floor(maxWidth / CHAR_WIDTH));
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(/\s+/)) {
    // Hard-break a single word that is wider than the line.
    if (word.length > maxChars) {
      if (line) {
        lines.push(line);
        line = "";
      }
      let rest = word;
      while (rest.length > maxChars) {
        lines.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      line = rest;
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export default function Treemap({
  data,
  view,
  height = 560,
  valuePrefix = "$",
  path: controlledPath,
  onPathChange,
  categoryColor,
  colorByCategoryFromDepth,
  nameColor,
  onKeySegmentClick,
  onTileClick,
  hideKey,
  help,
  forceColorMode,
}: TreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [colorModeState, setColorMode] = useState<ColorMode>(
    forceColorMode ?? "category",
  );
  const colorMode = forceColorMode ?? colorModeState;
  // Drill-down path: names of the ancestors from the root down to the
  // currently displayed level. Empty = top level. Controlled by the parent
  // when `path`/`onPathChange` are supplied, otherwise managed internally.
  const [internalPath, setInternalPath] = useState<string[]>([]);
  const path = controlledPath ?? internalPath;
  const setPath = onPathChange ?? setInternalPath;
  // Hover tooltip: the datum under the cursor and the cursor position
  // (relative to the container), or null when nothing is hovered.
  const [hover, setHover] = useState<{
    datum: TreemapDatum;
    x: number;
    y: number;
    /** For key segments: the segment's share of the displayed total. */
    sharePct?: number;
  } | null>(null);
  // Category being hovered in the color key; tiles not in it are grayed out.
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Walk the path to find the data for the level currently displayed.
  const currentData = useMemo(() => {
    let level = data;
    for (const name of path) {
      const next = level.find((d) => d.name === name)?.children;
      if (!next) break;
      level = next;
    }
    return level;
  }, [data, path]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A single ordinal color scale seeded from every tile name across the whole
  // tree (in a stable depth-first order), so a tile keeps the same color no
  // matter which drill level it is viewed at — the palette does not restart
  // from index 0 each time the user clicks into a box. When `nameColor` is
  // supplied (top-level tiles are categories), defer to it instead.
  const color = useMemo(() => {
    if (nameColor) return nameColor;
    const names: string[] = [];
    const seen = new Set<string>();
    const walk = (nodes: TreemapDatum[]) => {
      for (const d of nodes) {
        if (!seen.has(d.name)) {
          seen.add(d.name);
          names.push(d.name);
        }
        if (d.children) walk(d.children);
      }
    };
    walk(data);
    return ordinalColorScale(names);
  }, [data, nameColor]);

  const leaves = useMemo(() => {
    // Only the current level's tiles are laid out (depth 1), so treat each
    // node's own value as its size rather than summing descendants.
    const root = hierarchy<TreemapRoot>(
      { name: "root", children: currentData },
      (d) => (d.name === "root" ? d.children : undefined),
    )
      .sum((d) => (d.name === "root" ? 0 : (d.value ?? 0)))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    treemap<TreemapRoot>()
      .tile(treemapSquarify)
      .size([width, height])
      .paddingInner(2)
      .round(true)(root);

    return root.leaves() as HierarchyRectangularNode<TreemapRoot>[];
  }, [currentData, width, height]);

  // Color tiles by their People's Budget category only at exactly the depth
  // where categories are meaningful (departments inside a fund). Drilling
  // deeper (a department's spending line-items) is not category data, so it
  // falls through to parent-shading below.
  const useCategoryColor =
    colorByCategoryFromDepth != null &&
    path.length === colorByCategoryFromDepth &&
    categoryColor != null;

  // Resolve the color of the node we drilled into (the last path segment) so
  // its children can be shaded from it — this "keeps" the palette on drill.
  // The parent's color follows the same rules it was drawn with: its category
  // color if it sits at the category-coloring depth, else its ordinal color.
  const parentColor = useMemo(() => {
    if (path.length === 0) return null;
    // Walk to the parent datum.
    let level = data;
    let parent: TreemapDatum | undefined;
    for (const name of path) {
      parent = level.find((d) => d.name === name);
      if (!parent?.children) break;
      level = parent.children;
    }
    if (!parent) return null;
    const parentDepth = path.length - 1;
    if (
      colorByCategoryFromDepth != null &&
      parentDepth === colorByCategoryFromDepth &&
      categoryColor != null &&
      parent.category
    ) {
      return categoryColor(parent.category);
    }
    return color(parent.name);
  }, [data, path, color, categoryColor, colorByCategoryFromDepth]);

  const shadeByName = useMemo(() => {
    const map = new Map<string, string>();
    if (parentColor && !useCategoryColor) {
      // currentData is sorted largest-first; shade light→dark across it.
      currentData.forEach((d, i) =>
        map.set(d.name, shadeOf(parentColor, i, currentData.length)),
      );
    }
    return map;
  }, [currentData, parentColor, useCategoryColor]);

  const fillFor = (datum: {
    name: string;
    percentChange?: number | null;
    category?: string;
  }): string => {
    if (colorMode === "change") {
      const pct = datum.percentChange;
      return pct == null ? NO_CHANGE_COLOR : changeColorScale(pct);
    }
    if (useCategoryColor && datum.category) {
      return categoryColor(datum.category);
    }
    return shadeByName.get(datum.name) ?? color(datum.name);
  };

  // Proportional color key: aggregate the current level's tiles into colored
  // groups by category, sized by each group's share of the displayed total.
  // Only shown when tiles are actually grouped by category (the "By fund" view
  // at the department level) — not in % change mode or the "By category" view.
  const keySegments = useMemo(() => {
    if (colorMode === "change" || !useCategoryColor) return [];
    const groups = new Map<
      string,
      { value: number; prior: number; fill: string }
    >();
    for (const d of currentData) {
      const label = d.category ?? d.name;
      const fill = fillFor(d);
      // Back out the prior-year value so the segment can show an aggregate
      // year-over-year change (prior = value / (1 + pct/100)).
      const prior =
        d.percentChange == null
          ? 0
          : d.value / (1 + d.percentChange / 100);
      const g = groups.get(label);
      if (g) {
        g.value += d.value;
        g.prior += prior;
      } else {
        groups.set(label, { value: d.value, prior, fill });
      }
    }
    const total = [...groups.values()].reduce((s, g) => s + g.value, 0) || 1;
    return [...groups.entries()]
      .map(([label, g]) => ({
        label,
        fill: g.fill,
        value: g.value,
        pct: (g.value / total) * 100,
        percentChange:
          g.prior > 0 ? ((g.value - g.prior) / g.prior) * 100 : null,
      }))
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentData, colorMode, useCategoryColor]);

  const buttonStyle: React.CSSProperties = {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    border: "1px solid #d4d4d4",
    borderRadius: "0.375rem",
    background: "#fff",
    color: "#333",
    cursor: "pointer",
  };

  const crumbStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    padding: 0,
    font: "inherit",
    color: "#2563eb",
    cursor: "pointer",
    textDecoration: "underline",
  };

  const formatPct = (pct: number | null | undefined) =>
    pct == null ? "n/a" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  const pctColor = (pct: number | null | undefined) =>
    pct == null ? "#bbb" : pct > 0 ? "#4ade80" : pct < 0 ? "#f87171" : "#ddd";

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
      { help && 
      <div className="rounded-md mb-4 px-2 py-2 outline-2 text-gray-400 outline-[#1a3cb914] text-left text-sm flex items-start">
        <svg className="flex-shrink-0 w-4 h-4 mr-1" aria-hidden="true" fill="#b3b3b3" xmlns="http://w3.org" viewBox="0 0 20 20">
          <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/>
        </svg>
        <div>{help}</div>
      </div>
      }
      <div
        style={{
          marginBottom: "0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          textAlign: "left",
          fontSize: "0.8rem",
        }}
      >
        <nav
          aria-label="Breadcrumb"
          style={{
            color: "#666",
            visibility: onTileClick && path.length === 0 ? "hidden" : "visible",
          }}
        >
          <button
            type="button"
            style={crumbStyle}
            onClick={() => setPath([])}
          >
            {view ==="category" ? "All categories" : "All funds" }
          </button>
          {path.map((name, i) => (
            <span key={name}>
              <span style={{ margin: "0 0.4rem", color: "#aaa" }}>›</span>
              {i === path.length - 1 ? (
                <span style={{ color: "#333", fontWeight: 600 }}>{name}</span>
              ) : (
                <button
                  type="button"
                  style={crumbStyle}
                  onClick={() => setPath(path.slice(0, i + 1))}
                >
                  {name}
                </button>
              )}
            </span>
          ))}
        </nav>
        {!forceColorMode && (
          <button
            type="button"
            onClick={() =>
              setColorMode((m) => (m === "category" ? "change" : "category"))
            }
            style={buttonStyle}
            aria-pressed={colorMode === "change"}
          >
            {colorMode === "category"
              ? "Color by % change"
              : "Color by category"}
          </button>
        )}
      </div>
      {!hideKey && width > 0 && keySegments.length > 0 && (
        <div
          aria-label="Color key"
          style={{
            display: "flex",
            width: "100%",
            height: "2.25rem",
            marginBottom: "0.75rem",
            borderRadius: "0.375rem",
            overflow: "hidden",
            border: "1px solid #e5e5e5",
            fontSize: "0.75rem",
          }}
        >
          {keySegments.map((seg) => {
            const pctText = `${seg.pct.toFixed(seg.pct < 1 ? 1 : 0)}%`;
            // Show the label only when the segment is wide enough to fit it.
            const showLabel = (seg.pct / 100) * width > 60;
            return (
              <div
                key={seg.label}
                onMouseEnter={() => setHoveredCategory(seg.label)}
                onMouseMove={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setHover({
                    datum: {
                      name: seg.label,
                      value: seg.value,
                      percentChange: seg.percentChange,
                      category: seg.label,
                    },
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    sharePct: seg.pct,
                  });
                }}
                onMouseLeave={() => {
                  setHoveredCategory(null);
                  setHover(null);
                }}
                onClick={
                  onKeySegmentClick
                    ? () => {
                        setHoveredCategory(null);
                        setHover(null);
                        onKeySegmentClick(seg.label);
                      }
                    : undefined
                }
                role={onKeySegmentClick ? "button" : undefined}
                title={
                  onKeySegmentClick
                    ? `View ${seg.label} by category`
                    : undefined
                }
                style={{
                  flexGrow: seg.pct,
                  flexBasis: 0,
                  minWidth: 0,
                  background: seg.fill,
                  color: readableTextColor(seg.fill),
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  padding: "0 0.4rem",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  cursor: onKeySegmentClick ? "pointer" : "default",
                  opacity:
                    hoveredCategory && hoveredCategory !== seg.label ? 0.4 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {showLabel && (
                  <>
                    <span
                      style={{
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {seg.label}
                    </span>
                    <span style={{ opacity: 0.85 }}>{pctText}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      {width > 0 && (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          style={{ display: "block", font: "12px sans-serif" }}
          role="img"
          aria-label="Treemap"
        >
          {leaves.map((leaf) => {
        const name = leaf.data.name;
        const w = leaf.x1 - leaf.x0;
        const h = leaf.y1 - leaf.y0;
        const baseFill = fillFor(leaf.data);
        // Gray out tiles not in the category hovered in the key.
        const dimmed =
          hoveredCategory != null && leaf.data.category !== hoveredCategory;
        const fill = dimmed ? toGray(baseFill) : baseFill;
        const textColor = readableTextColor(fill);
        const valueLabel = `${valuePrefix}${formatValue(leaf.value ?? 0)}`;
        const pct = leaf.data.percentChange;
        const pctLabel =
          pct == null ? "n/a" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

        // How many lines fit in this tile's height, accounting for padding.
        const maxLines = Math.floor((h - PADDING) / LINE_HEIGHT);
        const textWidth = w - PADDING * 2;
        const nameLines = wrapText(name, textWidth);
        // Show the value only if it fits on one line without wrapping.
        const valueFits = valueLabel.length * CHAR_WIDTH <= textWidth;
        const lines: { text: string; bold: boolean }[] = nameLines
          .map((text) => ({ text, bold: true }))
          .concat(valueFits ? [{ text: valueLabel, bold: false }] : [])
          .slice(0, Math.max(0, maxLines));

        // Hide the label if the name got truncated to a partial fragment
        // (all name lines don't fit), to avoid showing cut-off words.
        const nameFits = lines.filter((l) => l.bold).length >= nameLines.length;
        const showLabel = w >= 34 && nameFits && lines.length > 0;
        const drillable =
          !onTileClick &&
          Array.isArray(leaf.data.children) &&
          leaf.data.children.length > 0;
        const clickable = drillable || !!onTileClick;
        const titleHint = onTileClick
          ? "\n(click to edit)"
          : drillable
            ? "\n(click to drill down)"
            : "";
        const handleClick = onTileClick
          ? () => onTileClick(leaf.data as TreemapDatum)
          : drillable
            ? () => setPath([...path, name])
            : undefined;
        const handleMove = (e: React.MouseEvent) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setHover({
            datum: leaf.data as TreemapDatum,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        };
        return (
          <g
            key={name}
            transform={`translate(${leaf.x0},${leaf.y0})`}
            onClick={handleClick}
            onMouseMove={handleMove}
            onMouseLeave={() => setHover(null)}
            style={clickable ? { cursor: "pointer" } : undefined}
          >
            <title>{`${name}${titleHint}`}</title>
            <rect
              width={w}
              height={h}
              fill={fill}
              rx={2}
              opacity={dimmed ? 0.55 : 1}
              style={{ transition: "fill 0.15s, opacity 0.15s" }}
            />
            {showLabel && (
              <text x={PADDING} y={PADDING + 12} fill={textColor}>
                {lines.map((line, i) => (
                  <tspan
                    key={i}
                    x={PADDING}
                    dy={i === 0 ? 0 : LINE_HEIGHT}
                    style={
                      line.bold
                        ? { fontWeight: 600 }
                        : { fontWeight: 400, fillOpacity: 0.85 }
                    }
                  >
                    {line.text}
                  </tspan>
                ))}
              </text>
            )}
              </g>
            );
          })}
        </svg>
      )}
      {hover && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            left: hover.x + (hover.x > width * 0.75 ? -16 : 16),
            top: hover.y + 16,
            transform:
              hover.x > width * 0.75 ? "translateX(-100%)" : undefined,
            pointerEvents: "none",
            background: "rgba(17,17,17,0.92)",
            color: "#fff",
            padding: "0.875rem 1rem",
            borderRadius: "0.5rem",
            fontSize: "1rem",
            lineHeight: 1.5,
            maxWidth: "24rem",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            zIndex: 10,
            whiteSpace: "nowrap",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: "1.125rem",
              marginBottom: "0.35rem",
            }}
          >
            {hover.datum.name}
          </div>
          <div style={{ fontSize: "1.0625rem" }}>
            {valuePrefix}
            {formatValue(hover.datum.value ?? 0)}
            {hover.sharePct != null && (
              <span style={{ color: "#bbb" }}>
                {" "}
                ({hover.sharePct.toFixed(hover.sharePct < 1 ? 1 : 0)}% of total)
              </span>
            )}
          </div>
          <div
            style={{
              color: pctColor(hover.datum.percentChange),
              fontWeight: 600,
            }}
          >
            {formatPct(hover.datum.percentChange)} vs prior year
          </div>
          {/* Show the category line for tiles, but not for key segments
              (where the name already IS the category). */}
          {hover.sharePct == null &&
            useCategoryColor &&
            hover.datum.category && (
              <div
                style={{
                  marginTop: "0.35rem",
                  fontSize: "0.875rem",
                  color: "#bbb",
                }}
              >
                {hover.datum.category}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
