"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Dashboard } from "@/components/dashboard/Dashboard";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* TopBar */}
      <TopBar />

      {/* Main Content */}
      <main className="ml-64 pt-16">
        <div className="p-6 max-w-7xl mx-auto">
          <Dashboard />
        </div>
      </main>
    </div>
  );
}
