"use client";

import { useState, useCallback } from "react";
import { useEnergyStore } from "@/lib/store/useEnergyStore";
import { extractTextFromPDF } from "@/lib/calculations/PDFParser";
import { BillDataInfo } from "@/lib/types/energy";

export function usePDFExtraction() {
  const { addFiles, addPDFWithConfirmedData } = useEnergyStore();

  const [pendingPDFFile, setPendingPDFFile] = useState<File | null>(null);
  const [pendingBillData, setPendingBillData] = useState<BillDataInfo | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pdfQueue, setPdfQueue] = useState<File[]>([]);

  const processNextPDF = useCallback(async (file: File, remainingQueue: File[]) => {
    setPendingPDFFile(file);
    setIsExtracting(true);
    setShowConfirmModal(true);
    setPdfQueue(remainingQueue);

    try {
      const rawText = await extractTextFromPDF(file);
      const response = await fetch("/api/extract-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });

      if (!response.ok) {
        throw new Error("Errore API");
      }

      const { data } = await response.json();
      setPendingBillData({
        ragioneSociale: data.ragioneSociale || undefined,
        podCode: data.podCode || undefined,
        supplier: data.supplier || undefined,
        city: data.city || undefined,
        province: data.province || undefined,
        potenzaImpegnata: data.potenzaImpegnata || undefined,
        f1: data.f1 || 0,
        f2: data.f2 || 0,
        f3: data.f3 || 0,
        totalConsumption: data.totalConsumption || 0,
        billingMonths: data.billingMonths || 1,
        prezzoMedio: data.prezzoMedio || undefined,
      });
      setIsExtracting(false);
    } catch (error) {
      console.warn("[usePDFExtraction] LLM extraction failed, falling back to regex:", error);
      setIsExtracting(false);
      setShowConfirmModal(false);
      setPendingPDFFile(null);
      setPendingBillData(null);
      // Fallback al parser regex
      await addFiles([file]);
      // Processa il prossimo in coda
      if (remainingQueue.length > 0) {
        processNextPDF(remainingQueue[0], remainingQueue.slice(1));
      }
    }
  }, [addFiles]);

  const handleFilesSelected = useCallback(
    async (fileList: File[]) => {
      const csvFiles = fileList.filter(
        (f) => !f.name.toLowerCase().endsWith(".pdf")
      );
      const pdfFiles = fileList.filter((f) =>
        f.name.toLowerCase().endsWith(".pdf")
      );

      // CSV vanno direttamente nel flusso normale
      if (csvFiles.length > 0) {
        await addFiles(csvFiles);
      }

      // PDF: avvia il flusso LLM per il primo, accoda il resto
      if (pdfFiles.length > 0) {
        processNextPDF(pdfFiles[0], pdfFiles.slice(1));
      }
    },
    [addFiles, processNextPDF]
  );

  const handleConfirmBillData = useCallback(
    (confirmedData: BillDataInfo) => {
      if (pendingPDFFile) {
        addPDFWithConfirmedData(pendingPDFFile, confirmedData);
      }
      setShowConfirmModal(false);
      setPendingPDFFile(null);
      setPendingBillData(null);
      // Processa il prossimo PDF in coda
      if (pdfQueue.length > 0) {
        processNextPDF(pdfQueue[0], pdfQueue.slice(1));
      }
    },
    [pendingPDFFile, addPDFWithConfirmedData, pdfQueue, processNextPDF]
  );

  const handleCancelBillData = useCallback(async () => {
    // Fallback: usa il parser regex
    if (pendingPDFFile) {
      await addFiles([pendingPDFFile]);
    }
    setShowConfirmModal(false);
    setPendingPDFFile(null);
    setPendingBillData(null);
    // Processa il prossimo PDF in coda
    if (pdfQueue.length > 0) {
      processNextPDF(pdfQueue[0], pdfQueue.slice(1));
    }
  }, [pendingPDFFile, addFiles, pdfQueue, processNextPDF]);

  return {
    handleFilesSelected,
    handleConfirmBillData,
    handleCancelBillData,
    showConfirmModal,
    pendingBillData,
    pendingPDFFile,
    isExtracting,
  };
}
