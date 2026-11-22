import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { apiClient, extractErrorMessage } from '../../services/api.ts';
import { formatDateTime } from '../../utils/formatters.ts';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import { TrackingTimeline } from '../ui/TrackingTimeline.tsx';
import { ErrorBanner, LoadingSkeleton } from '../ui/States.tsx';
import type { BookingStatus, TrackingEvent } from '../../types/index.ts';

interface TrackingResult {
  bookingId: string;
  bookingRef: string;
  lrNumber: string;
  currentStatus: BookingStatus;
  origin: { city: string; pincode: string };
  destination: { city: string; pincode: string };
  transporter?: { companyName: string; contactPerson: string; phone: string };
  bookingDate: string;
  latestUpdate: TrackingEvent | null;
  timeline: TrackingEvent[];
}

export function TrackingView() {
  const [lrInput, setLrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackingResult | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = lrInput.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: TrackingResult }>(
        `/tracking/${encodeURIComponent(trimmed)}`
      );
      setResult(res.data.data);
    } catch (err) {
      setResult(null);
      setError(extractErrorMessage(err, 'Unable to find shipment for this LR number.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h1 className="text-lg font-semibold text-slate-900">Track Consignment by LR Number</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter a Lorry Receipt number (for example, ZIPIT-LR-100001) to view real-time checkpoint updates.
        </p>

        <form onSubmit={handleSearch} className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={lrInput}
              onChange={(e) => setLrInput(e.target.value)}
              placeholder="Enter LR Number (e.g. ZIPIT-LR-100003)"
              className="w-full pl-10 pr-4 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !lrInput.trim()}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {loading ? 'Searching...' : 'Track Shipment'}
          </button>
        </form>
      </div>

      {loading && <LoadingSkeleton rows={4} />}
      {error && <ErrorBanner message={error} />}

      {result && !loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  {result.lrNumber}
                </span>
                <StatusBadge status={result.currentStatus} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
                <span className="font-mono">{result.bookingRef}</span>
                <span aria-hidden="true">·</span>
                <span>Booked {formatDateTime(result.bookingDate)}</span>
              </div>
            </div>

            {result.latestUpdate && (
              <div className="text-left sm:text-right">
                <p className="text-xs font-medium text-slate-500">Latest Update</p>
                <p className="text-sm font-medium text-slate-900 mt-0.5">
                  {result.latestUpdate.location}
                </p>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {formatDateTime(result.latestUpdate.eventTimestamp)}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-200 text-sm">
            <div>
              <p className="text-xs font-medium text-slate-500">Origin</p>
              <p className="font-medium text-slate-900 mt-0.5">
                {result.origin.city} ({result.origin.pincode})
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Destination</p>
              <p className="font-medium text-slate-900 mt-0.5">
                {result.destination.city} ({result.destination.pincode})
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Assigned Transporter</p>
              <p className="font-medium text-slate-900 mt-0.5">
                {result.transporter?.companyName || '—'}
              </p>
              {result.transporter?.phone && (
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {result.transporter.phone}
                </p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Shipment Timeline</h2>
            <TrackingTimeline events={result.timeline} />
          </div>
        </div>
      )}
    </div>
  );
}
