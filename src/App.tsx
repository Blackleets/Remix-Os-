import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { BetaFeedbackButton } from './components/BetaFeedbackButton';
import { Landing } from './pages/Landing';
import { Auth } from './pages/Auth';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { Products } from './pages/Products';
import { Inventory } from './pages/Inventory';
import { Orders } from './pages/Orders';
import { Settings } from './pages/Settings';
import { Team } from './pages/Team';
import { Copilot } from './components/Copilot';
import { BottomNav } from './components/BottomNav';
import { TrialBanner } from './components/TrialBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AnimatePresence, motion } from 'motion/react';
import { usePlatformAdmin } from './hooks/usePlatformAdmin';

const Billing = lazy(() => import('./pages/Billing').then((module) => ({ default: module.Billing })));
const POS = lazy(() => import('./pages/POS').then((module) => ({ default: module.POS })));
const Insights = lazy(() => import('./pages/Insights').then((module) => ({ default: module.Insights })));
const Invoices = lazy(() => import('./pages/Invoices').then((module) => ({ default: module.Invoices })));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin').then((module) => ({ default: module.SuperAdmin })));

const RouteLoading = () => (
  <div className="flex h-[60vh] items-center justify-center">
    <div className="shell-panel min-w-[260px] px-6 py-10 text-center">
      <p className="section-kicker mb-3">Cargador de módulos</p>
      <p className="text-base font-semibold text-white">Inicializando la siguiente superficie...</p>
      <p className="mt-2 text-sm text-neutral-500">Preparando el próximo módulo operativo.</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
  const { user, company, role, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="shell-background flex h-screen items-center justify-center">
        <div className="shell-panel px-8 py-10 text-center">
          <p className="section-kicker mb-3">Secuencia de arranque</p>
          <p className="text-base font-semibold text-white">Cargando Remix OS...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;
  if (!company && pathname !== '/onboarding') return <Navigate to="/onboarding" />;
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/dashboard" />;

  if (company && company.subscription?.status === 'trialing' && pathname !== '/billing') {
    const trialEndsAt = company.subscription.trialEndsAt;
    if (trialEndsAt) {
      const endDate: Date = trialEndsAt?.toDate ? trialEndsAt.toDate() : new Date(trialEndsAt);
      if (endDate < new Date()) return <Navigate to="/billing" />;
    }
  }

  return <>{children}</>;
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="shell-background flex min-h-screen overflow-x-hidden text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[12%] top-[-12%] h-[340px] w-[340px] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-[8%] right-[-8%] h-[320px] w-[320px] rounded-full bg-emerald-400/5 blur-[130px]" />
      </div>

      <div className="relative z-10 hidden lg:block">
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-[40] bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 left-0 z-[50] w-[300px] lg:hidden"
            >
              <Sidebar onClose={() => setIsSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex min-h-screen flex-1 flex-col">
        <TrialBanner />
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 px-4 pb-[90px] pt-4 md:px-6 md:pb-8 md:pt-5 lg:pb-8 xl:px-8">
          <div className="mx-auto max-w-[1540px]">
            <ErrorBoundary key={pathname} variant="inline">
              {children}
            </ErrorBoundary>
          </div>
        </main>
        {pathname !== '/pos' && <BetaFeedbackButton />}
        {pathname !== '/pos' && <Copilot />}
        <BottomNav />
      </div>
    </div>
  );
};

const LazyRoute = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<RouteLoading />}>
    {children}
  </Suspense>
);

const PlatformAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { canAccessSuperAdmin, loadingPlatformAdmin } = usePlatformAdmin();

  if (loading || loadingPlatformAdmin) {
    return (
      <div className="shell-background flex h-screen items-center justify-center">
        <div className="shell-panel px-8 py-10 text-center">
          <p className="section-kicker mb-3">Capa de administración</p>
          <p className="text-base font-semibold text-white">Validando acceso a la plataforma...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" />;
  if (!canAccessSuperAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

            <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><AppLayout><Customers /></AppLayout></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><AppLayout><Products /></AppLayout></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><AppLayout><Inventory /></AppLayout></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><AppLayout><Orders /></AppLayout></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><AppLayout><LazyRoute><Invoices /></LazyRoute></AppLayout></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute><AppLayout><LazyRoute><POS /></LazyRoute></AppLayout></ProtectedRoute>} />
            <Route
              path="/insights"
              element={
                <ProtectedRoute allowedRoles={['owner', 'admin']}>
                  <AppLayout><LazyRoute><Insights /></LazyRoute></AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/team" element={<ProtectedRoute><AppLayout><Team /></AppLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><AppLayout><LazyRoute><Billing /></LazyRoute></AppLayout></ProtectedRoute>} />
            <Route
              path="/super-admin"
              element={
                <PlatformAdminRoute>
                  <AppLayout><LazyRoute><SuperAdmin /></LazyRoute></AppLayout>
                </PlatformAdminRoute>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
