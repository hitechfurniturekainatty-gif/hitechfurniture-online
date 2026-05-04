import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { BacklogShortcut } from "@/components/admin/BacklogShortcut";
import { AdminOnly } from "@/components/admin/AdminOnly";

// Eager: home page (LCP-critical, almost always the entry point)
import Index from "./pages/Index.tsx";

// Lazy-loaded: every other route. Big wins:
// - PDF library (@react-pdf/renderer ~600kb) only loads when admin opens the editor
// - Public visitors never download admin code
// - Each route becomes its own chunk → faster first paint, better caching
const Catalog = lazy(() => import("./pages/Catalog.tsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview.tsx"));
const AdminMyWork = lazy(() => import("./pages/admin/AdminMyWork.tsx"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories.tsx"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts.tsx"));
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff.tsx"));
const AdminWorkers = lazy(() => import("./pages/admin/AdminWorkers.tsx"));
const AdminWorkerDetail = lazy(() => import("./pages/admin/AdminWorkerDetail.tsx"));
const AdminMeasurementTasks = lazy(() => import("./pages/admin/AdminMeasurementTasks.tsx"));
const AdminQuotations = lazy(() => import("./pages/admin/AdminQuotations.tsx"));
const AdminQuotationEditor = lazy(() => import("./pages/admin/AdminQuotationEditor.tsx"));
const AdminQuotationPreview = lazy(() => import("./pages/admin/AdminQuotationPreview.tsx"));
const AdminRoutes = lazy(() => import("./pages/admin/AdminRoutes.tsx"));
const AdminLogistics = lazy(() => import("./pages/admin/AdminLogistics.tsx"));
const AdminTrips = lazy(() => import("./pages/admin/AdminTrips.tsx"));
const AdminMyTrips = lazy(() => import("./pages/admin/AdminMyTrips.tsx"));
const AdminServices = lazy(() => import("./pages/admin/AdminServices.tsx"));
const AdminServiceEditor = lazy(() => import("./pages/admin/AdminServiceEditor.tsx"));
const AdminComplaintEditor = lazy(() => import("./pages/admin/AdminComplaintEditor.tsx"));
const AdminTrash = lazy(() => import("./pages/admin/AdminTrash.tsx"));
const AdminHomePage = lazy(() => import("./pages/admin/AdminHomePage.tsx"));
const AdminReceivables = lazy(() => import("./pages/admin/AdminReceivables.tsx"));
const AdminBacklog = lazy(() => import("./pages/admin/AdminBacklog.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const WorkerLogin = lazy(() => import("./pages/WorkerLogin.tsx"));
const WorkerPortal = lazy(() => import("./pages/WorkerPortal.tsx"));
const WorkerJobView = lazy(() => import("./pages/WorkerJobView.tsx"));
const DeliveryNote = lazy(() => import("./pages/DeliveryNote.tsx"));

// React Query tuned for many concurrent users:
// - staleTime 60s avoids hammering the DB on every navigation
// - refetchOnWindowFocus disabled to cut redundant requests
// - 1 retry only so slow networks fail fast instead of compounding load
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-7 w-7 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <BacklogShortcut />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/my-work" element={<AdminMyWork />} />
            <Route path="/admin/categories" element={<AdminOnly><AdminCategories /></AdminOnly>} />
            <Route path="/admin/products" element={<AdminOnly><AdminProducts /></AdminOnly>} />
            <Route path="/admin/staff" element={<AdminOnly><AdminStaff /></AdminOnly>} />
            <Route path="/admin/workers" element={<AdminOnly><AdminWorkers /></AdminOnly>} />
            <Route path="/admin/workers/:id" element={<AdminOnly><AdminWorkerDetail /></AdminOnly>} />
            <Route path="/admin/measurement-tasks" element={<AdminMeasurementTasks />} />
            <Route path="/admin/quotations" element={<AdminQuotations />} />
            <Route path="/admin/quotations/:id" element={<AdminQuotationEditor />} />
            <Route path="/admin/quotations/:id/preview" element={<AdminQuotationPreview />} />
            <Route path="/admin/routes" element={<AdminOnly><AdminRoutes /></AdminOnly>} />
            <Route path="/admin/logistics" element={<AdminLogistics />} />
            <Route path="/admin/trips" element={<AdminTrips />} />
            <Route path="/admin/my-trips" element={<AdminMyTrips />} />
            <Route path="/admin/services" element={<AdminServices />} />
            <Route path="/admin/services/:id" element={<AdminServiceEditor />} />
            <Route path="/admin/complaints/:id" element={<AdminComplaintEditor />} />
            <Route path="/admin/trash" element={<AdminOnly><AdminTrash /></AdminOnly>} />
            <Route path="/admin/home-page" element={<AdminOnly><AdminHomePage /></AdminOnly>} />
            <Route path="/admin/backlog" element={<AdminBacklog />} />
            {/* Legacy direct path also gated by Backlog */}
            <Route path="/admin/receivables" element={<AdminBacklog />} />
            <Route path="/worker/login" element={<WorkerLogin />} />
            <Route path="/worker" element={<WorkerPortal />} />
            <Route path="/worker/job/:jobId" element={<WorkerJobView />} />
            <Route path="/delivery-note/:id" element={<DeliveryNote />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
