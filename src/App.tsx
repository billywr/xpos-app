import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { set401Handler } from "@/api/client";
import { clearCredentials } from "@/store/slices/authSlice";
import { clearContext } from "@/store/slices/orgContextSlice";
import { clearStoredContext } from "@/utils/contextStorage";
import { Layout } from "@/components/Layout";
import { AdminLayout } from "@/components/AdminLayout";
import { NavVisibilityProvider } from "@/components/NavVisibilityProvider";
import { OperatorLayout } from "@/components/OperatorLayout";
import { OperatorContextGuard } from "@/components/OperatorContextGuard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RestoreContext } from "@/components/RestoreContext";
import { LoginPage } from "@/features/auth/LoginPage";
import { SelectContextPage } from "@/features/context/SelectContextPage";
import { HomePage } from "@/features/home/HomePage";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { OrgSetupPage } from "@/features/admin/OrgSetupPage";
import { OrgsListPage } from "@/features/admin/OrgsListPage";
import { BusinessesListPage } from "@/features/admin/BusinessesListPage";
import { BranchesListPage } from "@/features/admin/BranchesListPage";
import { TerminalsListPage } from "@/features/admin/TerminalsListPage";
import { DevicesListPage } from "@/features/admin/DevicesListPage";
import { StaffListPage } from "@/features/admin/StaffListPage";
import { CatalogPage } from "@/features/admin/CatalogPage";
import { CategoriesListPage } from "@/features/admin/CategoriesListPage";
import { UomsListPage } from "@/features/admin/UomsListPage";
import { ItemsListPage } from "@/features/admin/ItemsListPage";
import { PriceListsListPage } from "@/features/admin/PriceListsListPage";
import { PriceListEditPage } from "@/features/admin/PriceListEditPage";
import { TenderTypesListPage } from "@/features/admin/TenderTypesListPage";
import { SalesListPage } from "@/features/admin/SalesListPage";
import { ShiftsListPage } from "@/features/admin/ShiftsListPage";
import { ZReportPage } from "@/features/admin/ZReportPage";
import { AdminTablesPage } from "@/features/admin/AdminTablesPage";
import { InventoryReceivingPage } from "@/features/admin/InventoryReceivingPage";
import { RevenueDashboardPage } from "@/features/admin/RevenueDashboardPage";
import { StockTakingSchedulesPage } from "@/features/admin/StockTakingSchedulesPage";
import { StockCountSessionsPage } from "@/features/admin/StockCountSessionsPage";
import { AnalyticsPage } from "@/features/operator/AnalyticsPage";
import { DebtsPage } from "@/features/operator/DebtsPage";
import { MiscExpensesPage } from "@/features/operator/MiscExpensesPage";
import { StockCountPage } from "@/features/operator/StockCountPage";
import { StockCountSessionPage } from "@/features/operator/StockCountSessionPage";
import { StandardStockCountSheetPage } from "@/features/operator/StandardStockCountSheetPage";
import { StockCountSessionDetailAdminPage } from "@/features/admin/StockCountSessionDetailAdminPage";
import { StandardStockCountAdminPage } from "@/features/admin/StandardStockCountAdminPage";
import { AdminSettingsPage } from "@/features/admin/AdminSettingsPage";
import { BarcodeScannerPage } from "@/features/admin/BarcodeScannerPage";
import { MenuOrderPage } from "@/features/operator/MenuOrderPage";
import { OperatorDashboard } from "@/features/operator/OperatorDashboard";
import { PaymentsPage } from "@/features/operator/PaymentsPage";
import { ReceiptsPage } from "@/features/operator/ReceiptsPage";
import { TablesPage } from "@/features/operator/TablesPage";

function App() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    set401Handler(() => {
      clearStoredContext();
      dispatch(clearCredentials());
      dispatch(clearContext());
      navigate("/login");
    });
    return () => set401Handler(null);
  }, [dispatch, navigate]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RestoreContext />
            <NavVisibilityProvider>
              <Layout />
            </NavVisibilityProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route
          path="admin"
          element={<AdminLayout />}
        >
          <Route index element={<AdminDashboard />} />
          <Route path="org-setup" element={<OrgSetupPage />} />
          <Route path="orgs" element={<OrgsListPage />} />
          <Route path="businesses" element={<BusinessesListPage />} />
          <Route path="branches" element={<BranchesListPage />} />
          <Route path="terminals" element={<TerminalsListPage />} />
          <Route path="devices" element={<DevicesListPage />} />
          <Route path="staff" element={<StaffListPage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="categories" element={<CategoriesListPage />} />
          <Route path="uoms" element={<UomsListPage />} />
          <Route path="items" element={<ItemsListPage />} />
          <Route path="price-lists" element={<PriceListsListPage />} />
          <Route
            path="price-lists/:priceListId"
            element={<PriceListEditPage />}
          />
          <Route path="tender-types" element={<TenderTypesListPage />} />
          <Route path="sales" element={<SalesListPage />} />
          <Route path="tables" element={<AdminTablesPage />} />
          <Route path="shifts" element={<ShiftsListPage />} />
          <Route path="z-report" element={<ZReportPage />} />
          <Route path="suppliers" element={<Navigate to="/admin/inventory?tab=suppliers" replace />} />
          <Route path="goods-receipt" element={<Navigate to="/admin/inventory?tab=goods-receipt" replace />} />
          <Route path="inventory" element={<InventoryReceivingPage />} />
          <Route path="stock-taking-schedules" element={<StockTakingSchedulesPage />} />
          <Route path="stock-count-sessions" element={<StockCountSessionsPage />} />
          <Route
            path="stock-count-sessions/:sessionId"
            element={<StockCountSessionDetailAdminPage />}
          />
          <Route
            path="standard-stock-count"
            element={<StandardStockCountAdminPage />}
          />
          <Route path="revenue" element={<RevenueDashboardPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="barcode-scanner" element={<BarcodeScannerPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
        <Route path="select-context" element={<SelectContextPage />} />
        <Route
          path="operator"
          element={
            <OperatorContextGuard>
              <OperatorLayout />
            </OperatorContextGuard>
          }
        >
          <Route index element={<OperatorDashboard />} />
          <Route path="menu-order" element={<MenuOrderPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="tables/*" element={<TablesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="debts" element={<DebtsPage />} />
          <Route path="misc-expenses" element={<MiscExpensesPage />} />
          <Route path="stock-count" element={<StockCountPage />} />
          <Route
            path="stock-count/:sessionId"
            element={<StockCountSessionPage />}
          />
          <Route
            path="inventory/stock-count"
            element={<StandardStockCountSheetPage />}
          />
          <Route path="withdrawal" element={<div className="p-6 text-slate-600 dark:text-slate-400">Withdrawal (TODO)</div>} />
          <Route path="dishes" element={<div className="p-4 text-white">Dishes (TODO)</div>} />
          <Route path="payments" element={<PaymentsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
