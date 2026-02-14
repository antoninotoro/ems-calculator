"use client";

import React, { useCallback, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Database,
  ArrowRight,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
  Calendar,
  Building2,
  Euro,
  Shield,
  AlertTriangle,
  Activity,
  Edit3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEnergyStore } from "@/lib/store/useEnergyStore";
import { formatEnergy, formatPower, formatNumber } from "@/lib/utils/formatters";
import { LoadProfileChart } from "@/components/charts/LoadProfileChart";
import { BillConfirmModal } from "@/components/steps/BillConfirmModal";
import { MonthlyInputTable } from "@/components/steps/MonthlyInputTable";
import { usePDFExtraction } from "@/hooks/usePDFExtraction";
import { UploadedFile } from "@/lib/types/energy";

function FileStatusIcon({ status }: { status: UploadedFile["status"] }) {
  switch (status) {
    case "processing":
      return <Loader2 className="w-4 h-4 text-energy-blue animate-spin" />;
    case "success":
      return <CheckCircle className="w-4 h-4 text-energy-green" />;
    case "error":
      return <AlertCircle className="w-4 h-4 text-energy-red" />;
    default:
      return null;
  }
}

function FileTypeIcon({ type }: { type: "csv" | "pdf" }) {
  if (type === "pdf") {
    return <FileText className="w-5 h-5 text-energy-red" />;
  }
  return <FileSpreadsheet className="w-5 h-5 text-energy-green" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataStep() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    removeFile,
    loadDemoData,
    loadMetrics,
    hasData,
    loadProfile,
    uploadedFiles,
    setCurrentStep,
    manualInput,
    setManualInput,
    applyManualInput,
  } = useEnergyStore();

  // Hook condiviso per orchestrazione PDF/LLM
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

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      const files = event.dataTransfer.files;
      if (!files || files.length === 0) return;

      const validFiles = Array.from(files).filter((f) => {
        const ext = f.name.toLowerCase().split(".").pop();
        return ext === "csv" || ext === "pdf";
      });

      if (validFiles.length > 0) {
        await handleFilesSelected(validFiles);
      }
    },
    [handleFilesSelected]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Caricamento Dati di Consumo
        </h2>
        <p className="text-muted-foreground mt-1">
          Carica uno o piu file CSV o PDF con i dati di consumo energetico
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-accent" />
              Carica File
            </CardTitle>
            <CardDescription>
              Supporta file CSV e PDF (anche multipli)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.pdf"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex justify-center gap-4 mb-4">
                <FileSpreadsheet className="w-10 h-10 text-energy-green" />
                <FileText className="w-10 h-10 text-energy-red" />
              </div>
              <p className="text-foreground font-medium">
                Trascina qui i file CSV o PDF
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                oppure clicca per selezionare
              </p>
              <div className="mt-4 flex justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="w-3 h-3" />
                  CSV: timestamp,power_kw
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  PDF: bollette, report
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">oppure</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={loadDemoData}
            >
              <Database className="w-4 h-4 mr-2" />
              Usa Dati Demo (Ufficio Tipo)
            </Button>

            {/* Sezione Input Manuale */}
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center gap-2 mb-4">
                <Edit3 className="w-4 h-4 text-accent" />
                <span className="font-medium text-sm">Input Manuale</span>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-consumption" className="text-sm text-muted-foreground">
                    Consumo Annuo (kWh)
                  </Label>
                  <Input
                    id="manual-consumption"
                    type="number"
                    placeholder="es. 400000"
                    value={manualInput.annualConsumption_kWh || ""}
                    onChange={(e) => setManualInput({
                      annualConsumption_kWh: e.target.value ? parseFloat(e.target.value) : null
                    })}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-price" className="text-sm text-muted-foreground">
                    Prezzo Medio Energia (€/kWh)
                  </Label>
                  <Input
                    id="manual-price"
                    type="number"
                    step="0.01"
                    placeholder="es. 0.25"
                    value={manualInput.averagePrice_euroKWh || ""}
                    onChange={(e) => setManualInput({
                      averagePrice_euroKWh: e.target.value ? parseFloat(e.target.value) : null
                    })}
                    className="bg-background"
                  />
                </div>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={applyManualInput}
                  disabled={!manualInput.annualConsumption_kWh || manualInput.annualConsumption_kWh <= 0}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Applica Dati Manuali
                </Button>
              </div>
            </div>

            {/* Tabella consumi mensili F1/F2/F3 */}
            <MonthlyInputTable />
          </CardContent>
        </Card>

        {/* File List & Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>File Caricati</CardTitle>
            <CardDescription>
              {uploadedFiles.length === 0
                ? "Nessun file caricato"
                : `${uploadedFiles.length} file - I dati vengono sommati`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploadedFiles.length > 0 ? (
              <div className="space-y-4">
                {/* Lista file */}
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`p-3 rounded-lg bg-muted/30 ${
                        file.status === "error" ? "border border-energy-red/30" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FileTypeIcon type={file.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {file.name}
                          </p>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>{formatFileSize(file.size)}</span>
                            {file.status === "success" && (
                              <>
                                <span>{formatNumber(file.dataPoints)} punti</span>
                                <span>{formatEnergy(file.totalConsumption)}</span>
                              </>
                            )}
                            {file.status === "error" && (
                              <span className="text-energy-red">{file.error}</span>
                            )}
                          </div>
                        </div>
                        <FileStatusIcon status={file.status} />
                        <button
                          onClick={() => removeFile(file.id)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>

                      {/* Dettagli bolletta per PDF */}
                      {file.status === "success" && file.billData && (
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                          {/* Ragione Sociale se disponibile */}
                          {file.billData.ragioneSociale && (
                            <div className="text-xs text-foreground font-medium">
                              {file.billData.ragioneSociale}
                            </div>
                          )}

                          {/* Consumi annuali per fascia */}
                          <div className="mb-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                              Consumo Annuale per Fascia
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="p-2 rounded bg-energy-blue/10">
                              <p className="text-muted-foreground">F1 (Punta)</p>
                              <p className="font-semibold text-energy-blue">
                                {formatEnergy(file.billData.f1)}
                              </p>
                            </div>
                            <div className="p-2 rounded bg-energy-amber/10">
                              <p className="text-muted-foreground">F2 (Intermedia)</p>
                              <p className="font-semibold text-energy-amber">
                                {formatEnergy(file.billData.f2)}
                              </p>
                            </div>
                            <div className="p-2 rounded bg-energy-green/10">
                              <p className="text-muted-foreground">F3 (Fuori Punta)</p>
                              <p className="font-semibold text-energy-green">
                                {formatEnergy(file.billData.f3)}
                              </p>
                            </div>
                          </div>
                          {/* Totale annuale */}
                          {file.billData.totalConsumption && (
                            <div className="mt-2 p-2 rounded bg-muted/50 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Totale Annuale (F1+F2+F3)</span>
                                <span className="font-semibold">{formatEnergy(file.billData.totalConsumption)}</span>
                              </div>
                            </div>
                          )}

                          {/* Riga potenze e prezzo */}
                          {(file.billData.potenzaImpegnata || file.billData.maxPowerHistory?.length || file.billData.prezzoMedio) && (
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              {file.billData.potenzaImpegnata && (
                                <div className="p-2 rounded bg-muted/50">
                                  <p className="text-muted-foreground">P. Impegnata</p>
                                  <p className="font-semibold">{file.billData.potenzaImpegnata} kW</p>
                                </div>
                              )}
                              {file.billData.maxPowerHistory && file.billData.maxPowerHistory.length > 0 && (
                                <div className="p-2 rounded bg-energy-red/10">
                                  <p className="text-muted-foreground flex items-center gap-1">
                                    <Activity className="w-3 h-3" />
                                    P. Max Storica
                                  </p>
                                  <p className="font-semibold text-energy-red">
                                    {Math.max(...file.billData.maxPowerHistory.map(m => m.maxPower))} kW
                                  </p>
                                </div>
                              )}
                              {file.billData.prezzoMedio && (
                                <div className="p-2 rounded bg-muted/50">
                                  <p className="text-muted-foreground flex items-center gap-1">
                                    <Euro className="w-3 h-3" />
                                    Prezzo Medio
                                  </p>
                                  <p className="font-semibold">{file.billData.prezzoMedio.toFixed(4)} €/kWh</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Metadati e qualita */}
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {file.billData.historicalMonths && file.billData.historicalMonths > 0 ? (
                              <span className="flex items-center gap-1 text-energy-green">
                                <Calendar className="w-3 h-3" />
                                {file.billData.historicalMonths} mesi storico
                              </span>
                            ) : file.billData.billingMonths > 0 && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {file.billData.billingMonths} {file.billData.billingMonths === 1 ? "mese" : "mesi"}
                              </span>
                            )}
                            {file.billData.supplier && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {file.billData.supplier}
                              </span>
                            )}
                            {file.billData.contractPower && (
                              <span className="flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                {file.billData.contractPower} kW
                              </span>
                            )}
                            {file.billData.podCode && (
                              <span className="font-mono text-[10px]">
                                POD: {file.billData.podCode}
                              </span>
                            )}
                          </div>

                          {/* Indicatore qualita dati */}
                          {file.billData.dataQuality && (
                            <div className="flex items-center gap-2 text-xs">
                              {file.billData.dataQuality.validated ? (
                                <span className="flex items-center gap-1 text-energy-green">
                                  <Shield className="w-3 h-3" />
                                  Dati validati
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-energy-amber">
                                  <AlertTriangle className="w-3 h-3" />
                                  Verifica manuale consigliata
                                </span>
                              )}
                              <span className="text-muted-foreground">
                                Confidenza: {file.billData.dataQuality.confidence}%
                              </span>
                            </div>
                          )}

                          {/* Errori di validazione */}
                          {file.billData.dataQuality?.errors && file.billData.dataQuality.errors.length > 0 && (
                            <div className="text-xs text-energy-amber bg-energy-amber/10 p-2 rounded">
                              {file.billData.dataQuality.errors.map((err, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {err}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Metriche aggregate */}
                {hasData && loadMetrics && (
                  <>
                    <div className="border-t border-border pt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-3">
                        Totale Aggregato
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-energy-blue/10 border border-energy-blue/20">
                          <p className="text-xs text-muted-foreground">
                            Consumo Totale
                          </p>
                          <p className="text-lg font-bold text-energy-blue">
                            {formatEnergy(loadMetrics.totalConsumption)}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-energy-amber/10 border border-energy-amber/20">
                          <p className="text-xs text-muted-foreground">
                            Potenza Max
                          </p>
                          <p className="text-lg font-bold text-energy-amber">
                            {formatPower(loadMetrics.pMax)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => setCurrentStep("config")}
                    >
                      Continua con la Configurazione
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                <p>Carica almeno un file per iniziare</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grafico Profilo Carico */}
      {hasData && (
        <Card>
          <CardHeader>
            <CardTitle>Profilo di Carico Giornaliero Medio</CardTitle>
            <CardDescription>
              Pattern tipico estratto dai dati caricati
              {uploadedFiles.length > 1 && " (somma di tutti i file)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoadProfileChart loadProfile={loadProfile} />
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
