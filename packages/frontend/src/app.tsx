import { useEffect, useRef } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";
import { AppLayout } from "./components/layout";
import { EditingNavigationProvider } from "./components/editing/editing-navigation";
import { Toaster } from "./components/ui/toast";
import { useToast } from "./hooks/use-toast";
import { useAuth } from "./lib/auth";
import { DashboardPage } from "./routes/dashboard";
import { DataManagementPage } from "./routes/data";
import { DisposalsPage } from "./routes/disposals";
import { InventoryPage } from "./routes/inventory";
import { ItemDetailPage } from "./routes/item-detail";
import { ItemNewPage } from "./routes/item-new";
import { ItemsPage } from "./routes/items";
import { LoginPage } from "./routes/login";

export function App() {
  const { loading, authenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <>
        <LoginPage />
        <PwaUpdatePrompt />
        <Toaster />
      </>
    );
  }

  return (
    <EditingNavigationProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/items/new" element={<ItemNewPage />} />
          <Route path="/items/:id" element={<ItemDetailPage />} />
          <Route path="/disposals" element={<DisposalsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/data" element={<DataManagementPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
      <PwaUpdatePrompt />
      <Toaster />
    </EditingNavigationProvider>
  );
}

/**
 * PWA 更新プロンプト。ステージ1のトースト基盤に統合し、専用の固定バナーは持たない
 * （B-1「更新プロンプト」）。新バージョン検知は一度きりのイベントなので、toast 発火も
 * hasNotifiedRef で一度だけに絞る。
 */
function PwaUpdatePrompt() {
  const { toast } = useToast();
  const hasNotifiedRef = useRef(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh || hasNotifiedRef.current) {
      return;
    }

    hasNotifiedRef.current = true;
    toast({
      title: "新しいバージョンがあります。",
      variant: "info",
      action: { label: "更新", onClick: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, toast, updateServiceWorker]);

  return null;
}
