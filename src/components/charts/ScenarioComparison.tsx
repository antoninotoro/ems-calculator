"use client";

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEnergyStore } from "@/lib/store/useEnergyStore";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

const CHART_COLORS = [
  "hsl(var(--energy-blue))",
  "hsl(var(--energy-green))",
  "hsl(var(--energy-amber))",
  "hsl(var(--energy-red))",
  "hsl(var(--accent))",
];

export function ScenarioComparison() {
  const { scenarios, saveScenario, deleteScenario, results } = useEnergyStore();
  const [scenarioName, setScenarioName] = useState("");

  const handleSave = () => {
    if (!scenarioName.trim() || !results) return;
    saveScenario(scenarioName.trim());
    setScenarioName("");
  };

  // Dati per il grafico comparativo
  const metrics = [
    { key: "capex", label: "CAPEX", unit: "EUR" },
    { key: "npv", label: "NPV", unit: "EUR" },
    { key: "annualSavings", label: "Risparmio Annuo", unit: "EUR" },
  ];

  const chartData = metrics.map((m) => {
    const row: Record<string, string | number> = { name: m.label };
    scenarios.forEach((s) => {
      row[s.name] = s.results.financial[m.key as keyof typeof s.results.financial] as number;
    });
    return row;
  });

  return (
    <div className="space-y-6">
      {/* Salva scenario corrente */}
      <Card>
        <CardHeader>
          <CardTitle>Salva Scenario Corrente</CardTitle>
          <CardDescription>
            Salva la configurazione attuale per confrontarla con altre
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Nome scenario (es. 'Base', 'FV 200 kWp')"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="bg-background"
            />
            <Button onClick={handleSave} disabled={!scenarioName.trim() || !results}>
              <Save className="w-4 h-4 mr-2" />
              Salva
            </Button>
          </div>
        </CardContent>
      </Card>

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">
              Salva almeno uno scenario per il confronto
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Grafico comparativo */}
          {scenarios.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Confronto Visivo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value as number)]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    {scenarios.map((s, i) => (
                      <Bar
                        key={s.id}
                        dataKey={s.name}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabella comparativa */}
          <Card>
            <CardHeader>
              <CardTitle>Tabella Comparativa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Metrica</th>
                      {scenarios.map((s) => (
                        <th key={s.id} className="text-right py-2 px-3 font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <span>{s.name}</span>
                            <button
                              onClick={() => deleteScenario(s.id)}
                              className="p-1 hover:bg-muted rounded transition-colors"
                              title="Elimina scenario"
                            >
                              <Trash2 className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">FV (kWp)</td>
                      {scenarios.map((s) => (
                        <td key={s.id} className="py-2 px-3 text-right">{s.config.pvPower_kWp}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">Batteria (kWh)</td>
                      {scenarios.map((s) => (
                        <td key={s.id} className="py-2 px-3 text-right">{s.config.bessCapacity_kWh}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">CAPEX</td>
                      {scenarios.map((s) => (
                        <td key={s.id} className="py-2 px-3 text-right font-medium">{formatCurrency(s.results.financial.capex)}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">NPV</td>
                      {scenarios.map((s) => (
                        <td key={s.id} className={`py-2 px-3 text-right font-medium ${s.results.financial.npv >= 0 ? "text-energy-green" : "text-energy-red"}`}>
                          {formatCurrency(s.results.financial.npv)}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">IRR</td>
                      {scenarios.map((s) => (
                        <td key={s.id} className="py-2 px-3 text-right">{formatPercent(s.results.financial.irr)}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">Payback</td>
                      {scenarios.map((s) => (
                        <td key={s.id} className="py-2 px-3 text-right">
                          {s.results.financial.paybackSimple === Infinity ? ">20" : s.results.financial.paybackSimple.toFixed(1)} anni
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">Autoconsumo</td>
                      {scenarios.map((s) => (
                        <td key={s.id} className="py-2 px-3 text-right">{formatPercent(s.results.energyBalance.selfConsumptionRate)}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">CO2 (ton/anno)</td>
                      {scenarios.map((s) => (
                        <td key={s.id} className="py-2 px-3 text-right">{s.results.environmental.co2SavedAnnual.toFixed(1)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
