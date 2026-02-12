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
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useEnergyStore } from "@/lib/store/useEnergyStore";
import { getDailyBalancePattern } from "@/lib/calculations/BESSModel";
import { formatPower, formatEnergy, formatPercent, formatHour } from "@/lib/utils/formatters";

export function EnergyBalanceChart() {
  const results = useEnergyStore((state) => state.results);

  const data = useMemo(() => {
    if (!results?.hourlyBalance) return [];

    const dailyPattern = getDailyBalancePattern(results.hourlyBalance);
    return dailyPattern.map((d) => ({
      ora: formatHour(d.hour),
      Carico: Math.round(d.load * 10) / 10,
      Produzione: Math.round(d.pv * 10) / 10,
      Autoconsumo: Math.round(d.selfConsumption * 10) / 10,
    }));
  }, [results]);

  if (!results) {
    return null;
  }

  const { energyBalance } = results;

  return (
    <div className="space-y-6">
      {/* Grafico Giornaliero */}
      <Card>
        <CardHeader>
          <CardTitle>Bilancio Energetico Giornaliero Medio</CardTitle>
          <CardDescription>
            Confronto tra carico, produzione FV e autoconsumo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="ora"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(value) => `${value} kW`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#f8fafc",
                  }}
                  formatter={(value, name) => [
                    formatPower(Number(value) || 0),
                    String(name),
                  ]}
                  labelFormatter={(label) => `Ora: ${label}`}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Carico"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#colorLoad)"
                />
                <Area
                  type="monotone"
                  dataKey="Produzione"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#colorPV)"
                />
                <Area
                  type="monotone"
                  dataKey="Autoconsumo"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorSC)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Riepilogo Annuale */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Consumo Totale</p>
            <p className="text-2xl font-bold text-foreground">
              {formatEnergy(energyBalance.totalLoad)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Produzione FV</p>
            <p className="text-2xl font-bold text-energy-amber">
              {formatEnergy(energyBalance.totalPVProduction)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Autoconsumo Diretto</p>
            <p className="text-2xl font-bold text-energy-green">
              {formatEnergy(energyBalance.totalSelfConsumption)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Immesso in Rete</p>
            <p className="text-2xl font-bold text-energy-blue">
              {formatEnergy(energyBalance.totalGridExport)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Metriche di Performance */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Tasso di Autoconsumo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Energia FV autoconsumata / Produzione FV totale
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-energy-green">
                  {formatPercent(energyBalance.selfConsumptionRate)}
                </p>
              </div>
            </div>
            <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-energy-green rounded-full transition-all"
                style={{ width: `${Math.min(100, energyBalance.selfConsumptionRate)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Tasso di Autosufficienza
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Energia autoconsumata / Consumo totale
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-energy-blue">
                  {formatPercent(energyBalance.selfSufficiencyRate)}
                </p>
              </div>
            </div>
            <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-energy-blue rounded-full transition-all"
                style={{ width: `${Math.min(100, energyBalance.selfSufficiencyRate)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
