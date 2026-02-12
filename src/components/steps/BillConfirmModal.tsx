"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle,
  Building2,
  Zap,
  Euro,
  Loader2,
  FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BillDataInfo } from "@/lib/types/energy";

interface BillConfirmModalProps {
  data: BillDataInfo;
  fileName: string;
  onConfirm: (data: BillDataInfo) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function BillConfirmModal({
  data,
  fileName,
  onConfirm,
  onCancel,
  isLoading,
}: BillConfirmModalProps) {
  const [ragioneSociale, setRagioneSociale] = useState(data.ragioneSociale || "");
  const [supplier, setSupplier] = useState(data.supplier || "");
  const [podCode, setPodCode] = useState(data.podCode || "");
  const [city, setCity] = useState(data.city || "");
  const [province, setProvince] = useState(data.province || "");
  const [f1, setF1] = useState(data.f1 || 0);
  const [f2, setF2] = useState(data.f2 || 0);
  const [f3, setF3] = useState(data.f3 || 0);
  const [totalConsumption, setTotalConsumption] = useState(
    data.totalConsumption || data.f1 + data.f2 + data.f3 || 0
  );
  const [autoCalcTotal, setAutoCalcTotal] = useState(true);
  const [potenzaImpegnata, setPotenzaImpegnata] = useState(data.potenzaImpegnata || 0);
  const [billingMonths, setBillingMonths] = useState(data.billingMonths || 1);
  const [prezzoMedio, setPrezzoMedio] = useState(data.prezzoMedio || 0);

  // Sincronizza lo stato locale quando arrivano i dati dal LLM
  useEffect(() => {
    setRagioneSociale(data.ragioneSociale || "");
    setSupplier(data.supplier || "");
    setPodCode(data.podCode || "");
    setCity(data.city || "");
    setProvince(data.province || "");
    setF1(data.f1 || 0);
    setF2(data.f2 || 0);
    setF3(data.f3 || 0);
    setTotalConsumption(data.totalConsumption || (data.f1 + data.f2 + data.f3) || 0);
    setAutoCalcTotal(true);
    setPotenzaImpegnata(data.potenzaImpegnata || 0);
    setBillingMonths(data.billingMonths || 1);
    setPrezzoMedio(data.prezzoMedio || 0);
  }, [data]);

  useEffect(() => {
    if (autoCalcTotal) {
      setTotalConsumption(Math.round(f1 + f2 + f3));
    }
  }, [f1, f2, f3, autoCalcTotal]);

  const handleConfirm = () => {
    const confirmed: BillDataInfo = {
      ragioneSociale: ragioneSociale || undefined,
      podCode: podCode || undefined,
      supplier: supplier || undefined,
      city: city || undefined,
      province: province || undefined,
      potenzaImpegnata: potenzaImpegnata || undefined,
      f1,
      f2,
      f3,
      totalConsumption: totalConsumption || f1 + f2 + f3,
      billingMonths,
      prezzoMedio: prezzoMedio || undefined,
    };
    onConfirm(confirmed);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
            <p className="text-foreground font-medium">
              Analisi bolletta in corso...
            </p>
            <p className="text-sm text-muted-foreground text-center">
              L&apos;intelligenza artificiale sta estraendo i dati da{" "}
              <span className="font-mono text-xs">{fileName}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <Card className="w-full max-w-2xl mx-4 my-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              Verifica Dati Bolletta
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {fileName} &mdash; Controlla e correggi i dati estratti
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Dati Generali */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Dati Generali
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ragione-sociale" className="text-xs text-muted-foreground">
                  Ragione Sociale
                </Label>
                <Input
                  id="ragione-sociale"
                  value={ragioneSociale}
                  onChange={(e) => setRagioneSociale(e.target.value)}
                  placeholder="Nome azienda"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier" className="text-xs text-muted-foreground">
                  Fornitore
                </Label>
                <Input
                  id="supplier"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="es. Sorgenia, Enel"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pod-code" className="text-xs text-muted-foreground">
                  Codice POD
                </Label>
                <Input
                  id="pod-code"
                  value={podCode}
                  onChange={(e) => setPodCode(e.target.value)}
                  placeholder="IT001E..."
                  className="bg-background font-mono text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs text-muted-foreground">
                  Citta (punto di fornitura)
                </Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="es. Milano, Roma"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="province" className="text-xs text-muted-foreground">
                  Provincia
                </Label>
                <Input
                  id="province"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="es. MI, RM"
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          {/* Consumi Annuali */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Consumi Annuali (kWh)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="f1" className="text-xs text-energy-blue">
                  F1 (Punta)
                </Label>
                <Input
                  id="f1"
                  type="number"
                  value={f1 || ""}
                  onChange={(e) => setF1(parseFloat(e.target.value) || 0)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f2" className="text-xs text-energy-amber">
                  F2 (Intermedia)
                </Label>
                <Input
                  id="f2"
                  type="number"
                  value={f2 || ""}
                  onChange={(e) => setF2(parseFloat(e.target.value) || 0)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f3" className="text-xs text-energy-green">
                  F3 (Fuori Punta)
                </Label>
                <Input
                  id="f3"
                  type="number"
                  value={f3 || ""}
                  onChange={(e) => setF3(parseFloat(e.target.value) || 0)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="total" className="text-xs text-foreground flex items-center gap-1">
                  Totale
                  {autoCalcTotal && (
                    <span className="text-[10px] text-muted-foreground">(auto)</span>
                  )}
                </Label>
                <Input
                  id="total"
                  type="number"
                  value={totalConsumption || ""}
                  onChange={(e) => {
                    setAutoCalcTotal(false);
                    setTotalConsumption(parseFloat(e.target.value) || 0);
                  }}
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          {/* Potenza e Contratto */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Potenza e Contratto
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="potenza" className="text-xs text-muted-foreground">
                  Potenza Impegnata (kW)
                </Label>
                <Input
                  id="potenza"
                  type="number"
                  value={potenzaImpegnata || ""}
                  onChange={(e) => setPotenzaImpegnata(parseFloat(e.target.value) || 0)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billing-months" className="text-xs text-muted-foreground">
                  Mesi Fatturazione
                </Label>
                <Input
                  id="billing-months"
                  type="number"
                  min={1}
                  max={24}
                  value={billingMonths || ""}
                  onChange={(e) => setBillingMonths(parseInt(e.target.value) || 1)}
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          {/* Dati Economici */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Euro className="w-4 h-4" />
              Dati Economici
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prezzo-medio" className="text-xs text-muted-foreground">
                  Prezzo Medio (€/kWh)
                </Label>
                <Input
                  id="prezzo-medio"
                  type="number"
                  step="0.001"
                  value={prezzoMedio || ""}
                  onChange={(e) => setPrezzoMedio(parseFloat(e.target.value) || 0)}
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          {/* Azioni */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={onCancel}>
              Annulla
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={f1 + f2 + f3 <= 0}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Conferma Dati
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
