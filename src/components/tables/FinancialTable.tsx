"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEnergyStore } from "@/lib/store/useEnergyStore";
import { formatCurrency, formatEnergy } from "@/lib/utils/formatters";
import { ChevronDown, ChevronUp } from "lucide-react";

export function FinancialTable() {
  const results = useEnergyStore((state) => state.results);
  const [showAllYears, setShowAllYears] = useState(false);

  if (!results?.cashFlow) {
    return null;
  }

  const { cashFlow, financial } = results;

  // Mostra primi 10 anni o tutti
  const displayedYears = showAllYears ? cashFlow : cashFlow.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Conto Economico Previsionale</CardTitle>
            <CardDescription>
              Analisi cash flow su 20 anni con degrado FV e inflazione
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">CAPEX Iniziale</p>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(financial.capex)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                  Anno
                </th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                  Produzione FV
                </th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                  Risparmio Energia
                </th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                  Ricavi Rete
                </th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                  Manutenzione
                </th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                  Cash Flow
                </th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                  Cumulativo
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Riga Anno 0 (CAPEX) */}
              <tr className="border-b border-border/50 bg-muted/30">
                <td className="py-2 px-2 font-medium">0</td>
                <td className="text-right py-2 px-2 text-muted-foreground">-</td>
                <td className="text-right py-2 px-2 text-muted-foreground">-</td>
                <td className="text-right py-2 px-2 text-muted-foreground">-</td>
                <td className="text-right py-2 px-2 text-muted-foreground">-</td>
                <td className="text-right py-2 px-2 font-medium text-energy-red">
                  {formatCurrency(-financial.capex)}
                </td>
                <td className="text-right py-2 px-2 font-medium text-energy-red">
                  {formatCurrency(-financial.capex)}
                </td>
              </tr>

              {/* Righe anni operativi */}
              {displayedYears.map((year, index) => {
                const isPaybackYear =
                  year.cumulativeCashFlow >= 0 &&
                  (index === 0 ||
                    cashFlow[index - 1]?.cumulativeCashFlow < 0);

                return (
                  <tr
                    key={year.year}
                    className={`border-b border-border/50 ${
                      isPaybackYear ? "bg-energy-green/10" : ""
                    }`}
                  >
                    <td className="py-2 px-2 font-medium">
                      {year.year}
                      {isPaybackYear && (
                        <span className="ml-2 text-xs text-energy-green">
                          Payback
                        </span>
                      )}
                    </td>
                    <td className="text-right py-2 px-2 text-muted-foreground">
                      {formatEnergy(year.pvProduction)}
                    </td>
                    <td className="text-right py-2 px-2 text-energy-green">
                      {formatCurrency(year.energySavings)}
                    </td>
                    <td className="text-right py-2 px-2 text-energy-blue">
                      {formatCurrency(year.gridRevenue)}
                    </td>
                    <td className="text-right py-2 px-2 text-energy-red">
                      {formatCurrency(-year.maintenanceCost)}
                    </td>
                    <td className="text-right py-2 px-2 font-medium text-energy-green">
                      {formatCurrency(year.netCashFlow)}
                    </td>
                    <td
                      className={`text-right py-2 px-2 font-medium ${
                        year.cumulativeCashFlow >= 0
                          ? "text-energy-green"
                          : "text-energy-red"
                      }`}
                    >
                      {formatCurrency(year.cumulativeCashFlow)}
                    </td>
                  </tr>
                );
              })}

              {/* Riga Totale */}
              <tr className="bg-muted/50 font-medium">
                <td className="py-3 px-2">TOTALE</td>
                <td className="text-right py-3 px-2 text-foreground">
                  {formatEnergy(cashFlow.reduce((sum, y) => sum + y.pvProduction, 0))}
                </td>
                <td className="text-right py-3 px-2 text-energy-green">
                  {formatCurrency(cashFlow.reduce((sum, y) => sum + y.energySavings, 0))}
                </td>
                <td className="text-right py-3 px-2 text-energy-blue">
                  {formatCurrency(cashFlow.reduce((sum, y) => sum + y.gridRevenue, 0))}
                </td>
                <td className="text-right py-3 px-2 text-energy-red">
                  {formatCurrency(-cashFlow.reduce((sum, y) => sum + y.maintenanceCost, 0))}
                </td>
                <td className="text-right py-3 px-2 text-energy-green">
                  {formatCurrency(cashFlow.reduce((sum, y) => sum + y.netCashFlow, 0))}
                </td>
                <td
                  className={`text-right py-3 px-2 ${
                    cashFlow[cashFlow.length - 1].cumulativeCashFlow >= 0
                      ? "text-energy-green"
                      : "text-energy-red"
                  }`}
                >
                  {formatCurrency(cashFlow[cashFlow.length - 1].cumulativeCashFlow)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Toggle mostra tutti gli anni */}
        {cashFlow.length > 10 && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllYears(!showAllYears)}
            >
              {showAllYears ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Mostra meno
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Mostra tutti i 20 anni
                </>
              )}
            </Button>
          </div>
        )}

        {/* Note */}
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Note: I calcoli includono degrado annuale FV dello 0.5%, inflazione
            energetica del 3% e costi di manutenzione pari all'1% del CAPEX. Il NPV
            e calcolato con un tasso di sconto del 5%.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
