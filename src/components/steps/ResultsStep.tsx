"use client";

import React, { useCallback } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEnergyStore } from "@/lib/store/useEnergyStore";
import { KPICards } from "@/components/dashboard/KPICards";
import { CashFlowChart } from "@/components/charts/CashFlowChart";
import { EnergyBalanceChart } from "@/components/charts/EnergyBalanceChart";
import { FinancialTable } from "@/components/tables/FinancialTable";
import { SensitivityChart } from "@/components/charts/SensitivityChart";
import { ScenarioComparison } from "@/components/charts/ScenarioComparison";

export function ResultsStep() {
  const { setCurrentStep, results, isCalculating, config, financial, loadMetrics } = useEnergyStore();

  const handleExportReport = useCallback(async () => {
    if (!results || !loadMetrics) return;
    const { generatePDFReport } = await import("@/lib/export/reportGenerator");
    generatePDFReport(results, config, financial, loadMetrics, config.city);
  }, [results, config, financial, loadMetrics]);

  if (isCalculating) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Calcolo in corso...</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            Nessun risultato disponibile. Configura gli impianti prima.
          </p>
          <Button onClick={() => setCurrentStep("config")}>
            Vai alla Configurazione
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Dashboard Risultati
          </h2>
          <p className="text-muted-foreground mt-1">
            Analisi energetica e finanziaria dell&apos;investimento
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setCurrentStep("financials")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Modifica Parametri
          </Button>
          <Button onClick={handleExportReport}>
            <Download className="w-4 h-4 mr-2" />
            Esporta Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards />

      {/* Tabs per grafici e tabelle */}
      <Tabs defaultValue="energy" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="energy">Bilancio Energetico</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="financial">Conto Economico</TabsTrigger>
          <TabsTrigger value="sensitivity">Sensibilita</TabsTrigger>
          <TabsTrigger value="scenarios">Scenari</TabsTrigger>
        </TabsList>

        <TabsContent value="energy" className="mt-6">
          <EnergyBalanceChart />
        </TabsContent>

        <TabsContent value="cashflow" className="mt-6">
          <CashFlowChart />
        </TabsContent>

        <TabsContent value="financial" className="mt-6">
          <FinancialTable />
        </TabsContent>

        <TabsContent value="sensitivity" className="mt-6">
          <SensitivityChart />
        </TabsContent>

        <TabsContent value="scenarios" className="mt-6">
          <ScenarioComparison />
        </TabsContent>
      </Tabs>
    </div>
  );
}
