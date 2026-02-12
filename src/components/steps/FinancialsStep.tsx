"use client";

import React from "react";
import {
  Euro,
  TrendingUp,
  Percent,
  ArrowRight,
  ArrowLeft,
  Calculator,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEnergyStore, useKPIs } from "@/lib/store/useEnergyStore";
import { formatCurrency, formatPercent, formatYears } from "@/lib/utils/formatters";

interface FinancialInputProps {
  label: string;
  value: number;
  unit: string;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

function FinancialInput({
  label,
  value,
  unit,
  step = 0.01,
  min = 0,
  max,
  onChange,
}: FinancialInputProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-sm text-muted-foreground w-16">{unit}</span>
      </div>
    </div>
  );
}

export function FinancialsStep() {
  const { financial, setFinancial, setCurrentStep, config, results } = useEnergyStore();
  const kpis = useKPIs();

  // Calcola CAPEX per preview
  const capex =
    config.pvPower_kWp * financial.pvCost +
    config.bessCapacity_kWh * financial.bessCost +
    config.heatPumpPower_kW * financial.heatPumpCost +
    (financial.ledCost * config.ledSavings_percent) / 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Parametri Finanziari
        </h2>
        <p className="text-muted-foreground mt-1">
          Configura i prezzi dell'energia e i costi degli impianti
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parametri */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prezzi Energia */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Euro className="w-5 h-5 text-energy-green" />
                Prezzi Energia
              </CardTitle>
              <CardDescription>
                Prezzi di acquisto e vendita dell'energia elettrica
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FinancialInput
                  label="Prezzo Acquisto Energia"
                  value={financial.purchasePrice}
                  unit="EUR/kWh"
                  step={0.01}
                  onChange={(v) => setFinancial({ purchasePrice: v })}
                />
                <FinancialInput
                  label="Prezzo Vendita (RID/SSP)"
                  value={financial.sellingPrice}
                  unit="EUR/kWh"
                  step={0.01}
                  onChange={(v) => setFinancial({ sellingPrice: v })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Costi Impianti */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-energy-blue" />
                Costi Unitari Impianti
              </CardTitle>
              <CardDescription>
                Costi chiavi in mano per ogni tipologia di impianto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FinancialInput
                  label="Costo Impianto FV"
                  value={financial.pvCost}
                  unit="EUR/kWp"
                  step={10}
                  onChange={(v) => setFinancial({ pvCost: v })}
                />
                <FinancialInput
                  label="Costo Batteria"
                  value={financial.bessCost}
                  unit="EUR/kWh"
                  step={10}
                  onChange={(v) => setFinancial({ bessCost: v })}
                />
                <FinancialInput
                  label="Costo Pompa di Calore"
                  value={financial.heatPumpCost}
                  unit="EUR/kW"
                  step={10}
                  onChange={(v) => setFinancial({ heatPumpCost: v })}
                />
                <FinancialInput
                  label="Costo Relamping LED"
                  value={financial.ledCost}
                  unit="EUR"
                  step={100}
                  onChange={(v) => setFinancial({ ledCost: v })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Parametri Finanziari */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-energy-amber" />
                Parametri Analisi Finanziaria
              </CardTitle>
              <CardDescription>
                Tassi e parametri per il calcolo di NPV, IRR e Cash Flow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FinancialInput
                  label="Tasso di Sconto"
                  value={financial.discountRate * 100}
                  unit="%"
                  step={0.5}
                  min={0}
                  max={20}
                  onChange={(v) => setFinancial({ discountRate: v / 100 })}
                />
                <FinancialInput
                  label="Inflazione Energetica"
                  value={financial.energyInflation * 100}
                  unit="%"
                  step={0.5}
                  min={0}
                  max={10}
                  onChange={(v) => setFinancial({ energyInflation: v / 100 })}
                />
                <FinancialInput
                  label="Degrado FV Annuale"
                  value={financial.pvDegradation * 100}
                  unit="%"
                  step={0.1}
                  min={0}
                  max={2}
                  onChange={(v) => setFinancial({ pvDegradation: v / 100 })}
                />
                <FinancialInput
                  label="Costo Manutenzione"
                  value={financial.maintenanceCost * 100}
                  unit="% CAPEX"
                  step={0.1}
                  min={0}
                  max={5}
                  onChange={(v) => setFinancial({ maintenanceCost: v / 100 })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Riepilogo */}
        <div className="space-y-6">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Riepilogo Investimento</CardTitle>
              <CardDescription>Anteprima analisi finanziaria</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* CAPEX */}
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">CAPEX Totale</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(capex)}
                </p>
                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                  {config.pvPower_kWp > 0 && (
                    <p>FV: {formatCurrency(config.pvPower_kWp * financial.pvCost)}</p>
                  )}
                  {config.bessCapacity_kWh > 0 && (
                    <p>BESS: {formatCurrency(config.bessCapacity_kWh * financial.bessCost)}</p>
                  )}
                  {config.heatPumpPower_kW > 0 && (
                    <p>PdC: {formatCurrency(config.heatPumpPower_kW * financial.heatPumpCost)}</p>
                  )}
                </div>
              </div>

              {kpis && (
                <>
                  <div className="p-3 rounded-lg bg-energy-green/10 border border-energy-green/20">
                    <p className="text-xs text-muted-foreground">Risparmio Annuo</p>
                    <p className="text-xl font-bold text-energy-green">
                      {formatCurrency(kpis.risparmioAnnuo)}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-energy-blue/10 border border-energy-blue/20">
                    <p className="text-xs text-muted-foreground">Payback Semplice</p>
                    <p className="text-xl font-bold text-energy-blue">
                      {formatYears(kpis.payback)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">NPV (20 anni)</p>
                      <p
                        className={`text-lg font-bold ${
                          kpis.npv >= 0 ? "text-energy-green" : "text-energy-red"
                        }`}
                      >
                        {formatCurrency(kpis.npv)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">IRR</p>
                      <p
                        className={`text-lg font-bold ${
                          kpis.irr >= financial.discountRate * 100
                            ? "text-energy-green"
                            : "text-energy-red"
                        }`}
                      >
                        {formatPercent(kpis.irr)}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCurrentStep("config")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Indietro
            </Button>
            <Button
              className="flex-1"
              onClick={() => setCurrentStep("results")}
            >
              Risultati
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
