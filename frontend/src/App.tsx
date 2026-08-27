import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import Home from './pages/Home';
import CreateTask from './pages/CreateTask';
import TaskExplorer from './pages/TaskExplorer';
import EscrowManager from './pages/EscrowManager';
import VestingEscrowManager from './pages/VestingEscrowManager';
import PaymentLedger from './pages/PaymentLedger';
import Settings from './pages/Settings';
import Governance from './pages/Governance';
import Profile from './pages/Profile';
import CrossAssetPayment from './pages/CrossAssetPayment';
import RevenueSplitDashboard from './pages/RevenueSplitDashboard';
import EmployeePortal from './pages/EmployeePortal';
import AppLayout from './components/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorFallback from './components/ErrorFallback';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import CustomReportBuilder from './pages/CustomReportBuilder';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import BulkPaymentTracker from './pages/BulkPaymentTracker';
import AdminPanel from './pages/AdminPanel';
import Debugger from './pages/Debugger';
import PayrollScheduler from './pages/PayrollScheduler';
import { contractService } from './services/contracts';
import { AuthProvider } from './providers/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  // Initialize contract service on app startup
  useEffect(() => {
    contractService.initialize().catch((error) => {
      console.error('Failed to initialize contract service:', error);
    });
  }, []);

  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppLayout />}>
          {/* Public Routes */}
          <Route
            path="/"
            element={
              <ErrorBoundary fallback={<ErrorFallback title="Landing Page Error" />}>
                <LandingPage />
              </ErrorBoundary>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/auth-callback" element={<AuthCallback />} />

          {/* Protected Routes (Any Authenticated User) */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/dashboard"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Dashboard Error" />}>
                  <Home />
                </ErrorBoundary>
              }
            />
            <Route
              path="/tasks"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Explorer Error" />}>
                  <TaskExplorer />
                </ErrorBoundary>
              }
            />
            <Route
              path="/profile"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Profile Error" />}>
                  <Profile />
                </ErrorBoundary>
              }
            />
            <Route
              path="/portal"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Employee Portal Error" />}>
                  <EmployeePortal />
                </ErrorBoundary>
              }
            />
            <Route
              path="/settings"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Settings Error" />}>
                  <Settings />
                </ErrorBoundary>
              }
            />
            <Route
              path="/admin"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Admin Panel Error" />}>
                  <AdminPanel />
                </ErrorBoundary>
              }
            />
            <Route
              path="/debug"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Debugger Error" />}>
                  <Debugger />
                </ErrorBoundary>
              }
            />
            <Route
              path="/payroll"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Payroll Scheduler Error" />}>
                  <PayrollScheduler />
                </ErrorBoundary>
              }
            />
          </Route>

          {/* Protected Routes (Employer Only) */}
          <Route element={<ProtectedRoute allowedRoles={['employer']} />}>
            <Route
              path="/create-task"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Create Task Error" />}>
                  <CreateTask />
                </ErrorBoundary>
              }
            />
            <Route
              path="/escrow"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Escrow Error" />}>
                  <EscrowManager />
                </ErrorBoundary>
              }
            />
            <Route
              path="/vesting"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Vesting Escrow Error" />}>
                  <VestingEscrowManager />
                </ErrorBoundary>
              }
            />
            <Route
              path="/cross-asset"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Cross-Asset Error" />}>
                  <CrossAssetPayment />
                </ErrorBoundary>
              }
            />
            <Route
              path="/revenue-split"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Revenue Split Error" />}>
                  <RevenueSplitDashboard />
                </ErrorBoundary>
              }
            />
            <Route
              path="/governance"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Governance Error" />}>
                  <Governance />
                </ErrorBoundary>
              }
            />
            <Route
              path="/history"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="History Error" />}>
                  <PaymentLedger />
                </ErrorBoundary>
              }
            />
            <Route
              path="/reports"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Custom Report Builder Error" />}>
                  <CustomReportBuilder />
                </ErrorBoundary>
              }
            />
            <Route
              path="/analytics"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Analytics Dashboard Error" />}>
                  <AnalyticsDashboard />
                </ErrorBoundary>
              }
            />
            <Route
              path="/bulk-payments"
              element={
                <ErrorBoundary fallback={<ErrorFallback title="Bulk Payment Tracker Error" />}>
                  <BulkPaymentTracker />
                </ErrorBoundary>
              }
            />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
