import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardCheck, IndianRupee, MapPin, ScanLine } from 'lucide-react';
import { apiClient, extractErrorMessage } from '../../services/api.ts';
import { formatDateTime, formatWeight } from '../../utils/formatters.ts';
import { StatCard } from '../../components/ui/StatCard.tsx';
import { StatusBadge } from '../../components/ui/StatusBadge.tsx';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable.tsx';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../../components/ui/States.tsx';
import type { Booking, SellerProfile } from '../../types/index.ts';

interface TransporterStatsResponse {
  metrics: {
    totalAssigned: number;
    pendingAcceptance: number;
    inTransitShipments: number;
    deliveredShipments: number;
  };
  recentBookings: Booking[];
}

export function TransporterDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<TransporterStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: TransporterStatsResponse }>(
        '/dashboard/stats'
      );
      setData(res.data.data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load transporter dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingSkeleton rows={5} />;
  if (error || !data) return <ErrorBanner message={error || 'Unable to load'} onRetry={load} />;

  const columns: ColumnDef<Booking>[] = [
    {
      key: 'lr',
      header: 'LR Number',
      render: (b) => <span className="font-mono font-medium text-slate-900 tabular-nums">{b.lrNumber}</span>,
    },
    {
      key: 'seller',
      header: 'Consignor Business',
      render: (b) => (b.sellerId as SellerProfile)?.businessName || b.sender.name,
    },
    {
      key: 'route',
      header: 'Lane',
      render: (b) => `${b.origin.city} → ${b.destination.city}`,
    },
    {
      key: 'wt',
      header: 'Chargeable Wt',
      align: 'right',
      render: (b) => <span className="font-mono tabular-nums">{formatWeight(b.chargeableWeight)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: 'created',
      header: 'Assigned On',
      render: (b) => <span className="text-xs font-mono tabular-nums text-slate-500">{formatDateTime(b.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Transporter Operations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Accept or reject dispatches, scan carton barcodes, manage pickups & service areas, and track settlements
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/transporter/scanner"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <ScanLine className="w-4 h-4 text-blue-600" />
            <span>Carton Scanner</span>
          </Link>
          <Link
            to="/transporter/service-areas"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>Service Areas</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Assigned Bookings" value={data.metrics.totalAssigned} />
        <StatCard label="Awaiting Acceptance" value={data.metrics.pendingAcceptance} />
        <StatCard label="Active In Transit" value={data.metrics.inTransitShipments} />
        <StatCard label="Delivered" value={data.metrics.deliveredShipments} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Recent Assigned Shipments</h2>
          <Link to="/transporter/bookings" className="text-sm font-medium text-blue-600 hover:underline">
            View all assigned
          </Link>
        </div>

        {data.recentBookings.length === 0 ? (
          <EmptyState
            title="No assigned bookings"
            description="Shipments booked with your carrier rates will appear here."
          />
        ) : (
          <DataTable
            columns={columns}
            rows={data.recentBookings}
            rowKey={(b) => b._id}
            onRowClick={(b) => navigate(`/transporter/bookings/${b._id}`)}
          />
        )}
      </div>
    </div>
  );
}
