"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface MonthData {
  month: string;
  label: string;
  count: number;
}

interface DocumentTimelineProps {
  data: MonthData[];
}

export function DocumentTimeline({ data }: DocumentTimelineProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  if (data.every((d) => d.count === 0)) {
    return (
      <p className="py-8 text-center text-sm text-zinc-400">
        No dated documents yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "currentColor" }}
          tickLine={false}
          axisLine={false}
          className="text-zinc-400"
          interval={1}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "currentColor" }}
          tickLine={false}
          axisLine={false}
          className="text-zinc-400"
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "transparent" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow dark:border-zinc-700 dark:bg-zinc-900">
                <p className="font-medium text-zinc-700 dark:text-zinc-300">{label}</p>
                <p className="text-zinc-500">{payload[0].value} documents</p>
              </div>
            );
          }}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={32}>
          {data.map((entry) => (
            <Cell
              key={entry.month}
              fill={entry.count === maxCount ? "#18181b" : "#d4d4d8"}
              className="dark:fill-zinc-600"
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
