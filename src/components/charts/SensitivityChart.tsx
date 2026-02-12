"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useEnergyStore } from "@/lib/store/useEnergyStore";
import { runSensitivityAnalysis, SensitivityResult } from "@/lib/calculations/SensitivityAnalysis";

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return `${value.toFixed(0)}`;
}

export function SensitivityChart() {
  const { loadProfile, config, financial } = useEnergyStore();
  const [results, setResults] = useState<SensitivityResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (loadProfile.length === 0) return;

    setIsLoading(true);
    // Usa setTimeout per non bloccare il rendering
    const timer = setTimeout(() => {
      const analysis = runSensitivityAnalysis(loadProfile, config, financial);
      setResults(analysis);
      setIsLoading(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [loadProfile, config, financial]);

  if (isLoading || !results) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Calcolo analisi di sensibilita...</p>
        </div>
      </div>
    );
  }

  // Trova il NPV base (delta=0 del primo parametro)
  const baseNPV = results[0].variations.find((v) => v.delta === 0)?.npv || 0;

  // Prepara dati per il tornado chart
  // Per ogni parametro: mostra l'impatto di -20% e +20% su NPV
  const tornadoData = results.map((r) => {
    const lowVar = r.variations.find((v) => v.delta === -20);
    const highVar = r.variations.find((v) => v.delta === 20);
    const lowNPV = lowVar ? lowVar.npv - baseNPV : 0;
    const highNPV = highVar ? highVar.npv - baseNPV : 0;

    return {
      name: r.label,
      low: lowNPV,
      high: highNPV,
      // Per ordinamento: range totale
      range: Math.abs(highNPV - lowNPV),
    };
  }).sort((a, b) => b.range - a.range);

  return (
    <div className="space-y-6">
      {/* Tornado Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Impatto sul NPV (variazione ±20%)</CardTitle>
          <CardDescription>
            Delta NPV rispetto al caso base ({formatCurrency(baseNPV)} EUR)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={tornadoData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                tickFormatter={(v) => `${formatCurrency(v)} EUR`}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip
                formatter={(value) => [`${formatCurrency(value as number)} EUR`, "Delta NPV"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <ReferenceLine x={0} stroke="hsl(var(--foreground))" strokeWidth={1} />
              <Bar dataKey="low" name="-20%">
                {tornadoData.map((entry, index) => (
                  <Cell
                    key={`low-${index}`}
                    fill={entry.low < 0 ? "hsl(var(--energy-red))" : "hsl(var(--energy-green))"}
                  />
                ))}
              </Bar>
              <Bar dataKey="high" name="+20%">
                {tornadoData.map((entry, index) => (
                  <Cell
                    key={`high-${index}`}
                    fill={entry.high >= 0 ? "hsl(var(--energy-green))" : "hsl(var(--energy-red))"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabella dettagliata */}
      <Card>
        <CardHeader>
          <CardTitle>Dettaglio Variazioni</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Parametro</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Base</th>
                  {[-20, -10, 10, 20].map((d) => (
                    <th key={d} className="text-right py-2 px-3 text-muted-foreground font-medium">
                      {d > 0 ? "+" : ""}{d}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.parameter} className="border-b border-border/50">
                    <td className="py-2 px-3 font-medium">{r.label}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">
                      {formatCurrency(baseNPV)} EUR
                    </td>
                    {[-20, -10, 10, 20].map((d) => {
                      const v = r.variations.find((v) => v.delta === d);
                      if (!v) return <td key={d} className="py-2 px-3 text-right">-</td>;
                      const delta = v.npv - baseNPV;
                      const color = delta >= 0 ? "text-energy-green" : "text-energy-red";
                      return (
                        <td key={d} className={`py-2 px-3 text-right ${color}`}>
                          {delta >= 0 ? "+" : ""}{formatCurrency(delta)} EUR
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
