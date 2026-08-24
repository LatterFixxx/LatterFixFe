import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import ConnectAccount from '../components/ConnectAccount';
import AppNav from './AppNav';
import ThemeToggle from './ThemeToggle';
import TestnetBanner from './TestnetBanner';
import { OnboardingTour } from './OnboardingTour';
import { useTaskStore } from '../services/taskStore';

// ── Page Wrapper ───────────────────────
const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col flex-1">{children}</div>
);

// ── Layout ────────────────────────────
const AppLayout: React.FC = () => {
  const location = useLocation();
  const { currentUser, completeOnboarding } = useTaskStore();
  const [tourActive, setTourActive] = useState(false);

  // New admins auto-start the onboarding tour once they land on the
  // dashboard. Once running, it stays active across the pages it visits
  // (e.g. Bulk Payments) until the admin finishes or skips it — it must not
  // be re-gated to the dashboard route or it would stop mid-tour.
  useEffect(() => {
    if (
      location.pathname === '/dashboard' &&
      currentUser.role === 'Admin' &&
      !currentUser.hasCompletedOnboarding &&
      !tourActive
    ) {
      setTourActive(true);
    }
  }, [location.pathname, currentUser.role, currentUser.hasCompletedOnboarding, tourActive]);

  const handleTourComplete = () => {
    setTourActive(false);
    completeOnboarding();
  };

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <OnboardingTour run={tourActive} onComplete={handleTourComplete} />
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-(--header-h) items-center flex justify-between header-padding backdrop-blur-[20px] backdrop-saturate-180 border-b"
        style={{
          background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
          borderColor: 'var(--border-hi)',
        }}
      >
        {/* Logo */}
        <NavLink className="flex items-center gap-2.5" to="/">
          <div className="w-8 h-8 rounded-lg grid place-items-center font-extrabold text-black text-sm tracking-tight shadow-[0_0_20px_rgba(124,111,247,0.3)] bg-linear-to-br from-(--accent2) to-(--accent)">
            LF
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            Task<span className="text-(--accent)">Manager</span> Pro
          </span>
          <span className="text-[9px] font-normal font-mono text-(--muted) tracking-widest uppercase border border-(--border-hi) px-1.5 py-0.5 rounded ml-0.5">
            Decentralized
          </span>
        </NavLink>

        {/* Nav */}
        <div className="flex items-center gap-4 ml-auto">
          <AppNav />
          <div className="ml-4 flex items-center gap-2">
            <ThemeToggle />
            <ConnectAccount />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-col flex-1 pt-(--header-h)">
        <TestnetBanner />
        <PageWrapper>
          <div key={location.pathname} className="flex flex-col flex-1 page-container py-6 sm:py-8">
            <Outlet />
          </div>
        </PageWrapper>
      </main>

      {/* Footer */}
      <footer
        className="flex flex-wrap justify-between items-center gap-2 header-padding py-5 border-t text-xs font-mono text-(--muted)"
        style={{ borderColor: 'var(--border-hi)' }}
      >
        <span>
          © {new Date().getFullYear()} LatterFix — Task Manager Pro. Licensed under the{' '}
          <a
            href="https://mit-license.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-(--accent) hover:underline"
          >
            MIT License
          </a>
        </span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-(--accent) shadow-[0_0_6px_var(--accent)]" />
          STELLAR SOROBAN NETWORK · SOROBAN-PREVIEW-11
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
