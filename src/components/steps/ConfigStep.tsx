"use client";

import React from "react";
import { Sun, Battery, Thermometer, Lightbulb, ArrowRight, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEnergyStore, useKPIs } from "@/lib/store/useEnergyStore";
import { formatNumber, formatPercent, formatEnergy } from "@/lib/utils/formatters";

interface ConfigSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  icon: React.ElementType;
  color: string;
  onChange: (value: number) => void;
}

function ConfigSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  icon: Icon,
  color,
  onChange,
}: ConfigSliderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>
          <Label className="text-sm font-medium">{label}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-24 text-right"
          />
          <span className="text-sm text-muted-foreground w-12">{unit}</span>
        </div>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  );
}

export function ConfigStep() {
  const { config, setConfig, setCurrentStep, results, loadMetrics } = useEnergyStore();
  const kpis = useKPIs();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Configurazione Impianti
        </h2>
        <p className="text-muted-foreground mt-1">
          Dimensiona gli interventi di efficientamento energetico
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configurazione FV + BESS */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="w-5 h-5 text-energy-amber" />
                Impianto Fotovoltaico
              </CardTitle>
              <CardDescription>
                Dimensiona la potenza di picco dell'impianto FV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigSlider
                label="Potenza FV"
                value={config.pvPower_kWp}
                min={0}
                max={500}
                step={5}
                unit="kWp"
                icon={Sun}
                color="gradient-amber"
                onChange={(v) => setConfig({ pvPower_kWp: v })}
              />
              {config.pvPower_kWp > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-muted/30 text-sm">
                  <p className="text-muted-foreground">
                    Produzione stimata:{" "}
                    <span className="text-energy-amber font-medium">
                      {formatEnergy(config.pvPower_kWp * 1200)}
                    </span>
                    /anno (1200 ore eq.)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Battery className="w-5 h-5 text-energy-green" />
                Sistema di Accumulo (BESS)
              </CardTitle>
              <CardDescription>
                Configura capacita e potenza della batteria
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ConfigSlider
                label="Capacita Batteria"
                value={config.bessCapacity_kWh}
                min={0}
                max={300}
                step={5}
                unit="kWh"
                icon={Battery}
                color="gradient-green"
                onChange={(v) => setConfig({ bessCapacity_kWh: v })}
              />
              <ConfigSlider
                label="Potenza Batteria"
                value={config.bessPower_kW}
                min={0}
                max={150}
                step={5}
                unit="kW"
                icon={Battery}
                color="gradient-green"
                onChange={(v) => setConfig({ bessPower_kW: v })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Altri Interventi</CardTitle>
              <CardDescription>
                Pompa di calore e illuminazione LED
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ConfigSlider
                label="Pompa di Calore"
                value={config.heatPumpPower_kW}
                min={0}
                max={200}
                step={5}
                unit="kW"
                icon={Thermometer}
                color="gradient-red"
                onChange={(v) => setConfig({ heatPumpPower_kW: v })}
              />
              <ConfigSlider
                label="Risparmio LED"
                value={config.ledSavings_percent}
                min={0}
                max={50}
                step={5}
                unit="%"
                icon={Lightbulb}
                color="gradient-blue"
                onChange={(v) => setConfig({ ledSavings_percent: v })}
              />
            </CardContent>
          </Card>
        </div>

        {/* Riepilogo Real-time */}
        <div className="space-y-6">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Anteprima Risultati</CardTitle>
              <CardDescription>Aggiornamento in tempo reale</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {kpis ? (
                <>
                  <div className="p-3 rounded-lg bg-energy-green/10 border border-energy-green/20">
                    <p className="text-xs text-muted-foreground">Autoconsumo</p>
                    <p className="text-xl font-bold text-energy-green">
                      {formatPercent(kpis.autoconsumo)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-energy-blue/10 border border-energy-blue/20">
                    <p className="text-xs text-muted-foreground">Autosufficienza</p>
                    <p className="text-xl font-bold text-energy-blue">
                      {formatPercent(kpis.autosufficienza)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">Produzione FV</p>
                    <p className="text-xl font-bold text-foreground">
                      {formatEnergy(kpis.produzioneFV * 1000)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">CO2 Risparmiata</p>
                    <p className="text-xl font-bold text-energy-green">
                      {formatNumber(kpis.co2Risparmiata, 1)} ton/anno
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Configura gli impianti per vedere l'anteprima
                </p>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCurrentStep("data")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Indietro
            </Button>
            <Button
              className="flex-1"
              onClick={() => setCurrentStep("financials")}
              disabled={config.pvPower_kWp === 0 && config.bessCapacity_kWh === 0}
            >
              Avanti
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
