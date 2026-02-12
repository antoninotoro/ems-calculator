"use client";

import React from "react";
import {
  Clock,
  TrendingUp,
  Wallet,
  Leaf,
  Sun,
  Zap,
  PiggyBank,
  Target,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useEnergyStore, useKPIs } from "@/lib/store/useEnergyStore";
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatYears,
  formatEnergy,
} from "@/lib/utils/formatters";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color: "green" | "blue" | "amber" | "red" | "default";
  trend?: {
    value: number;
    label: string;
  };
}

function KPICard({ title, value, subtitle, icon: Icon, color, trend }: KPICardProps) {
  const colorClasses = {
    green: "text-energy-green bg-energy-green/10 border-energy-green/20",
    blue: "text-energy-blue bg-energy-blue/10 border-energy-blue/20",
    amber: "text-energy-amber bg-energy-amber/10 border-energy-amber/20",
    red: "text-energy-red bg-energy-red/10 border-energy-red/20",
    default: "text-foreground bg-muted/30 border-border",
  };

  const iconBgClasses = {
    green: "bg-energy-green/20",
    blue: "bg-energy-blue/20",
    amber: "bg-energy-amber/20",
    red: "bg-energy-red/20",
    default: "bg-muted",
  };

  return (
    <Card className={`border ${colorClasses[color].split(" ").slice(1).join(" ")}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${colorClasses[color].split(" ")[0]}`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp
                  className={`w-3 h-3 ${
                    trend.value >= 0 ? "text-energy-green" : "text-energy-red"
                  }`}
                />
                <span
                  className={`text-xs ${
                    trend.value >= 0 ? "text-energy-green" : "text-energy-red"
                  }`}
                >
                  {trend.value >= 0 ? "+" : ""}
                  {trend.value}%
                </span>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={`w-10 h-10 rounded-lg ${iconBgClasses[color]} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${colorClasses[color].split(" ")[0]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function KPICards() {
  const results = useEnergyStore((state) => state.results);
  const loadMetrics = useEnergyStore((state) => state.loadMetrics);
  const config = useEnergyStore((state) => state.config);

  if (!results || !loadMetrics) {
    return null;
  }

  const { financial, energyBalance, environmental } = results;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Payback */}
      <KPICard
        title="Payback Semplice"
        value={formatYears(financial.paybackSimple)}
        subtitle="Tempo di ritorno investimento"
        icon={Clock}
        color={financial.paybackSimple <= 7 ? "green" : financial.paybackSimple <= 12 ? "amber" : "red"}
      />

      {/* IRR */}
      <KPICard
        title="IRR (TIR)"
        value={formatPercent(financial.irr)}
        subtitle="Tasso Interno di Rendimento"
        icon={TrendingUp}
        color={financial.irr >= 10 ? "green" : financial.irr >= 5 ? "amber" : "red"}
      />

      {/* NPV */}
      <KPICard
        title="NPV (VAN)"
        value={formatCurrency(financial.npv)}
        subtitle="Valore Attuale Netto (20 anni)"
        icon={Wallet}
        color={financial.npv >= 0 ? "green" : "red"}
      />

      {/* CO2 Saved */}
      <KPICard
        title="CO2 Risparmiata"
        value={`${formatNumber(environmental.co2SavedAnnual, 1)} ton`}
        subtitle={`${environmental.treesEquivalent} alberi equivalenti`}
        icon={Leaf}
        color="green"
      />

      {/* Risparmio Annuo */}
      <KPICard
        title="Risparmio Annuo"
        value={formatCurrency(financial.annualSavings)}
        subtitle="Primo anno di esercizio"
        icon={PiggyBank}
        color="blue"
      />

      {/* Produzione FV */}
      <KPICard
        title="Produzione FV"
        value={formatEnergy(energyBalance.totalPVProduction)}
        subtitle={`${config.pvPower_kWp} kWp installati`}
        icon={Sun}
        color="amber"
      />

      {/* Autoconsumo */}
      <KPICard
        title="Autoconsumo"
        value={formatPercent(energyBalance.selfConsumptionRate)}
        subtitle="Energia FV autoconsumata"
        icon={Zap}
        color="green"
      />

      {/* Autosufficienza */}
      <KPICard
        title="Autosufficienza"
        value={formatPercent(energyBalance.selfSufficiencyRate)}
        subtitle="Indipendenza dalla rete"
        icon={Target}
        color="blue"
      />
    </div>
  );
}
