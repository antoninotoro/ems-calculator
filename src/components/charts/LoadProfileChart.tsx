"use client";

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getDailyPattern } from "@/lib/calculations/CSVParser";
import { formatPower, formatHour } from "@/lib/utils/formatters";

interface LoadProfileChartProps {
  loadProfile: number[];
}

export function LoadProfileChart({ loadProfile }: LoadProfileChartProps) {
  const data = useMemo(() => {
    const dailyPattern = getDailyPattern(loadProfile);
    return dailyPattern.map((power, hour) => ({
      hour: formatHour(hour),
      carico: Math.round(power * 10) / 10,
    }));
  }, [loadProfile]);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCarico" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="hour"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value} kW`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#f8fafc",
            }}
            formatter={(value) => [formatPower(Number(value) || 0), "Carico"]}
            labelFormatter={(label) => `Ora: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="carico"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="url(#colorCarico)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
