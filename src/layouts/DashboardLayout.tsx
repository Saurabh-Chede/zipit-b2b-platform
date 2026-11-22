import React, { useEffect, useState } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen,
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
import { BrandMark } from '../components/ui/BrandMark.tsx';
import { WalletRechargeModal } from '../components/shared/WalletRechargeModal.tsx';
import { NotificationBell } from '../components/shared/NotificationBell.tsx';
import { ProfileMenu } from '../components/shared/ProfileMenu.tsx';

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
    { to: '/seller/bulk-booking', label: 'Bulk Booking', icon: FileSpreadsheet },
    { to: '/seller/rate-calculator', label: 'Rate Calculator', icon: Calculator },
    { to: '/seller/shipments', label: 'My Shipments', icon: Package },
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
    { to: '/transporter/earnings', label: 'Earnings', icon: IndianRupee },
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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('zipit_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleOpenWallet = () => setWalletModalOpen(true);
    window.addEventListener('zipit:open-wallet-modal', handleOpenWallet);
    return () => window.removeEventListener('zipit:open-wallet-modal', handleOpenWallet);
  }, []);

  if (!user) return null;

  const sellerProfile = user.role === UserRole.SELLER ? (profile as SellerProfile | null) : null;
  const walletBalance = Number(sellerProfile?.walletBalance ?? 0);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('zipit_sidebar_collapsed', String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

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

  const renderSidebar = (isCollapsed: boolean) => (
    <div
      className={`flex flex-col h-full bg-slate-900 text-slate-100 transition-all duration-200 ${
        isCollapsed ? 'w-[68px]' : 'w-64'
      }`}
    >
      <div
        className={`flex items-center h-16 border-b border-slate-800 shrink-0 ${
          isCollapsed ? 'justify-center px-2' : 'justify-between px-5'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <BrandMark className="w-7 h-7 shrink-0" />
          {!isCollapsed && (
            <span className="font-display font-bold text-base tracking-tight text-white whitespace-nowrap">
              ZIPIT B2B
            </span>
          )}
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

      {!isCollapsed && (
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-xs font-medium text-slate-400">{roleLabel}</p>
          <p className="text-sm font-medium text-white truncate mt-0.5">{user.name}</p>
        </div>
      )}

      <nav
        className={`flex-1 overflow-y-auto py-4 space-y-1 ${isCollapsed ? 'px-2' : 'px-3'}`}
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
              title={isCollapsed ? item.label : undefined}
              aria-label={item.label}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && (
                <span className="flex-1 flex items-center justify-between gap-2 min-w-0">
                  <span className="truncate">{item.label}</span>
                  {isNotificationsItem && unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-blue-500 text-white rounded-md leading-none tabular-nums">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className={`border-t border-slate-800 ${isCollapsed ? 'p-2' : 'p-3'}`}>
        <button
          type="button"
          onClick={handleLogout}
          title={isCollapsed ? 'Sign Out' : undefined}
          aria-label="Sign Out"
          className={`w-full flex items-center rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors ${
            isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0">{renderSidebar(collapsed)}</aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 flex">{renderSidebar(false)}</div>
        </div>
      )}

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
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden lg:inline-flex p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeftOpen className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
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
