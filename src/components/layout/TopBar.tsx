"use client";

import React, { useRef, useCallback } from "react";
import { Upload, RefreshCw, Download, Database, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEnergyStore } from "@/lib/store/useEnergyStore";
import { formatEnergy, formatPower } from "@/lib/utils/formatters";
import { usePDFExtraction } from "@/hooks/usePDFExtraction";
import { BillConfirmModal } from "@/components/steps/BillConfirmModal";

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadDemoData, loadMetrics, hasData, reset, uploadedFiles, results, config, financial } =
    useEnergyStore();

  const {
    handleFilesSelected,
    handleConfirmBillData,
    handleCancelBillData,
    showConfirmModal,
    pendingBillData,
    pendingPDFFile,
    isExtracting,
  } = usePDFExtraction();

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      await handleFilesSelected(Array.from(files));

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFilesSelected]
  );

  const handleExportReport = useCallback(async () => {
    if (!results || !loadMetrics) return;
    const { generatePDFReport } = await import("@/lib/export/reportGenerator");
    generatePDFReport(results, config, financial, loadMetrics, config.city);
  }, [results, config, financial, loadMetrics]);

  return (
    <>
      <header className="fixed top-0 left-64 right-0 h-16 bg-secondary border-b border-border z-40">
        <div className="h-full px-6 flex items-center justify-between">
          {/* Sinistra - Info progetto */}
          <div className="flex items-center gap-6">
            <div>
              <h2 className="font-semibold text-foreground">
                Dimensionamento Energetico
              </h2>
              <p className="text-xs text-muted-foreground">
                Simulazione impianti FV + Storage
              </p>
            </div>

            {/* Metriche carico se disponibili */}
            {hasData && loadMetrics && (
              <div className="flex items-center gap-6 pl-6 border-l border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Consumo Annuo</p>
                  <p className="font-semibold text-energy-blue">
                    {formatEnergy(loadMetrics.totalConsumption)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Potenza Max</p>
                  <p className="font-semibold text-energy-amber">
                    {formatPower(loadMetrics.pMax)}
                  </p>
                </div>
                {uploadedFiles.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">File Caricati</p>
                    <p className="font-semibold text-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {uploadedFiles.length}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Destra - Azioni */}
          <div className="flex items-center gap-3">
            {/* Upload CSV/PDF */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.pdf"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Carica File
            </Button>

            {/* Carica Demo */}
            <Button variant="outline" size="sm" onClick={loadDemoData}>
              <Database className="w-4 h-4 mr-2" />
              Dati Demo
            </Button>

            {/* Reset */}
            {hasData && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            )}

            {/* Export */}
            {hasData && results && (
              <Button variant="default" size="sm" onClick={handleExportReport}>
                <Download className="w-4 h-4 mr-2" />
                Esporta
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Modal conferma dati bolletta (flusso LLM) */}
      {showConfirmModal && (
        <BillConfirmModal
          data={pendingBillData || { f1: 0, f2: 0, f3: 0, billingMonths: 1 }}
          fileName={pendingPDFFile?.name || ""}
          onConfirm={handleConfirmBillData}
          onCancel={handleCancelBillData}
          isLoading={isExtracting}
        />
      )}
    </>
  );
}
