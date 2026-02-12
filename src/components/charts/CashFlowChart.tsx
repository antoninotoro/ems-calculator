"use client";

import React, { useMemo } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useEnergyStore } from "@/lib/store/useEnergyStore";
import { formatCurrency, formatNumber } from "@/lib/utils/formatters";

export function CashFlowChart() {
  const results = useEnergyStore((state) => state.results);

  const data = useMemo(() => {
    if (!results?.cashFlow) return [];

    return [
      { anno: 0, cumulativo: -results.financial.capex, annuo: 0 },
      ...results.cashFlow.map((cf) => ({
        anno: cf.year,
        annuo: Math.round(cf.netCashFlow),
        cumulativo: Math.round(cf.cumulativeCashFlow),
      })),
    ];
  }, [results]);

  if (!results) {
    return null;
  }

  // Trova il punto di payback
  const paybackYear = results.financial.paybackSimple;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow Cumulativo</CardTitle>
        <CardDescription>
          Analisi del flusso di cassa su 20 anni - Payback:{" "}
          {paybackYear < 50 ? `${formatNumber(paybackYear, 1)} anni` : "> 50 anni"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="anno"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                label={{
                  value: "Anno",
                  position: "insideBottom",
                  offset: -5,
                  fill: "#94a3b8",
                  fontSize: 11,
                }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                tickFormatter={(value) =>
                  `${value >= 0 ? "" : "-"}${formatNumber(Math.abs(value) / 1000)}k`
                }
                label={{
                  value: "EUR",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#94a3b8",
                  fontSize: 11,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#f8fafc",
                }}
                formatter={(value, name) => [
                  formatCurrency(Number(value) || 0),
                  name === "cumulativo" ? "Cash Flow Cumulativo" : "Cash Flow Annuo",
                ]}
                labelFormatter={(label) => `Anno ${label}`}
              />
              <Legend
                wrapperStyle={{ paddingTop: "10px" }}
                formatter={(value) =>
                  value === "cumulativo" ? "Cumulativo" : "Annuo"
                }
              />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
              <Bar
                dataKey="annuo"
                fill="#0ea5e9"
                opacity={0.5}
                radius={[4, 4, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="cumulativo"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda KPI */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">CAPEX</p>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(results.financial.capex)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">NPV (20 anni)</p>
            <p
              className={`text-lg font-bold ${
                results.financial.npv >= 0 ? "text-energy-green" : "text-energy-red"
              }`}
            >
              {formatCurrency(results.financial.npv)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">IRR</p>
            <p className="text-lg font-bold text-energy-blue">
              {formatNumber(results.financial.irr, 1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">ROI</p>
            <p className="text-lg font-bold text-energy-amber">
              {formatNumber(results.financial.roi, 0)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
