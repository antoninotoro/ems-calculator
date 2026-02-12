"use client";

import React from "react";
import { useEnergyStore } from "@/lib/store/useEnergyStore";
import { DataStep } from "@/components/steps/DataStep";
import { ConfigStep } from "@/components/steps/ConfigStep";
import { FinancialsStep } from "@/components/steps/FinancialsStep";
import { ResultsStep } from "@/components/steps/ResultsStep";

export function Dashboard() {
  const currentStep = useEnergyStore((state) => state.currentStep);

  const renderStep = () => {
    switch (currentStep) {
      case "data":
        return <DataStep />;
      case "config":
        return <ConfigStep />;
      case "financials":
        return <FinancialsStep />;
      case "results":
        return <ResultsStep />;
      default:
        return <DataStep />;
    }
  };

  return (
    <div className="min-h-screen">
      {renderStep()}
    </div>
  );
}
