import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiClient, extractErrorMessage } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable.tsx';
import { StatusBadge } from '../../components/ui/StatusBadge.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../../components/ui/States.tsx';
import { EntityStatus, type PaginatedResponse, type TransportRoute } from '../../types/index.ts';

export function AdminRoutesPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<PaginatedResponse<TransportRoute> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [originCity, setOriginCity] = useState('');
  const [originPincode, setOriginPincode] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationPincode, setDestinationPincode] = useState('');
  const [distanceKm, setDistanceKm] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: PaginatedResponse<TransportRoute> }>(
        '/routes',
        { params: { limit: 100 } }
      );
      setData(res.data.data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load routes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post('/routes', {
        originCity,
        originPincode,
        destinationCity,
        destinationPincode,
        distanceKm: distanceKm ? Number(distanceKm) : undefined,
      });
      showToast('Route created successfully.', 'success');
      setModalOpen(false);
      setOriginCity('');
      setOriginPincode('');
      setDestinationCity('');
      setDestinationPincode('');
      setDistanceKm('');
      await load();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to create route.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (route: TransportRoute) => {
    try {
      const next = route.status === EntityStatus.ACTIVE ? EntityStatus.INACTIVE : EntityStatus.ACTIVE;
      await apiClient.patch(`/routes/${route._id}`, { status: next });
      showToast(`Route marked ${next}.`, 'success');
      await load();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update route.'), 'error');
    }
  };

  const columns: ColumnDef<TransportRoute>[] = [
    {
      key: 'origin',
      header: 'Origin',
      render: (r) => (
        <span>
          {r.originCity} <span className="font-mono text-xs text-slate-500">({r.originPincode})</span>
        </span>
      ),
    },
    {
      key: 'destination',
      header: 'Destination',
      render: (r) => (
        <span>
          {r.destinationCity}{' '}
          <span className="font-mono text-xs text-slate-500">({r.destinationPincode})</span>
        </span>
      ),
    },
    {
      key: 'distance',
      header: 'Distance',
      align: 'right',
      render: (r) => (
        <span className="font-mono tabular-nums">{r.distanceKm ? `${r.distanceKm} km` : '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => handleToggleStatus(r)}
          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
        >
          {r.status === EntityStatus.ACTIVE ? 'Deactivate' : 'Activate'}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Route Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configure origin and destination pincode corridors</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Route
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No routes configured" description="Create origin-destination pincode lanes to attach carrier rates." />
      ) : (
        <DataTable columns={columns} rows={data.items} rowKey={(r) => r._id} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Transport Route">
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Origin City</label>
            <input
              type="text"
              required
              value={originCity}
              onChange={(e) => setOriginCity(e.target.value)}
              placeholder="Pune"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Origin Pincode</label>
            <input
              type="text"
              required
              pattern="\d{6}"
              value={originPincode}
              onChange={(e) => setOriginPincode(e.target.value)}
              placeholder="411026"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Destination City</label>
            <input
              type="text"
              required
              value={destinationCity}
              onChange={(e) => setDestinationCity(e.target.value)}
              placeholder="Bengaluru"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Destination Pincode</label>
            <input
              type="text"
              required
              pattern="\d{6}"
              value={destinationPincode}
              onChange={(e) => setDestinationPincode(e.target.value)}
              placeholder="560001"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Distance (km, Optional)</label>
            <input
              type="number"
              min="1"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              placeholder="840"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Route'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
