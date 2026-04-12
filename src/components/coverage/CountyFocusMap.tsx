"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as topojson from "topojson-client";
import { geoMercator, geoPath } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { GeoPermissibleObjects } from "d3-geo";
import { STATE_FIPS } from "@/lib/constants/states";
import { formatCategory } from "@/lib/utils";

const MAP_W = 800;
const MAP_H = 480;

type MunicipalDot = {
  id: string;
  name: string;
  category: string | null;
  latitude: number;
  longitude: number;
  docCount: number;
  href: string;
};

type TooltipData = {
  name: string;
  category: string | null;
  docCount: number;
  x: number;
  y: number;
};

function dotColor(count: number): string {
  if (count === 0) return "#a8a29e"; // stone-400
  if (count < 10) return "#fbbf24"; // amber-400
  if (count < 50) return "#d97706"; // amber-600
  if (count < 200) return "#b45309"; // amber-700
  return "#78350f"; // amber-900
}

function dotRadius(count: number): number {
  if (count === 0) return 5;
  if (count < 10) return 6;
  if (count < 50) return 8;
  if (count < 200) return 10;
  return 12;
}

type Props = {
  stateAbbr: string;
  countyName: string;
  municipalities: MunicipalDot[];
};

export function CountyFocusMap({ stateAbbr, countyName, municipalities }: Props) {
  const router = useRouter();
  const [countyPath, setCountyPath] = useState<string | null>(null);
  const [dots, setDots] = useState<Array<MunicipalDot & { cx: number; cy: number }>>([]);
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

        // Find the specific county feature
        const countyFeature = counties.features.find((f) => {
          const id = String(f.id ?? "").padStart(5, "0");
          if (!id.startsWith(fips)) return false;
          const name: string = (f.properties as Record<string, string>)?.name ?? "";
          return name.toLowerCase() === countyName.toLowerCase();
        });

        if (!countyFeature) { setLoading(false); return; }

        // Fit the projection tightly around this single county
        const projection = geoMercator().fitSize(
          [MAP_W, MAP_H],
          { type: "FeatureCollection", features: [countyFeature] }
        );
        const pathGen = geoPath().projection(projection);

        setCountyPath(pathGen(countyFeature as GeoPermissibleObjects));

        // Project municipality lat/lng to SVG coordinates
        const projected = municipalities
          .filter((m) => m.latitude != null && m.longitude != null)
          .map((m) => {
            const point = projection([m.longitude, m.latitude]);
            return point ? { ...m, cx: point[0], cy: point[1] } : null;
          })
          .filter((m): m is MunicipalDot & { cx: number; cy: number } => m !== null);

        setDots(projected);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [stateAbbr, countyName, municipalities]);

  const handleMouseEnter = useCallback(
    (dot: MunicipalDot & { cx: number; cy: number }, e: React.MouseEvent) => {
      setHovered(dot.id);
      setTooltip({ name: dot.name, category: dot.category, docCount: dot.docCount, x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
    setTooltip(null);
  }, []);

  const handleClick = useCallback((dot: MunicipalDot) => {
    router.push(dot.href);
  }, [router]);

  const municipalitiesWithCoords = municipalities.filter((m) => m.latitude != null).length;

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-sm text-stone-400">
            Loading map…
          </div>
        ) : !countyPath ? (
          <div className="flex h-64 items-center justify-center text-sm text-stone-400">
            Map data unavailable for this county.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            style={{ width: "100%", height: "auto" }}
            onMouseMove={handleMouseMove}
          >
            {/* County boundary */}
            <path
              d={countyPath}
              fill="#fef3c7"
              stroke="#d97706"
              strokeWidth={1.5}
            />

            {/* Municipality dots */}
            {dots.map((dot) => {
              const r = dotRadius(dot.docCount);
              const isHovered = hovered === dot.id;
              return (
                <g
                  key={dot.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleClick(dot)}
                  onMouseEnter={(e) => handleMouseEnter(dot, e)}
                  onMouseLeave={handleMouseLeave}
                >
                  <circle
                    cx={dot.cx}
                    cy={dot.cy}
                    r={isHovered ? r + 2 : r}
                    fill={dotColor(dot.docCount)}
                    stroke="white"
                    strokeWidth={1.5}
                    style={{ transition: "r 0.1s" }}
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Legend */}
      {!loading && countyPath && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500">
          <span className="font-medium text-stone-600 dark:text-stone-400">
            {municipalitiesWithCoords} of {municipalities.length} municipalities mapped
          </span>
          <span className="text-stone-400">· click a dot to view</span>
          {[
            { color: dotColor(0),   label: "No docs" },
            { color: dotColor(5),   label: "1–9 docs" },
            { color: dotColor(25),  label: "10–49 docs" },
            { color: dotColor(100), label: "50–199 docs" },
            { color: dotColor(999), label: "200+ docs" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full border border-stone-200"
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
          className="pointer-events-none fixed z-50 max-w-[200px] rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg dark:border-stone-700 dark:bg-stone-900"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
            {tooltip.name}
          </p>
          {tooltip.category && (
            <p className="text-xs text-stone-500 mt-0.5">{formatCategory(tooltip.category)}</p>
          )}
          <p className="text-xs text-stone-500 mt-0.5">
            {tooltip.docCount === 0
              ? "No documents indexed"
              : `${tooltip.docCount.toLocaleString()} document${tooltip.docCount === 1 ? "" : "s"}`}
          </p>
          <p className="text-xs text-amber-700 mt-1">Click to view →</p>
        </div>
      )}
    </div>
  );
}
