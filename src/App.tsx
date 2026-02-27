import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Checkout from "./pages/Checkout";
import Success from "./pages/Success";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ClaimAccess from "./pages/ClaimAccess";
import MembersDashboard from "./pages/members/Dashboard";
import LessonView from "./pages/members/LessonView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

import { ErrorBoundary } from "@/components/ui/error-boundary";

const App = () => (
  <ErrorBoundary name="App">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Checkout />} />
            <Route path="/checkout/:productId" element={<Checkout />} />
            <Route path="/success" element={<Success />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin" element={
              <ErrorBoundary name="Rota Admin">
                <Admin />
              </ErrorBoundary>
            } />
            <Route path="/members/claim" element={<ClaimAccess />} />
            <Route path="/members" element={<MembersDashboard />} />
            <Route path="/members/lesson/:lessonId" element={<LessonView />} />
            {/* Suporte para hash routing legado */}
            <Route path="/#/admin" element={<Navigate to="/admin" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
