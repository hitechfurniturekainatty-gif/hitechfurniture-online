import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { BacklogShortcut } from "@/components/admin/BacklogShortcut";
import { AdminOnly } from "@/components/admin/AdminOnly";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { GlobalNotesWindow } from "@/components/admin/GlobalNotesWindow";
import { EnquiryForm } from "@/components/EnquiryForm";

// Eager: home page (LCP-critical, almost always the entry point)
import Index from "./pages/Index.tsx";

// Legacy /admin/services/:id and /admin/complaints/:id URLs now redirect to
// the unified Enquiries Inbox detail sheet (canonical screen).
const EnquiryRedirect = ({ kind }: { kind: "complaint" | "service" }) => {
  const { id } = useParams();
  return <Navigate to={`/admin/enquiries?open=${kind}:${id}`} replace />;
};

// Lazy-loaded: every other route. Big wins:
// - PDF library (@react-pdf/renderer ~600kb) only loads when admin opens the editor
// - Public visitors never download admin code
// - Each route becomes its own chunk → faster first paint, better caching
const Catalog = lazy(() => import("./pages/Catalog.tsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview.tsx"));
const AdminMyWork = lazy(() => import("./pages/admin/AdminMyWork.tsx"));
const AdminEnquiriesInbox = lazy(() => import("./pages/admin/AdminEnquiriesInbox.tsx"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories.tsx"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts.tsx"));
const AdminProductBulkCreate = lazy(() => import("./pages/admin/AdminProductBulkCreate.tsx"));
const AdminInventoryLedger = lazy(() => import("./pages/admin/AdminInventoryLedger.tsx"));
const AdminInventoryReorder = lazy(() => import("./pages/admin/AdminInventoryReorder.tsx"));
const AdminInventoryReceiving = lazy(() => import("./pages/admin/AdminInventoryReceiving.tsx"));
const AdminInventoryStockTake = lazy(() => import("./pages/admin/AdminInventoryStockTake.tsx"));
const AdminInventoryTransfers = lazy(() => import("./pages/admin/AdminInventoryTransfers.tsx"));
const AdminBundles = lazy(() => import("./pages/admin/AdminBundles.tsx"));
const AdminBundleEditor = lazy(() => import("./pages/admin/AdminBundleEditor.tsx"));
const AdminBundleBulkCreate = lazy(() => import("./pages/admin/AdminBundleBulkCreate.tsx"));
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff.tsx"));
const AdminWorkers = lazy(() => import("./pages/admin/AdminWorkers.tsx"));
const AdminWorkerDetail = lazy(() => import("./pages/admin/AdminWorkerDetail.tsx"));
const AdminProductionBoard = lazy(() => import("./pages/admin/AdminProductionBoard.tsx"));
const AdminMeasurementTasks = lazy(() => import("./pages/admin/AdminMeasurementTasks.tsx"));
const AdminQuotations = lazy(() => import("./pages/admin/AdminQuotations.tsx"));
const AdminQuotationEditor = lazy(() => import("./pages/admin/AdminQuotationEditor.tsx"));
const AdminQuotationPreview = lazy(() => import("./pages/admin/AdminQuotationPreview.tsx"));
const AdminQuotationBulkCreate = lazy(() => import("./pages/admin/AdminQuotationBulkCreate.tsx"));
const AdminSchemeCalculator = lazy(() => import("./pages/admin/AdminSchemeCalculator.tsx"));
const AdminRoutes = lazy(() => import("./pages/admin/AdminRoutes.tsx"));
const AdminVehicles = lazy(() => import("./pages/admin/AdminVehicles.tsx"));
const AdminLogistics = lazy(() => import("./pages/admin/AdminLogistics.tsx"));
const AdminWarehouse = lazy(() => import("./pages/admin/AdminWarehouse.tsx"));
const AdminTrips = lazy(() => import("./pages/admin/AdminTrips.tsx"));
const AdminMyTrips = lazy(() => import("./pages/admin/AdminMyTrips.tsx"));
const AdminServices = lazy(() => import("./pages/admin/AdminServices.tsx"));
const AdminTrash = lazy(() => import("./pages/admin/AdminTrash.tsx"));
const AdminHomePage = lazy(() => import("./pages/admin/AdminHomePage.tsx"));
const AdminReceivables = lazy(() => import("./pages/admin/AdminReceivables.tsx"));
const AdminBacklog = lazy(() => import("./pages/admin/AdminBacklog.tsx"));
const AdminStaffMonitor = lazy(() => import("./pages/admin/AdminStaffMonitor.tsx"));
const AdminPipelineMonitor = lazy(() => import("./pages/admin/AdminPipelineMonitor.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const WorkerLogin = lazy(() => import("./pages/WorkerLogin.tsx"));
const WorkerPortal = lazy(() => import("./pages/WorkerPortal.tsx"));
const WorkerJobView = lazy(() => import("./pages/WorkerJobView.tsx"));
const SharedQuotationView = lazy(() => import("./pages/SharedQuotationView.tsx"));
const SharedJobView = lazy(() => import("./pages/SharedJobView.tsx"));
const DeliveryNote = lazy(() => import("./pages/DeliveryNote.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const EnquiryLink = lazy(() => import("./pages/EnquiryLink.tsx"));
const UserGuide = lazy(() => import("./pages/UserGuide.tsx"));
const StaffCatalog = lazy(() => import("./pages/StaffCatalog.tsx"));
const BundleDetail = lazy(() => import("./pages/BundleDetail.tsx"));
const AdminVault = lazy(() => import("./pages/admin/AdminVault.tsx"));

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
        {/* Floating internal-notes window — rendered at root so it persists
            across image picker, gallery, and other in-page dialogs. */}
        <GlobalNotesWindow />
        {/* Global customer enquiry dialog — opened via openEnquiryForm() from
            anywhere (product cards, product detail, header, footer). */}
        <EnquiryForm />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/staff-catalog" element={<StaffCatalog />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/bundle/:id" element={<BundleDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/enquiry" element={<EnquiryLink />} />
            <Route path="/enquiry/:productId" element={<EnquiryLink />} />
            <Route path="/guide" element={<UserGuide />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/my-work" element={<AdminMyWork />} />
            <Route path="/admin/enquiries" element={<AdminEnquiriesInbox />} />
            <Route path="/admin/categories" element={<OfficeStaffOnly><AdminCategories /></OfficeStaffOnly>} />
            <Route path="/admin/products" element={<OfficeStaffOnly><AdminProducts /></OfficeStaffOnly>} />
            <Route path="/admin/products/bulk" element={<OfficeStaffOnly><AdminProductBulkCreate /></OfficeStaffOnly>} />
            <Route path="/admin/inventory/ledger" element={<OfficeStaffOnly><AdminInventoryLedger /></OfficeStaffOnly>} />
            <Route path="/admin/inventory/reorder" element={<OfficeStaffOnly><AdminInventoryReorder /></OfficeStaffOnly>} />
            <Route path="/admin/inventory/receiving" element={<OfficeStaffOnly><AdminInventoryReceiving /></OfficeStaffOnly>} />
            <Route path="/admin/inventory/stock-take" element={<OfficeStaffOnly><AdminInventoryStockTake /></OfficeStaffOnly>} />
            <Route path="/admin/inventory/transfers" element={<OfficeStaffOnly><AdminInventoryTransfers /></OfficeStaffOnly>} />
            <Route path="/admin/bundles" element={<OfficeStaffOnly><AdminBundles /></OfficeStaffOnly>} />
            <Route path="/admin/bundles/bulk" element={<OfficeStaffOnly><AdminBundleBulkCreate /></OfficeStaffOnly>} />
            <Route path="/admin/bundles/:id" element={<OfficeStaffOnly><AdminBundleEditor /></OfficeStaffOnly>} />
            <Route path="/admin/staff" element={<AdminOnly><AdminStaff /></AdminOnly>} />
            <Route path="/admin/people" element={<Navigate to="/admin/staff" replace />} />
            <Route path="/admin/staff-monitor" element={<AdminOnly><AdminStaffMonitor /></AdminOnly>} />
            <Route path="/admin/pipeline" element={<AdminOnly><AdminPipelineMonitor /></AdminOnly>} />
            <Route path="/admin/workers" element={<AdminOnly><AdminWorkers /></AdminOnly>} />
            <Route path="/admin/workers/:id" element={<AdminOnly><AdminWorkerDetail /></AdminOnly>} />
            <Route path="/admin/production" element={<OfficeStaffOnly><AdminProductionBoard /></OfficeStaffOnly>} />
            <Route path="/admin/measurement-tasks" element={<AdminMeasurementTasks />} />
            <Route path="/admin/quotations" element={<AdminQuotations />} />
            <Route path="/admin/quotations/bulk" element={<AdminQuotationBulkCreate />} />
            <Route path="/admin/scheme-calculator" element={<AdminOnly><AdminSchemeCalculator /></AdminOnly>} />
            <Route path="/admin/quotations/:id" element={<AdminQuotationEditor />} />
            <Route path="/admin/quotations/:id/preview" element={<AdminQuotationPreview />} />
            <Route path="/admin/routes" element={<AdminOnly><AdminRoutes /></AdminOnly>} />
            <Route path="/admin/vehicles" element={<AdminOnly><AdminVehicles /></AdminOnly>} />
            <Route path="/admin/logistics" element={<AdminLogistics />} />
            <Route path="/admin/warehouse" element={<AdminWarehouse />} />
            <Route path="/admin/trips" element={<AdminTrips />} />
            <Route path="/admin/my-trips" element={<AdminMyTrips />} />
            <Route path="/admin/services" element={<AdminServices />} />
            {/* Legacy editor URLs — redirect to the canonical Enquiries Inbox detail sheet. */}
            <Route path="/admin/services/:id" element={<EnquiryRedirect kind="service" />} />
            <Route path="/admin/complaints/:id" element={<EnquiryRedirect kind="complaint" />} />
            <Route path="/admin/trash" element={<AdminOnly><AdminTrash /></AdminOnly>} />
            <Route path="/admin/home-page" element={<AdminOnly><AdminHomePage /></AdminOnly>} />
            <Route path="/admin/backlog" element={<AdminBacklog />} />
            <Route path="/admin/vault" element={<AdminOnly><AdminVault /></AdminOnly>} />
            {/* Receivables is part of the Backlog area and requires the PIN */}
            <Route path="/admin/receivables" element={<AdminBacklog />} />
            <Route path="/worker/login" element={<WorkerLogin />} />
            <Route path="/worker" element={<WorkerPortal />} />
            <Route path="/worker/job/:jobId" element={<WorkerJobView />} />
            <Route path="/s/q/:token" element={<SharedQuotationView />} />
            <Route path="/s/d/:token" element={<SharedQuotationView hideAmounts />} />
            <Route path="/s/j/:token" element={<SharedJobView />} />
            <Route path="/delivery-note/:id" element={<DeliveryNote />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
