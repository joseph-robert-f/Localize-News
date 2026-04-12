"use client";

import { useEffect, useState, useCallback } from "react";
import * as topojson from "topojson-client";
import { geoMercator, geoPath } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { GeoPermissibleObjects } from "d3-geo";

// State abbreviation → 2-digit FIPS prefix
export const STATE_FIPS: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
  DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17",
  IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24",
  MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31",
  NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
  OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46",
  TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54",
  WI: "55", WY: "56",
};

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

function fillColor(count: number): string {
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
  /** county name (no "County" suffix) → count of indexed municipalities */
  coverageByCounty: Record<string, number>;
  /** county name → list of municipality names */
  municipalsByCounty: Record<string, string[]>;
};

export function StateCountyMap({ stateAbbr, coverageByCounty, municipalsByCounty }: Props) {
  const [paths, setPaths] = useState<CountyPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

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
            // Case-insensitive lookup against our data
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

  const coveredCounties = paths.filter((p) => p.count > 0).length;

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
            {paths.map((p) => (
              <path
                key={p.id}
                d={p.d ?? ""}
                fill={hovered === p.id ? hoverFill(p.count) : fillColor(p.count)}
                stroke="#fafaf8"
                strokeWidth={0.8}
                style={{ cursor: p.count > 0 ? "pointer" : "default", transition: "fill 0.1s" }}
                onMouseEnter={(e) => handleMouseEnter(p, e)}
                onMouseLeave={handleMouseLeave}
              />
            ))}
          </svg>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500">
        <span className="font-medium text-stone-600 dark:text-stone-400">
          {coveredCounties} of {paths.length} counties covered
        </span>
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

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 max-w-[220px] rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg dark:border-stone-700 dark:bg-stone-900"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
            {tooltip.name} County
          </p>
          <p className="text-xs text-stone-500 mt-0.5">
            {tooltip.count === 0
              ? "No coverage yet"
              : `${tooltip.count} municipalit${tooltip.count === 1 ? "y" : "ies"}`}
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
