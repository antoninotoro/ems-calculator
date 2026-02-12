"use client";

import React from "react";
import {
  Zap,
  BarChart3,
  Settings,
  FileSpreadsheet,
  Sun,
  Battery,
  Wallet,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEnergyStore, useStepValidation } from "@/lib/store/useEnergyStore";
import { WizardStep } from "@/lib/types/energy";

interface SidebarProps {
  collapsed?: boolean;
}

const steps: {
  id: WizardStep;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    id: "data",
    label: "Dati",
    icon: FileSpreadsheet,
    description: "Carica profilo di carico",
  },
  {
    id: "config",
    label: "Impianti",
    icon: Sun,
    description: "Configura FV e batteria",
  },
  {
    id: "financials",
    label: "Economia",
    icon: Wallet,
    description: "Parametri finanziari",
  },
  {
    id: "results",
    label: "Risultati",
    icon: BarChart3,
    description: "Dashboard e report",
  },
];

export function Sidebar({ collapsed = false }: SidebarProps) {
  const currentStep = useEnergyStore((state) => state.currentStep);
  const setCurrentStep = useEnergyStore((state) => state.setCurrentStep);
  const hasData = useEnergyStore((state) => state.hasData);
  const validation = useStepValidation();

  const isStepEnabled = (stepId: WizardStep): boolean => {
    switch (stepId) {
      case "data":
        return true;
      case "config":
        return validation.canGoToConfig;
      case "financials":
        return validation.canGoToFinancials;
      case "results":
        return validation.canGoToResults;
      default:
        return false;
    }
  };

  const getStepStatus = (
    stepId: WizardStep
  ): "completed" | "current" | "upcoming" | "disabled" => {
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    const currentIndex = steps.findIndex((s) => s.id === currentStep);

    if (!isStepEnabled(stepId)) return "disabled";
    if (stepId === currentStep) return "current";
    if (stepIndex < currentIndex && hasData) return "completed";
    return "upcoming";
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-secondary border-r border-border flex flex-col z-50 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-blue flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-bold text-lg text-foreground">EMS</h1>
              <p className="text-xs text-muted-foreground">Calculator</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Steps */}
      <nav className="flex-1 py-4 px-2">
        <div className="space-y-1">
          {steps.map((step, index) => {
            const status = getStepStatus(step.id);
            const Icon = step.icon;

            return (
              <button
                key={step.id}
                onClick={() => isStepEnabled(step.id) && setCurrentStep(step.id)}
                disabled={status === "disabled"}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
                  "hover:bg-muted/50",
                  status === "current" && "bg-accent/10 border border-accent/30",
                  status === "completed" && "text-energy-green",
                  status === "disabled" && "opacity-40 cursor-not-allowed",
                  collapsed && "justify-center"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium shrink-0",
                    status === "current" && "bg-accent text-white",
                    status === "completed" && "bg-energy-green/20 text-energy-green",
                    status === "upcoming" && "bg-muted text-muted-foreground",
                    status === "disabled" && "bg-muted/50 text-muted-foreground/50"
                  )}
                >
                  {status === "completed" ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                {!collapsed && (
                  <div className="text-left">
                    <p
                      className={cn(
                        "font-medium text-sm",
                        status === "current" && "text-accent",
                        status === "completed" && "text-energy-green",
                        status === "disabled" && "text-muted-foreground/50"
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        {!collapsed && (
          <div className="text-xs text-muted-foreground">
            <p>EMS Calculator v1.0</p>
            <p className="mt-1">Simulazione C&I / B2G</p>
          </div>
        )}
      </div>
    </aside>
  );
}
