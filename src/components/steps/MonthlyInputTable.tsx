"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, TableProperties } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEnergyStore } from "@/lib/store/useEnergyStore";
import { MonthlyConsumptionRow } from "@/lib/types/energy";

const MONTH_NAMES = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

function getInitialMonths(): MonthlyConsumptionRow[] {
  const rows: MonthlyConsumptionRow[] = [];
  const now = new Date();
  // 12 mesi completi: dal mese più vecchio al mese corrente - 1
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
    rows.push({ month: d.getMonth(), year: d.getFullYear(), f1: 0, f2: 0, f3: 0 });
  }
  return rows;
}

function formatMonthYear(month: number, year: number): string {
  return `${MONTH_NAMES[month]}-${String(year).slice(2)}`;
}

export function MonthlyInputTable() {
  const { manualInput, setMonthlyData, applyMonthlyInput } = useEnergyStore();

  const [rows, setRows] = useState<MonthlyConsumptionRow[]>(
    manualInput.monthlyData && manualInput.monthlyData.length === 12
      ? manualInput.monthlyData
      : getInitialMonths()
  );

  // Sincronizza con lo store se i dati cambiano dall'esterno
  useEffect(() => {
    if (manualInput.monthlyData && manualInput.monthlyData.length === 12) {
      setRows(manualInput.monthlyData);
    }
  }, [manualInput.monthlyData]);

  const updateCell = (
    index: number,
    field: "f1" | "f2" | "f3",
    value: string
  ) => {
    const updated = rows.map((row, i) =>
      i === index ? { ...row, [field]: parseFloat(value) || 0 } : row
    );
    setRows(updated);
    setMonthlyData(updated);
  };

  const totF1 = rows.reduce((s, r) => s + r.f1, 0);
  const totF2 = rows.reduce((s, r) => s + r.f2, 0);
  const totF3 = rows.reduce((s, r) => s + r.f3, 0);
  const totTotal = totF1 + totF2 + totF3;

  const canApply = totTotal > 0;

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center gap-2 mb-4">
        <TableProperties className="w-4 h-4 text-accent" />
        <span className="font-medium text-sm">Tabella Consumi Mensili (F1/F2/F3)</span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20">
                Mese/Anno
              </th>
              <th className="text-right px-3 py-2 font-medium text-energy-blue w-28">
                F1 (kWh)
              </th>
              <th className="text-right px-3 py-2 font-medium text-energy-amber w-28">
                F2 (kWh)
              </th>
              <th className="text-right px-3 py-2 font-medium text-energy-green w-28">
                F3 (kWh)
              </th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">
                Totale (kWh)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const rowTotal = row.f1 + row.f2 + row.f3;
              return (
                <tr
                  key={idx}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-3 py-1.5 font-mono text-foreground font-medium">
                    {formatMonthYear(row.month, row.year)}
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={row.f1 || ""}
                      placeholder="0"
                      onChange={(e) => updateCell(idx, "f1", e.target.value)}
                      className="h-7 text-right text-xs bg-energy-blue/5 border-energy-blue/30 focus:border-energy-blue w-full"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={row.f2 || ""}
                      placeholder="0"
                      onChange={(e) => updateCell(idx, "f2", e.target.value)}
                      className="h-7 text-right text-xs bg-energy-amber/5 border-energy-amber/30 focus:border-energy-amber w-full"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={row.f3 || ""}
                      placeholder="0"
                      onChange={(e) => updateCell(idx, "f3", e.target.value)}
                      className="h-7 text-right text-xs bg-energy-green/5 border-energy-green/30 focus:border-energy-green w-full"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-foreground">
                    {rowTotal > 0 ? rowTotal.toLocaleString("it-IT") : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/50 border-t-2 border-border font-semibold">
              <td className="px-3 py-2 text-muted-foreground uppercase text-[10px] tracking-wide">
                Totale
              </td>
              <td className="px-3 py-2 text-right text-energy-blue">
                {totF1 > 0 ? totF1.toLocaleString("it-IT") : "-"}
              </td>
              <td className="px-3 py-2 text-right text-energy-amber">
                {totF2 > 0 ? totF2.toLocaleString("it-IT") : "-"}
              </td>
              <td className="px-3 py-2 text-right text-energy-green">
                {totF3 > 0 ? totF3.toLocaleString("it-IT") : "-"}
              </td>
              <td className="px-3 py-2 text-right text-foreground">
                {totTotal > 0 ? totTotal.toLocaleString("it-IT") : "-"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Button
        variant="secondary"
        className="w-full mt-4"
        onClick={applyMonthlyInput}
        disabled={!canApply}
      >
        <ArrowRight className="w-4 h-4 mr-2" />
        Applica Dati Mensili
      </Button>
    </div>
  );
}
