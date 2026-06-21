import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectPhases from "./pages/ProjectPhases";
import ProjectBilling from "./pages/ProjectBilling";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import AllEntries from "./pages/AllEntries";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/project/:projectId" element={<ProjectDetail />} />
          <Route path="/project/:projectId/phases" element={<ProjectPhases />} />
          <Route path="/project/:projectId/billing" element={<ProjectBilling />} />
          <Route path="/project/:projectId/billing/:invoiceId" element={<InvoiceDetailPage />} />
          <Route path="/entries" element={<AllEntries />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
};

export default App;
