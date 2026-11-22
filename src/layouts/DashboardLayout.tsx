import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PackagePlus,
  Calculator,
  Truck,
  Package,
  Search,
  UserCircle,
  Users,
  Map,
  IndianRupee,
  ClipboardCheck,
  ClipboardList,
  LogOut,
  Menu,
  Plus,
  Wallet,
  LifeBuoy,
  MapPin,
  ScanLine,
  Bell,
  ShieldAlert,
  ShieldCheck,
  Landmark,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { UserRole, type SellerProfile } from '../types/index.ts';
import { formatINR } from '../utils/formatters.ts';
import { WalletRechargeModal } from '../components/shared/WalletRechargeModal.tsx';
import { NotificationBell } from '../components/shared/NotificationBell.tsx';
import { ProfileMenu } from '../components/shared/ProfileMenu.tsx';

const LOGO_ICON_URL =
  'https://zipit.co.in/__l5e/assets-v1/f4a93292-c5de-43a9-9804-5a139f08f535/zipit-logo-dark.png';
const LOGO_HORIZONTAL_URL =
  'https://zipit.co.in/__l5e/assets-v1/57ebba31-7bf0-44fc-91f3-015b261cea40/zipit-horizontal-white.png';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

const ROLE_NAV: Record<UserRole, NavItem[]> = {
  [UserRole.ADMIN]: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/sellers', label: 'Sellers', icon: Users },
    { to: '/admin/transporters', label: 'Transporters', icon: Truck },
    { to: '/admin/kyc', label: 'KYC Review', icon: ShieldCheck },
    { to: '/admin/settlements', label: 'Payout Settlements', icon: Landmark },
    { to: '/admin/routes', label: 'Routes', icon: Map },
    { to: '/admin/rates', label: 'Rate Matrix', icon: IndianRupee },
    { to: '/admin/bookings', label: 'All Bookings', icon: Package },
    { to: '/admin/tracking', label: 'Track LR', icon: Search },
    { to: '/admin/notifications', label: 'Notifications', icon: Bell },
    { to: '/admin/alerts', label: 'Incident Alerts', icon: ShieldAlert },
    { to: '/admin/support', label: 'Support Desk', icon: LifeBuoy },
  ],
  [UserRole.SELLER]: [
    { to: '/seller', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/seller/create-booking', label: 'Create Booking', icon: PackagePlus },
    { to: '/seller/shipments', label: 'My Bookings', icon: Package },
    // { to: '/seller/bulk-booking', label: 'Bulk Booking', icon: FileSpreadsheet },
    { to: '/seller/rate-calculator', label: 'Rate Calculator', icon: Calculator },
    { to: '/seller/tracking', label: 'Tracking', icon: Search },
    { to: '/seller/notifications', label: 'Notifications', icon: Bell },
    { to: '/seller/profile', label: 'Profile', icon: UserCircle },
    { to: '/seller/support', label: 'Support', icon: LifeBuoy },
  ],
  [UserRole.TRANSPORTER]: [
    { to: '/transporter', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/transporter/bookings', label: 'Assigned Bookings', icon: Package },
    // { to: '/transporter/update-status', label: 'Pickup & Delivery', icon: ClipboardCheck },
    { to: '/transporter/scanner', label: 'Carton Scanner', icon: ScanLine },
    { to: '/transporter/service-areas', label: 'Service Areas', icon: MapPin },
    // { to: '/transporter/earnings', label: 'Earnings', icon: IndianRupee },
    { to: '/transporter/tracking', label: 'Track LR', icon: Search },
    { to: '/transporter/notifications', label: 'Notifications', icon: Bell },
    { to: '/transporter/profile', label: 'Profile', icon: UserCircle },
    { to: '/transporter/support', label: 'Support', icon: LifeBuoy },
  ],
};

function getPageTitle(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean).pop() || 'dashboard';
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DashboardLayout() {
  const { user, profile, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  // Desktop sidebar is always icon-only and expands while hovered.
  const [hovered, setHovered] = useState(false);

  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimer = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  // Small hover-intent delay so the sidebar doesn't flicker open when the
  // cursor only passes over it on the way somewhere else.
  const openSidebar = () => {
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => setHovered(true), 90);
  };

  const closeSidebar = () => {
    clearHoverTimer();
    setHovered(false);
  };

  useEffect(() => clearHoverTimer, []);

  useEffect(() => {
    const handleOpenWallet = () => setWalletModalOpen(true);
    window.addEventListener('zipit:open-wallet-modal', handleOpenWallet);
    return () => window.removeEventListener('zipit:open-wallet-modal', handleOpenWallet);
  }, []);

  if (!user) return null;

  const sellerProfile = user.role === UserRole.SELLER ? (profile as SellerProfile | null) : null;
  const walletBalance = Number(sellerProfile?.walletBalance ?? 0);

  const navItems = ROLE_NAV[user.role] || [];
  const roleLabel =
    user.role === UserRole.ADMIN
      ? 'Admin Console'
      : user.role === UserRole.SELLER
        ? 'Seller Portal'
        : 'Transporter Portal';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // The sidebar content is always laid out at full width (w-64) and is simply
  // clipped by its animated wrapper, so icons never move and labels fade in/out
  // smoothly instead of popping.
  const renderSidebar = (expanded: boolean) => {
    const fade = `transition-opacity duration-200 motion-reduce:transition-none ${
      expanded ? 'opacity-100 delay-100' : 'opacity-0'
    }`;

    return (
      <div className="flex flex-col h-full w-64 bg-slate-900 text-slate-100">
        <div className="flex items-center justify-between h-16 border-b border-slate-800 shrink-0 pl-5 pr-5">
          {/* Logo: icon mark when collapsed, horizontal wordmark when expanded.
              Both are stacked and cross-fade so the swap is smooth. */}
          <div className="relative h-8 w-40 min-w-0">
            <img
              src={LOGO_ICON_URL}
              alt="Zipit"
              draggable={false}
              className={`absolute left-0 top-1/2 h-7 w-7 -translate-y-1/2 object-contain transition-opacity duration-200 motion-reduce:transition-none ${
                expanded ? 'opacity-0' : 'opacity-100 delay-100'
              }`}
            />
            <img
              src={LOGO_HORIZONTAL_URL}
              alt="Zipit B2B"
              draggable={false}
              className={`absolute left-0 top-1/2 h-7 w-auto max-w-full -translate-y-1/2 object-contain object-left transition-opacity duration-200 motion-reduce:transition-none ${
                expanded ? 'opacity-100 delay-100' : 'opacity-0'
              }`}
            />
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav
          className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1 px-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Main navigation"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isNotificationsItem = item.to.endsWith('/notifications');
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                aria-label={item.label}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap px-3.5 py-2.5 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <span className="relative shrink-0">
                  <Icon className="w-4 h-4" />
                  {isNotificationsItem && unreadCount > 0 && (
                    <span
                      className={`absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-400 ring-2 ring-slate-900 transition-opacity duration-200 ${
                        expanded ? 'opacity-0' : 'opacity-100'
                      }`}
                    />
                  )}
                </span>
                <span
                  className={`flex-1 flex items-center justify-between gap-2 min-w-0 ${fade}`}
                >
                  <span className="truncate">{item.label}</span>
                  {isNotificationsItem && unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-blue-500 text-white rounded-md leading-none tabular-nums">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-3 shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign Out"
            className="w-full flex items-center gap-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors px-3.5 py-2.5"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={`whitespace-nowrap ${fade}`}>Sign Out</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar: reserves a fixed 68px slot; the inner panel animates
          its width on hover and overlays the content (no layout shift). */}
      <aside className="hidden lg:block shrink-0 sticky top-0 z-40 h-screen self-start w-[68px]">
        <div
          className={`absolute inset-y-0 left-0 z-30 overflow-hidden transition-[width,box-shadow] duration-300 ease-in-out motion-reduce:transition-none ${
            hovered ? 'w-64 shadow-2xl shadow-slate-900/30' : 'w-[68px] shadow-none'
          }`}
          onMouseEnter={openSidebar}
          onMouseLeave={closeSidebar}
          onFocus={(e) => {
            if (e.target.matches(':focus-visible')) {
              clearHoverTimer();
              setHovered(true);
            }
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) closeSidebar();
          }}
        >
          {renderSidebar(hovered)}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {/* Always mounted so it can animate in and out: backdrop fades, panel slides. */}
      <div
        className={`fixed inset-0 z-40 lg:hidden flex transition-[visibility] duration-300 ${
          mobileOpen ? 'visible' : 'invisible pointer-events-none'
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`fixed inset-0 bg-slate-900/50 transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
        <div
          className={`relative z-50 flex transition-transform duration-300 ease-out motion-reduce:transition-none will-change-transform ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderSidebar(true)}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">{roleLabel}</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900 truncate">
                {getPageTitle(location.pathname)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {user.role === UserRole.SELLER && (
              <>
                <button
                  type="button"
                  onClick={() => setWalletModalOpen(true)}
                  aria-label="Open wallet and recharge"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-colors whitespace-nowrap shrink-0"
                >
                  <Wallet className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                    {formatINR(walletBalance)}
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-0.5 text-blue-600 font-semibold border-l border-slate-200 pl-2">
                    <Plus className="w-3 h-3 shrink-0" />
                    <span>Recharge</span>
                  </span>
                </button>
              </>
            )}
            <ProfileMenu />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-5 lg:p-6 max-w-[1480px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {user.role === UserRole.SELLER && (
        <WalletRechargeModal
          open={walletModalOpen}
          onClose={() => setWalletModalOpen(false)}
        />
      )}
    </div>
  );
}