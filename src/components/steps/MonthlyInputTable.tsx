"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArrowRight, TableProperties, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEnergyStore } from "@/lib/store/useEnergyStore";
import { MonthlyConsumptionRow } from "@/lib/types/energy";

const MONTH_NAMES = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const MONTH_ABBR_MAP: Record<string, number> = {
  gen: 0, feb: 1, mar: 2, apr: 3, mag: 4, giu: 5,
  lug: 6, ago: 7, set: 8, ott: 9, nov: 10, dic: 11,
};

// --- Helpers ---

function getInitialMonths(): MonthlyConsumptionRow[] {
  const rows: MonthlyConsumptionRow[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
    rows.push({ month: d.getMonth(), year: d.getFullYear(), f1: 0, f2: 0, f3: 0 });
  }
  return rows;
}

function formatMonthYear(month: number, year: number): string {
  return `${MONTH_NAMES[month]}-${String(year).slice(2)}`;
}

/** Converte una stringa in formato italiano (1.234,56) in numero */
function parseItalianNumber(value: string): number {
  const cleaned = value.trim().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** Formatta un numero intero in formato italiano (1.234) */
function formatItalianInt(value: number): string {
  if (!value) return "";
  return Math.round(value).toLocaleString("it-IT");
}

/** Riconosce "dic-24", "gen-25", "Mar-2025" ecc. */
function parseMonthYear(cell: string): { month: number; year: number } | null {
  const match = cell.trim().toLowerCase().match(/^([a-z]{3})[-.\s/]?(\d{2,4})$/);
  if (!match) return null;
  const monthNum = MONTH_ABBR_MAP[match[1]];
  if (monthNum === undefined) return null;
  const yearRaw = parseInt(match[2]);
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  return { month: monthNum, year };
}

type Field = "f1" | "f2" | "f3";
type CellKey = `${number}-${Field}`;

// --- Component ---

export function MonthlyInputTable() {
  const { manualInput, setMonthlyData, applyMonthlyInput } = useEnergyStore();

  const [rows, setRows] = useState<MonthlyConsumptionRow[]>(
    manualInput.monthlyData && manualInput.monthlyData.length === 12
      ? manualInput.monthlyData
      : getInitialMonths()
  );

  // Testo in editing per ogni cella (formato grezzo mentre si digita)
  const [editText, setEditText] = useState<Partial<Record<CellKey, string>>>({});

  useEffect(() => {
    if (manualInput.monthlyData && manualInput.monthlyData.length === 12) {
      setRows(manualInput.monthlyData);
    }
  }, [manualInput.monthlyData]);

  const key = (idx: number, field: Field): CellKey => `${idx}-${field}`;

  const handleFocus = (idx: number, field: Field) => {
    const val = rows[idx][field];
    setEditText((prev) => ({ ...prev, [key(idx, field)]: val ? String(Math.round(val)) : "" }));
  };

  const handleChange = (idx: number, field: Field, text: string) => {
    setEditText((prev) => ({ ...prev, [key(idx, field)]: text }));
  };

  const handleBlur = (idx: number, field: Field) => {
    const k = key(idx, field);
    const text = editText[k] ?? "";
    const num = parseItalianNumber(text);
    const updated = rows.map((row, i) => (i === idx ? { ...row, [field]: num } : row));
    setRows(updated);
    setMonthlyData(updated);
    setEditText((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  const getDisplayValue = (idx: number, field: Field): string => {
    const k = key(idx, field);
    if (k in editText) return editText[k] ?? "";
    return formatItalianInt(rows[idx][field]);
  };

  /**
   * Gestisce incolla da Excel/Spreadsheet.
   * Formato atteso: colonne tab-separate, righe a capo.
   * Prima colonna: Mese/Anno (es. "dic-24"), poi F1, F2, F3 [, Totale ignorato]
   */
  const handleCellPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text");

      // Se non contiene tab → incolla normale nella cella
      if (!text.includes("\t") && !text.includes("\n")) return;

      e.preventDefault();

      const lines = text.trim().split(/\r?\n/);
      const updatedRows = [...rows];
      let anyUpdated = false;

      for (const line of lines) {
        if (!line.trim()) continue;
        const cols = line.split("\t");

        // Prima colonna = mese
        const monthYear = parseMonthYear(cols[0]);
        if (!monthYear) continue; // intestazione o riga non riconosciuta

        const rowIdx = updatedRows.findIndex(
          (r) => r.month === monthYear.month && r.year === monthYear.year
        );
        if (rowIdx === -1) continue;

        const f1 = cols[1] !== undefined ? parseItalianNumber(cols[1]) : updatedRows[rowIdx].f1;
        const f2 = cols[2] !== undefined ? parseItalianNumber(cols[2]) : updatedRows[rowIdx].f2;
        const f3 = cols[3] !== undefined ? parseItalianNumber(cols[3]) : updatedRows[rowIdx].f3;

        updatedRows[rowIdx] = { ...updatedRows[rowIdx], f1, f2, f3 };
        anyUpdated = true;
      }

      if (anyUpdated) {
        setRows(updatedRows);
        setMonthlyData(updatedRows);
        setEditText({});
      }
    },
    [rows, setMonthlyData]
  );

  const totF1 = rows.reduce((s, r) => s + r.f1, 0);
  const totF2 = rows.reduce((s, r) => s + r.f2, 0);
  const totF3 = rows.reduce((s, r) => s + r.f3, 0);
  const totTotal = totF1 + totF2 + totF3;

  const fieldStyle = (field: Field) =>
    `h-7 w-full text-right text-xs rounded border px-2 bg-background focus:outline-none focus:ring-1 ${
      field === "f1"
        ? "bg-energy-blue/5 border-energy-blue/30 focus:ring-energy-blue/50"
        : field === "f2"
        ? "bg-energy-amber/5 border-energy-amber/30 focus:ring-energy-amber/50"
        : "bg-energy-green/5 border-energy-green/30 focus:ring-energy-green/50"
    }`;

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center gap-2 mb-2">
        <TableProperties className="w-4 h-4 text-accent" />
        <span className="font-medium text-sm">Tabella Consumi Mensili (F1/F2/F3)</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
        <Clipboard className="w-3 h-3 shrink-0" />
        Puoi incollare direttamente da Excel — colonne: Mese/Anno, F1, F2, F3
        &nbsp;·&nbsp; Formato numeri: separatore migliaia <strong>.</strong> e decimali <strong>,</strong>
      </p>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20">Mese/Anno</th>
              <th className="text-right px-2 py-2 font-medium text-energy-blue w-28">F1 (kWh)</th>
              <th className="text-right px-2 py-2 font-medium text-energy-amber w-28">F2 (kWh)</th>
              <th className="text-right px-2 py-2 font-medium text-energy-green w-28">F3 (kWh)</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">Totale (kWh)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const rowTotal = row.f1 + row.f2 + row.f3;
              return (
                <tr key={idx} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-1.5 font-mono text-foreground font-medium">
                    {formatMonthYear(row.month, row.year)}
                  </td>
                  {(["f1", "f2", "f3"] as const).map((field) => (
                    <td key={field} className="px-2 py-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={getDisplayValue(idx, field)}
                        placeholder="0"
                        onFocus={() => handleFocus(idx, field)}
                        onChange={(e) => handleChange(idx, field, e.target.value)}
                        onBlur={() => handleBlur(idx, field)}
                        onPaste={handleCellPaste}
                        className={fieldStyle(field)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-semibold text-foreground">
                    {rowTotal > 0 ? rowTotal.toLocaleString("it-IT") : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/50 border-t-2 border-border font-semibold">
              <td className="px-3 py-2 text-muted-foreground uppercase text-[10px] tracking-wide">Totale</td>
              <td className="px-3 py-2 text-right text-energy-blue">{totF1 > 0 ? totF1.toLocaleString("it-IT") : "-"}</td>
              <td className="px-3 py-2 text-right text-energy-amber">{totF2 > 0 ? totF2.toLocaleString("it-IT") : "-"}</td>
              <td className="px-3 py-2 text-right text-energy-green">{totF3 > 0 ? totF3.toLocaleString("it-IT") : "-"}</td>
              <td className="px-3 py-2 text-right text-foreground">{totTotal > 0 ? totTotal.toLocaleString("it-IT") : "-"}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Button
        variant="secondary"
        className="w-full mt-4"
        onClick={applyMonthlyInput}
        disabled={totTotal <= 0}
      >
        <ArrowRight className="w-4 h-4 mr-2" />
        Applica Dati Mensili
      </Button>
    </div>
  );
}
