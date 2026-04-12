"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as topojson from "topojson-client";
import { geoMercator, geoPath } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { GeoPermissibleObjects } from "d3-geo";
import { STATE_FIPS } from "@/lib/constants/states";
import { countySlug, countyLabel } from "@/lib/utils";

const MAP_W = 800;
const MAP_H = 500;

type CountyPath = {
  id: string;
  name: string;
  d: string | null;
  count: number;
};

type TooltipData = {
  name: string;
  count: number;
  municipalities: string[];
  x: number;
  y: number;
};

function fillColor(count: number, dimmed = false): string {
  if (dimmed) return "#f5f5f4"; // stone-100 — context counties on county page
  if (count === 0) return "#e7e5e4";
  if (count === 1) return "#fef3c7";
  if (count <= 3) return "#fde68a";
  if (count <= 6) return "#fbbf24";
  if (count <= 12) return "#d97706";
  return "#92400e";
}

function hoverFill(count: number): string {
  if (count === 0) return "#d6d3d1";
  if (count === 1) return "#fde68a";
  if (count <= 3) return "#fbbf24";
  if (count <= 6) return "#d97706";
  if (count <= 12) return "#92400e";
  return "#78350f";
}

type Props = {
  stateAbbr: string;
  /** county name → count of indexed municipalities */
  coverageByCounty: Record<string, number>;
  /** county name → list of municipality names */
  municipalsByCounty: Record<string, string[]>;
  /**
   * When set, this county is highlighted with a distinct border.
   * All other counties are shown in a muted context colour.
   * Used on the county detail page to show location within the state.
   */
  highlightedCounty?: string;
  /** When true, clicking a county navigates to its coverage page. Default true. */
  navigable?: boolean;
};

export function StateCountyMap({
  stateAbbr,
  coverageByCounty,
  municipalsByCounty,
  highlightedCounty,
  navigable = true,
}: Props) {
  const router = useRouter();
  const [paths, setPaths] = useState<CountyPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const cl = countyLabel(stateAbbr);
  // Normalised name of the highlighted county for comparison
  const highlightedNorm = highlightedCounty?.toLowerCase();

  useEffect(() => {
    const fips = STATE_FIPS[stateAbbr];
    if (!fips) { setLoading(false); return; }

    fetch("/us-counties-10m.json")
      .then((r) => r.json())
      .then((topology: Topology) => {
        const counties = topojson.feature(
          topology,
          (topology.objects as Record<string, GeometryCollection>).counties
        );

        const stateCounties = counties.features.filter((f) => {
          const id = String(f.id ?? "").padStart(5, "0");
          return id.startsWith(fips);
        });

        if (stateCounties.length === 0) { setLoading(false); return; }

        const projection = geoMercator().fitSize(
          [MAP_W, MAP_H],
          { type: "FeatureCollection", features: stateCounties }
        );
        const pathGen = geoPath().projection(projection);

        setPaths(
          stateCounties.map((f) => {
            const name: string = (f.properties as Record<string, string>)?.name ?? "Unknown";
            const normalizedName = name.toLowerCase();
            const matchedCount = Object.entries(coverageByCounty).find(
              ([k]) => k.toLowerCase() === normalizedName
            )?.[1] ?? 0;

            return {
              id: String(f.id ?? name),
              name,
              d: pathGen(f as GeoPermissibleObjects),
              count: matchedCount,
            };
          })
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [stateAbbr, coverageByCounty]);

  const handleMouseEnter = useCallback(
    (path: CountyPath, e: React.MouseEvent) => {
      setHovered(path.id);
      const normalizedName = path.name.toLowerCase();
      const municipalities = Object.entries(municipalsByCounty).find(
        ([k]) => k.toLowerCase() === normalizedName
      )?.[1] ?? [];
      setTooltip({ name: path.name, count: path.count, municipalities, x: e.clientX, y: e.clientY });
    },
    [municipalsByCounty]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
    setTooltip(null);
  }, []);

  const handleClick = useCallback((path: CountyPath) => {
    if (!navigable) return;
    router.push(`/coverage/${stateAbbr.toLowerCase()}/${countySlug(path.name)}`);
  }, [navigable, router, stateAbbr]);

  const coveredCounties = paths.filter((p) => p.count > 0).length;
  const isContextMode = !!highlightedCounty;

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-sm text-stone-400">
            Loading map…
          </div>
        ) : paths.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-stone-400">
            Map data unavailable for this state.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            style={{ width: "100%", height: "auto" }}
            onMouseMove={handleMouseMove}
          >
            {paths.map((p) => {
              const isHighlighted = highlightedNorm
                ? p.name.toLowerCase() === highlightedNorm
                : false;
              const isDimmed = isContextMode && !isHighlighted;

              return (
                <path
                  key={p.id}
                  d={p.d ?? ""}
                  fill={
                    isHighlighted
                      ? (p.count > 0 ? hoverFill(p.count) : "#d6d3d1")
                      : hovered === p.id
                      ? hoverFill(p.count)
                      : fillColor(p.count, isDimmed)
                  }
                  stroke={isHighlighted ? "#78350f" : "#fafaf8"}
                  strokeWidth={isHighlighted ? 2 : 0.8}
                  style={{
                    cursor: navigable ? "pointer" : "default",
                    transition: "fill 0.1s",
                  }}
                  onClick={() => handleClick(p)}
                  onMouseEnter={(e) => handleMouseEnter(p, e)}
                  onMouseLeave={handleMouseLeave}
                />
              );
            })}
          </svg>
        )}
      </div>

      {/* Legend — hidden in context (highlight) mode */}
      {!isContextMode && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500">
          <span className="font-medium text-stone-600 dark:text-stone-400">
            {coveredCounties} of {paths.length} {cl.toLowerCase()}s covered
          </span>
          <span className="text-stone-400">· click a {cl.toLowerCase()} to explore</span>
          {[
            { color: "#e7e5e4", label: "None" },
            { color: "#fef3c7", label: "1" },
            { color: "#fde68a", label: "2–3" },
            { color: "#fbbf24", label: "4–6" },
            { color: "#d97706", label: "7–12" },
            { color: "#92400e", label: "13+" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-sm border border-stone-200"
                style={{ background: color }}
              />
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 max-w-[220px] rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg dark:border-stone-700 dark:bg-stone-900"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
            {tooltip.name} {cl}
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            {tooltip.count === 0
              ? `No coverage yet${navigable ? " — click to explore" : ""}`
              : `${tooltip.count} municipalit${tooltip.count === 1 ? "y" : "ies"}${navigable ? " — click to explore" : ""}`}
          </p>
          {tooltip.municipalities.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {tooltip.municipalities.slice(0, 6).map((name) => (
                <li key={name} className="text-xs text-stone-600 dark:text-stone-400 truncate">
                  {name}
                </li>
              ))}
              {tooltip.municipalities.length > 6 && (
                <li className="text-xs text-stone-400">
                  +{tooltip.municipalities.length - 6} more
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
