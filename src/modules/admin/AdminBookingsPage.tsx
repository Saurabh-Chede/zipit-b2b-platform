import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { apiClient, extractErrorMessage } from '../../services/api.ts';
import { formatDateTime, formatINR, formatWeight } from '../../utils/formatters.ts';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable.tsx';
import { StatusBadge } from '../../components/ui/StatusBadge.tsx';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../../components/ui/States.tsx';
import {
  BookingStatus,
  type Booking,
  type PaginatedResponse,
  type SellerProfile,
  type Transporter,
} from '../../types/index.ts';

export function AdminBookingsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResponse<Booking> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: PaginatedResponse<Booking> }>(
        '/bookings',
        {
          params: {
            page,
            limit: 15,
            status: statusFilter || undefined,
            lrNumber: search.trim() || undefined,
          },
        }
      );
      setData(res.data.data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load bookings.'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnDef<Booking>[] = [
    {
      key: 'lr',
      header: 'LR Number',
      render: (b) => <span className="font-mono font-medium text-slate-900 tabular-nums">{b.lrNumber}</span>,
    },
    {
      key: 'seller',
      header: 'Seller',
      render: (b) => (b.sellerId as SellerProfile)?.businessName || '—',
    },
    {
      key: 'transporter',
      header: 'Transporter',
      render: (b) => (b.transporterId as Transporter)?.companyName || '—',
    },
    {
      key: 'lane',
      header: 'Route',
      render: (b) => `${b.origin.city} → ${b.destination.city}`,
    },
    {
      key: 'wt',
      header: 'Chargeable Wt',
      align: 'right',
      render: (b) => <span className="font-mono tabular-nums">{formatWeight(b.chargeableWeight)}</span>,
    },
    {
      key: 'total',
      header: 'Total Freight',
      align: 'right',
      render: (b) => <span className="font-mono tabular-nums font-medium">{formatINR(b.finalAmount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: 'date',
      header: 'Booked On',
      render: (b) => <span className="text-xs font-mono tabular-nums text-slate-500">{formatDateTime(b.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">All System Bookings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Search by LR number, filter by status, and inspect manifests</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search by LR number or city..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
        >
          <option value="">All Statuses</option>
          {Object.values(BookingStatus).map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No bookings found" description="No bookings match your search or status filter." />
      ) : (
        <DataTable
          columns={columns}
          rows={data.items}
          rowKey={(b) => b._id}
          onRowClick={(b) => navigate(`/admin/bookings/${b._id}`)}
          pagination={{
            page: data.pagination.page,
            totalPages: data.pagination.totalPages,
            total: data.pagination.total,
            onPageChange: setPage,
          }}
        />
      )}
    </div>
  );
}
