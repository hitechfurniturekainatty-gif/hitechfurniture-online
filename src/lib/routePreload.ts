// Shared by React.lazy and link-intent preloading; imports execute once.
export const pageLoaders = {
  Catalog: () => import("../pages/Catalog.tsx"),
  Faq: () => import("../pages/Faq.tsx"),
  ProductDetail: () => import("../pages/ProductDetail.tsx"),
  Auth: () => import("../pages/Auth.tsx"),
  AdminOverview: () => import("../pages/admin/AdminOverview.tsx"),
  AdminMyWork: () => import("../pages/admin/AdminMyWork.tsx"),
  AdminEnquiriesInbox: () => import("../pages/admin/AdminEnquiriesInbox.tsx"),
  AdminWhatsAppInbox: () => import("../pages/admin/AdminWhatsAppInbox.tsx"),
  AdminCategories: () => import("../pages/admin/AdminCategories.tsx"),
  AdminProducts: () => import("../pages/admin/AdminProducts.tsx"),
  AdminProductBulkCreate: () => import("../pages/admin/AdminProductBulkCreate.tsx"),
  AdminProductApproval: () => import("../pages/admin/AdminProductApproval.tsx"),
  AdminInventoryLedger: () => import("../pages/admin/AdminInventoryLedger.tsx"),
  AdminInventoryReorder: () => import("../pages/admin/AdminInventoryReorder.tsx"),
  AdminInventoryReceiving: () => import("../pages/admin/AdminInventoryReceiving.tsx"),
  AdminInventoryStockTake: () => import("../pages/admin/AdminInventoryStockTake.tsx"),
  AdminInventoryTransfers: () => import("../pages/admin/AdminInventoryTransfers.tsx"),
  AdminBundles: () => import("../pages/admin/AdminBundles.tsx"),
  AdminBundleEditor: () => import("../pages/admin/AdminBundleEditor.tsx"),
  AdminBundleBulkCreate: () => import("../pages/admin/AdminBundleBulkCreate.tsx"),
  AdminStaff: () => import("../pages/admin/AdminStaff.tsx"),
  AdminWorkers: () => import("../pages/admin/AdminWorkers.tsx"),
  AdminWorkerDetail: () => import("../pages/admin/AdminWorkerDetail.tsx"),
  AdminProductionBoard: () => import("../pages/admin/AdminProductionBoard.tsx"),
  AdminMeasurementTasks: () => import("../pages/admin/AdminMeasurementTasks.tsx"),
  AdminQuotations: () => import("../pages/admin/AdminQuotations.tsx"),
  AdminQuotationEditor: () => import("../pages/admin/AdminQuotationEditor.tsx"),
  AdminQuotationPreview: () => import("../pages/admin/AdminQuotationPreview.tsx"),
  AdminQuotationBulkCreate: () => import("../pages/admin/AdminQuotationBulkCreate.tsx"),
  AdminSchemeCalculator: () => import("../pages/admin/AdminSchemeCalculator.tsx"),
  AdminRoutes: () => import("../pages/admin/AdminRoutes.tsx"),
  AdminVehicles: () => import("../pages/admin/AdminVehicles.tsx"),
  AdminLogistics: () => import("../pages/admin/AdminLogistics.tsx"),
  AdminWarehouse: () => import("../pages/admin/AdminWarehouse.tsx"),
  AdminTrips: () => import("../pages/admin/AdminTrips.tsx"),
  AdminMyTrips: () => import("../pages/admin/AdminMyTrips.tsx"),
  AdminServices: () => import("../pages/admin/AdminServices.tsx"),
  AdminTrash: () => import("../pages/admin/AdminTrash.tsx"),
  AdminHomePage: () => import("../pages/admin/AdminHomePage.tsx"),
  AdminReceivables: () => import("../pages/admin/AdminReceivables.tsx"),
  AdminBacklog: () => import("../pages/admin/AdminBacklog.tsx"),
  AdminStaffMonitor: () => import("../pages/admin/AdminStaffMonitor.tsx"),
  AdminPipelineMonitor: () => import("../pages/admin/AdminPipelineMonitor.tsx"),
  NotFound: () => import("../pages/NotFound.tsx"),
  WorkerLogin: () => import("../pages/WorkerLogin.tsx"),
  WorkerPortal: () => import("../pages/WorkerPortal.tsx"),
  WorkerJobView: () => import("../pages/WorkerJobView.tsx"),
  SharedQuotationView: () => import("../pages/SharedQuotationView.tsx"),
  SharedJobView: () => import("../pages/SharedJobView.tsx"),
  DeliveryNote: () => import("../pages/DeliveryNote.tsx"),
  About: () => import("../pages/About.tsx"),
  PrivacyPolicy: () => import("../pages/PrivacyPolicy.tsx"),
  EnquiryLink: () => import("../pages/EnquiryLink.tsx"),
  UserGuide: () => import("../pages/UserGuide.tsx"),
  StaffCatalog: () => import("../pages/StaffCatalog.tsx"),
  BundleDetail: () => import("../pages/BundleDetail.tsx"),
  AdminVault: () => import("../pages/admin/AdminVault.tsx"),
  OAuthConsent: () => import("../pages/OAuthConsent.tsx"),
};
const routes: [string, keyof typeof pageLoaders][] = [["/catalog", "Catalog"], ["/staff-catalog", "StaffCatalog"], ["/product/:id", "ProductDetail"], ["/bundle/:id", "BundleDetail"], ["/about", "About"], ["/faq", "Faq"], ["/privacy-policy", "PrivacyPolicy"], ["/enquiry", "EnquiryLink"], ["/enquiry/:productId", "EnquiryLink"], ["/guide", "UserGuide"], ["/auth", "Auth"], ["/.lovable/oauth/consent", "OAuthConsent"], ["/admin", "AdminOverview"], ["/admin/my-work", "AdminMyWork"], ["/admin/enquiries", "AdminEnquiriesInbox"], ["/admin/whatsapp", "AdminWhatsAppInbox"], ["/admin/categories", "AdminCategories"], ["/admin/products", "AdminProducts"], ["/admin/products/bulk", "AdminProductBulkCreate"], ["/admin/products/approval", "AdminProductApproval"], ["/admin/inventory/ledger", "AdminInventoryLedger"], ["/admin/inventory/reorder", "AdminInventoryReorder"], ["/admin/inventory/receiving", "AdminInventoryReceiving"], ["/admin/inventory/stock-take", "AdminInventoryStockTake"], ["/admin/inventory/transfers", "AdminInventoryTransfers"], ["/admin/bundles", "AdminBundles"], ["/admin/bundles/bulk", "AdminBundleBulkCreate"], ["/admin/bundles/:id", "AdminBundleEditor"], ["/admin/staff", "AdminStaff"], ["/admin/staff-monitor", "AdminStaffMonitor"], ["/admin/pipeline", "AdminPipelineMonitor"], ["/admin/workers", "AdminWorkers"], ["/admin/workers/:id", "AdminWorkerDetail"], ["/admin/production", "AdminProductionBoard"], ["/admin/measurement-tasks", "AdminMeasurementTasks"], ["/admin/quotations", "AdminQuotations"], ["/admin/quotations/bulk", "AdminQuotationBulkCreate"], ["/admin/scheme-calculator", "AdminSchemeCalculator"], ["/admin/quotations/:id", "AdminQuotationEditor"], ["/admin/quotations/:id/preview", "AdminQuotationPreview"], ["/admin/routes", "AdminRoutes"], ["/admin/vehicles", "AdminVehicles"], ["/admin/logistics", "AdminLogistics"], ["/admin/warehouse", "AdminWarehouse"], ["/admin/trips", "AdminTrips"], ["/admin/my-trips", "AdminMyTrips"], ["/admin/services", "AdminServices"], ["/admin/trash", "AdminTrash"], ["/admin/home-page", "AdminHomePage"], ["/admin/backlog", "AdminBacklog"], ["/admin/vault", "AdminVault"], ["/admin/receivables", "AdminBacklog"], ["/worker/login", "WorkerLogin"], ["/worker", "WorkerPortal"], ["/worker/job/:jobId", "WorkerJobView"], ["/s/q/:token", "SharedQuotationView"], ["/s/d/:token", "SharedQuotationView"], ["/s/j/:token", "SharedJobView"], ["/delivery-note/:id", "DeliveryNote"], ["*", "NotFound"]];
const pending = new Map<string, Promise<unknown>>();
export function preloadRoute(pathname: string) {
  const path=pathname.split("?")[0];
  const route=routes.find(([pattern])=>pattern===path)||routes.find(([pattern])=>{
    const a=pattern.split("/"),b=path.split("/");
    return a.length===b.length&&a.every((part,i)=>part.startsWith(":")||part===b[i]);
  });
  if(!route)return;
  const key=route[1];
  if(!pending.has(key)){
    const request=pageLoaders[key]().catch(()=>{pending.delete(key);});
    pending.set(key,request);
  }
}
