"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { STATE_ABBR } from "@/lib/constants/states";

type TooltipData = {
  stateName: string;
  stateAbbr: string;
  count: number;
  names: string[];
  x: number;
  y: number;
};

type Props = {
  coverageByState: Record<string, number>;
  townshipsByState: Record<string, string[]>;
};

function fillColor(count: number): string {
  if (count === 0) return "#e7e5e4";   // stone-200 — no coverage
  if (count <= 2)  return "#fef3c7";   // amber-100
  if (count <= 5)  return "#fde68a";   // amber-200
  if (count <= 10) return "#fbbf24";   // amber-400
  if (count <= 20) return "#d97706";   // amber-600
  return "#92400e";                     // amber-800
}

function hoverFill(count: number): string {
  if (count === 0) return "#d6d3d1";   // stone-300
  if (count <= 2)  return "#fde68a";
  if (count <= 5)  return "#fbbf24";
  if (count <= 10) return "#d97706";
  if (count <= 20) return "#92400e";
  return "#78350f";                     // amber-900
}

export function CoverageMap({ coverageByState, townshipsByState }: Props) {
  const router = useRouter();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const handleClick = useCallback((geo: { properties: { name: string } }) => {
    const stateAbbr = STATE_ABBR[geo.properties.name];
    if (stateAbbr) router.push(`/coverage/${stateAbbr.toLowerCase()}`);
  }, [router]);

  const handleMouseEnter = useCallback(
    (geo: { properties: { name: string } }, event: React.MouseEvent) => {
      const stateName = geo.properties.name;
      const stateAbbr = STATE_ABBR[stateName] ?? "";
      const count = coverageByState[stateAbbr] ?? 0;
      const names = townshipsByState[stateAbbr] ?? [];
      setTooltip({
        stateName,
        stateAbbr,
        count,
        names,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [coverageByState, townshipsByState]
  );

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    setTooltip((prev) => prev ? { ...prev, x: event.clientX, y: event.clientY } : null);
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const coveredCount = Object.values(coverageByState).filter((n) => n > 0).length;

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <ComposableMap
          projection="geoAlbersUsa"
          style={{ width: "100%", height: "auto" }}
          viewBox="0 0 960 600"
        >
          <Geographies geography="/us-states-10m.json">
            {({ geographies }) =>
              geographies.map((geo) => {
                const abbr = STATE_ABBR[geo.properties.name] ?? "";
                const count = coverageByState[abbr] ?? 0;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fillColor(count)}
                    stroke="#fafaf8"
                    strokeWidth={0.75}
                    style={{
                      default: { outline: "none", cursor: "pointer" },
                      hover:   { outline: "none", fill: hoverFill(count), cursor: "pointer" },
                      pressed: { outline: "none" },
                    }}
                    onClick={() => handleClick(geo)}
                    onMouseEnter={(e) => handleMouseEnter(geo, e)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500">
        <span className="font-medium text-stone-600 dark:text-stone-400">
          {coveredCount} state{coveredCount !== 1 ? "s" : ""} covered
        </span>
        <span className="text-stone-400">· click a state to explore</span>
        {[
          { color: "#e7e5e4", label: "None" },
          { color: "#fef3c7", label: "1–2" },
          { color: "#fde68a", label: "3–5" },
          { color: "#fbbf24", label: "6–10" },
          { color: "#d97706", label: "11–20" },
          { color: "#92400e", label: "21+" },
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

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 max-w-[200px] rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg dark:border-stone-700 dark:bg-stone-900"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
            {tooltip.stateName}
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            {tooltip.count === 0
              ? "No coverage yet"
              : `${tooltip.count} municipalit${tooltip.count === 1 ? "y" : "ies"}`}
          </p>
          {tooltip.names.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {tooltip.names.slice(0, 5).map((name) => (
                <li key={name} className="text-xs text-stone-600 dark:text-stone-400 truncate">
                  {name}
                </li>
              ))}
              {tooltip.names.length > 5 && (
                <li className="text-xs text-stone-400">
                  +{tooltip.names.length - 5} more
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
