import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import PRFMonitoring from "./pages/PRFMonitoring";
import BudgetOverview from "./pages/BudgetOverview";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="prf" element={<PRFMonitoring />} />
            <Route path="budget" element={<BudgetOverview />} />
            <Route path="reports" element={<div className="p-6">Reports coming soon...</div>} />
            <Route path="alerts" element={<div className="p-6">Alerts coming soon...</div>} />
            <Route path="settings" element={<div className="p-6">Settings coming soon...</div>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
