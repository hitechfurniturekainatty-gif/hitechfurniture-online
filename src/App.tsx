import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Catalog from "./pages/Catalog.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import Auth from "./pages/Auth.tsx";
import AdminOverview from "./pages/admin/AdminOverview.tsx";
import AdminCategories from "./pages/admin/AdminCategories.tsx";
import AdminProducts from "./pages/admin/AdminProducts.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
