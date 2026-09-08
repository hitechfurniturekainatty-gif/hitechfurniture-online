import { pageLoaders } from "@/lib/routePreload";
import { RouteIntentPreloader } from "@/components/RouteIntentPreloader";
import { AuthProvider } from "@/hooks/useAuth";
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

import Index from "./pages/Index.tsx";

const EnquiryRedirect = ({ kind }: { kind: "complaint" | "service" }) => {
  const { id } = useParams();
  return <Navigate to={`/admin/enquiries?open=${kind}:${id}`} replace />;
};

const Catalog = lazy(pageLoaders.Catalog);
const Faq = lazy(pageLoaders.Faq);
const ProductDetail = lazy(pageLoaders.ProductDetail);
const Auth = lazy(pageLoaders.Auth);
const AdminOverview = lazy(pageLoaders.AdminOverview);
const AdminMyWork = lazy(pageLoaders.AdminMyWork);
const AdminEnquiriesInbox = lazy(pageLoaders.AdminEnquiriesInbox);
const AdminWhatsAppInbox = lazy(pageLoaders.AdminWhatsAppInbox);
const AdminCategories = lazy(pageLoaders.AdminCategories);
const AdminProducts = lazy(pageLoaders.AdminProducts);
const AdminProductBulkCreate = lazy(pageLoaders.AdminProductBulkCreate);
const AdminProductApproval = lazy(pageLoaders.AdminProductApproval);
const AdminInventoryLedger = lazy(pageLoaders.AdminInventoryLedger);
const AdminInventoryReorder = lazy(pageLoaders.AdminInventoryReorder);
const AdminInventoryReceiving = lazy(pageLoaders.AdminInventoryReceiving);
const AdminInventoryStockTake = lazy(pageLoaders.AdminInventoryStockTake);
const AdminInventoryTransfers = lazy(pageLoaders.AdminInventoryTransfers);
const AdminBundles = lazy(pageLoaders.AdminBundles);
const AdminBundleEditor = lazy(pageLoaders.AdminBundleEditor);
const AdminBundleBulkCreate = lazy(pageLoaders.AdminBundleBulkCreate);
const AdminStaff = lazy(pageLoaders.AdminStaff);
const AdminWorkers = lazy(pageLoaders.AdminWorkers);
const AdminWorkerDetail = lazy(pageLoaders.AdminWorkerDetail);
const AdminProductionBoard = lazy(pageLoaders.AdminProductionBoard);
const AdminMeasurementTasks = lazy(pageLoaders.AdminMeasurementTasks);
const AdminQuotations = lazy(pageLoaders.AdminQuotations);
const AdminQuotationEditor = lazy(pageLoaders.AdminQuotationEditor);
const AdminQuotationPreview = lazy(pageLoaders.AdminQuotationPreview);
const AdminQuotationBulkCreate = lazy(pageLoaders.AdminQuotationBulkCreate);
const AdminSchemeCalculator = lazy(pageLoaders.AdminSchemeCalculator);
const AdminRoutes = lazy(pageLoaders.AdminRoutes);
const AdminVehicles = lazy(pageLoaders.AdminVehicles);
const AdminLogistics = lazy(pageLoaders.AdminLogistics);
const AdminWarehouse = lazy(pageLoaders.AdminWarehouse);
const AdminTrips = lazy(pageLoaders.AdminTrips);
const AdminMyTrips = lazy(pageLoaders.AdminMyTrips);
const AdminServices = lazy(pageLoaders.AdminServices);
const AdminTrash = lazy(pageLoaders.AdminTrash);
const AdminHomePage = lazy(pageLoaders.AdminHomePage);
const AdminReceivables = lazy(pageLoaders.AdminReceivables);
const AdminBacklog = lazy(pageLoaders.AdminBacklog);
const AdminStaffMonitor = lazy(pageLoaders.AdminStaffMonitor);
const AdminPipelineMonitor = lazy(pageLoaders.AdminPipelineMonitor);
const NotFound = lazy(pageLoaders.NotFound);
const WorkerLogin = lazy(pageLoaders.WorkerLogin);
const WorkerPortal = lazy(pageLoaders.WorkerPortal);
const WorkerJobView = lazy(pageLoaders.WorkerJobView);
const SharedQuotationView = lazy(pageLoaders.SharedQuotationView);
const SharedJobView = lazy(pageLoaders.SharedJobView);
const DeliveryNote = lazy(pageLoaders.DeliveryNote);
const About = lazy(pageLoaders.About);
const PrivacyPolicy = lazy(pageLoaders.PrivacyPolicy);
const EnquiryLink = lazy(pageLoaders.EnquiryLink);
const UserGuide = lazy(pageLoaders.UserGuide);
const StaffCatalog = lazy(pageLoaders.StaffCatalog);
const BundleDetail = lazy(pageLoaders.BundleDetail);
const AdminVault = lazy(pageLoaders.AdminVault);
const OAuthConsent = lazy(pageLoaders.OAuthConsent);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 } },
});

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider><TooltipProvider>
      <Toaster /><Sonner />
      <BrowserRouter>
        <RouteIntentPreloader />
        <BacklogShortcut />
        <GlobalNotesWindow />
        <EnquiryForm />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/staff-catalog" element={<StaffCatalog />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/bundle/:id" element={<BundleDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/enquiry" element={<EnquiryLink />} />
            <Route path="/enquiry/:productId" element={<EnquiryLink />} />
            <Route path="/guide" element={<UserGuide />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/my-work" element={<AdminMyWork />} />
            <Route path="/admin/enquiries" element={<AdminEnquiriesInbox />} />
            <Route path="/admin/whatsapp" element={<AdminWhatsAppInbox />} />
            <Route path="/admin/categories" element={<OfficeStaffOnly><AdminCategories /></OfficeStaffOnly>} />
            <Route path="/admin/products" element={<OfficeStaffOnly><AdminProducts /></OfficeStaffOnly>} />
            <Route path="/admin/products/bulk" element={<OfficeStaffOnly><AdminProductBulkCreate /></OfficeStaffOnly>} />
            <Route path="/admin/products/approval" element={<AdminProductApproval />} />
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
            <Route path="/admin/command-center" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/workers" element={<AdminOnly><AdminWorkers /></AdminOnly>} />
            <Route path="/admin/workers/:id" element={<AdminOnly><AdminWorkerDetail /></AdminOnly>} />
            <Route path="/admin/production" element={<OfficeStaffOnly><AdminProductionBoard /></OfficeStaffOnly>} />
            <Route path="/admin/measurement-tasks" element={<AdminMeasurementTasks />} />
            <Route path="/admin/quotations" element={<AdminQuotations />} />
            <Route path="/admin/quotations/bulk" element={<AdminQuotationBulkCreate />} />
            <Route path="/admin/scheme-calculator" element={<OfficeStaffOnly><AdminSchemeCalculator /></OfficeStaffOnly>} />
            <Route path="/admin/quotations/:id" element={<AdminQuotationEditor />} />
            <Route path="/admin/quotations/:id/preview" element={<AdminQuotationPreview />} />
            <Route path="/admin/routes" element={<AdminOnly><AdminRoutes /></AdminOnly>} />
            <Route path="/admin/vehicles" element={<AdminOnly><AdminVehicles /></AdminOnly>} />
            <Route path="/admin/logistics" element={<AdminLogistics />} />
            <Route path="/admin/warehouse" element={<AdminWarehouse />} />
            <Route path="/admin/trips" element={<AdminTrips />} />
            <Route path="/admin/my-trips" element={<AdminMyTrips />} />
            <Route path="/admin/services" element={<AdminServices />} />
            <Route path="/admin/services/:id" element={<EnquiryRedirect kind="service" />} />
            <Route path="/admin/complaints/:id" element={<EnquiryRedirect kind="complaint" />} />
            <Route path="/admin/trash" element={<AdminOnly><AdminTrash /></AdminOnly>} />
            <Route path="/admin/home-page" element={<AdminOnly><AdminHomePage /></AdminOnly>} />
            <Route path="/admin/backlog" element={<AdminBacklog />} />
            <Route path="/admin/vault" element={<AdminOnly><AdminVault /></AdminOnly>} />
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
    </TooltipProvider></AuthProvider>
  </QueryClientProvider>
);

export default App;
