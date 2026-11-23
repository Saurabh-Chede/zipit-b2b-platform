import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Ban,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  CloudUpload,
  MapPin,
  Package,
  RotateCcw,
  ScanLine,
  Scale,
  Search,
  Truck,
  Upload,
  XCircle,
} from 'lucide-react';
import { apiClient, extractErrorMessage } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { formatDateTime, formatINR, formatWeight } from '../../utils/formatters.ts';
import { StatusBadge } from '../../components/ui/StatusBadge.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../../components/ui/States.tsx';
import { AuthenticatedProofImage } from '../../components/shared/AuthenticatedProofImage.tsx';
import {
  BookingStatus,
  NEXT_BOOKING_STATUS,
  type Booking,
  type DeliveryProof,
  type PaginatedResponse,
  type SellerProfile,
  type TrackingEvent,
} from '../../types/index.ts';

type StatusTab = 'ALL' | 'NEW' | 'IN_TRANSIT' | 'ARRIVED' | 'NDR_RTO' | 'DELIVERED' | 'CLOSED';
type DateRangeFilter = 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS';

interface BookingDetailPayload {
  booking: Booking;
  trackingEvents: TrackingEvent[];
  deliveryProof: DeliveryProof | null;
}

const PROGRESS_STEPS: { status: BookingStatus; label: string }[] = [
  { status: BookingStatus.ACCEPTED, label: 'Accepted' },
  { status: BookingStatus.DISPATCHED, label: 'Dispatched' },
  { status: BookingStatus.ARRIVED, label: 'Arrived' },
  { status: BookingStatus.DELIVERED, label: 'Delivered' },
];

const STATUS_RANK: Record<BookingStatus, number> = {
  [BookingStatus.BOOKED]: 0,
  [BookingStatus.ACCEPTED]: 1,
  [BookingStatus.DISPATCHED]: 2,
  [BookingStatus.ARRIVED]: 3,
  [BookingStatus.DELIVERED]: 4,
  [BookingStatus.REJECTED]: -1,
  [BookingStatus.CANCELLED]: -1,
  [BookingStatus.NDR]: 3,
  [BookingStatus.RTO_INITIATED]: 3,
  [BookingStatus.RTO_DELIVERED]: 4,
};

function formatShortBookingTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getDefaultLocationForNextStatus(booking: Booking, next: BookingStatus): string {
  if (next === BookingStatus.ARRIVED || next === BookingStatus.DELIVERED) {
    return `${booking.destination.city} (${booking.destination.pincode})`;
  }
  return `${booking.origin.city} (${booking.origin.pincode})`;
}

export function AssignedBookingsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<StatusTab>('ALL');
  const [routeFilter, setRouteFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('ALL');
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<BookingDetailPayload | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [podFile, setPodFile] = useState<File | null>(null);
  const [podReceiverName, setPodReceiverName] = useState('');
  const [uploadingPod, setUploadingPod] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [exceptionTarget, setExceptionTarget] = useState<{
    booking: Booking;
    status: BookingStatus.NDR | BookingStatus.RTO_INITIATED;
  } | null>(null);
  const [exceptionReason, setExceptionReason] = useState('');
  const [submittingException, setSubmittingException] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: PaginatedResponse<Booking> }>(
        '/transporter/bookings',
        { params: { page: 1, limit: 100 } }
      );
      const items = res.data.data.items;
      setBookings(items);
      setSelectedId((prev) => {
        if (prev && items.some((b) => b._id === prev)) return prev;
        return items[0]?._id || null;
      });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load assigned bookings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const loadSelectedDetail = useCallback(async (bookingId: string) => {
    setLoadingDetail(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: BookingDetailPayload }>(
        `/bookings/${bookingId}`
      );
      setSelectedDetail(res.data.data);
      setPodReceiverName(res.data.data.booking.receiver.name);
      setPodFile(null);
    } catch {
      setSelectedDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadSelectedDetail(selectedId);
    } else {
      setSelectedDetail(null);
    }
  }, [selectedId, loadSelectedDetail]);

  const routeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bookings) {
      const label = `${b.origin.city} → ${b.destination.city}`;
      map.set(label, label);
    }
    return Array.from(map.values());
  }, [bookings]);

  const dateAndRouteFiltered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const q = search.trim().toLowerCase();

    return bookings.filter((b) => {
      const laneLabel = `${b.origin.city} → ${b.destination.city}`;
      if (routeFilter !== 'ALL' && laneLabel !== routeFilter) return false;

      const createdMs = new Date(b.createdAt).getTime();
      if (dateFilter === 'TODAY' && createdMs < startOfToday) return false;
      if (dateFilter === 'LAST_7_DAYS' && createdMs < sevenDaysAgo) return false;
      if (dateFilter === 'LAST_30_DAYS' && createdMs < thirtyDaysAgo) return false;

      if (q) {
        const sellerName = ((b.sellerId as SellerProfile)?.businessName || b.sender.name).toLowerCase();
        const hay = `${b.bookingId} ${b.lrNumber} ${laneLabel} ${sellerName} ${b.receiver.name} ${b.origin.city} ${b.destination.city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [bookings, routeFilter, dateFilter, search]);

  const tabCounts = useMemo(() => {
    let booked = 0;
    let inTransit = 0;
    let arrived = 0;
    let ndrRto = 0;
    let delivered = 0;
    let closed = 0;

    for (const b of dateAndRouteFiltered) {
      if (b.status === BookingStatus.BOOKED) booked += 1;
      else if (b.status === BookingStatus.ACCEPTED || b.status === BookingStatus.DISPATCHED) {
        inTransit += 1;
      } else if (b.status === BookingStatus.ARRIVED) arrived += 1;
      else if (
        b.status === BookingStatus.NDR ||
        b.status === BookingStatus.RTO_INITIATED ||
        b.status === BookingStatus.RTO_DELIVERED
      ) {
        ndrRto += 1;
      } else if (b.status === BookingStatus.DELIVERED) delivered += 1;
      else if (b.status === BookingStatus.REJECTED || b.status === BookingStatus.CANCELLED) {
        closed += 1;
      }
    }

    return {
      ALL: dateAndRouteFiltered.length,
      NEW: booked,
      IN_TRANSIT: inTransit,
      ARRIVED: arrived,
      NDR_RTO: ndrRto,
      DELIVERED: delivered,
      CLOSED: closed,
    };
  }, [dateAndRouteFiltered]);

  const visibleBookings = useMemo(() => {
    return dateAndRouteFiltered.filter((b) => {
      if (activeTab === 'ALL') return true;
      if (activeTab === 'NEW') return b.status === BookingStatus.BOOKED;
      if (activeTab === 'IN_TRANSIT') {
        return b.status === BookingStatus.ACCEPTED || b.status === BookingStatus.DISPATCHED;
      }
      if (activeTab === 'ARRIVED') return b.status === BookingStatus.ARRIVED;
      if (activeTab === 'NDR_RTO') {
        return (
          b.status === BookingStatus.NDR ||
          b.status === BookingStatus.RTO_INITIATED ||
          b.status === BookingStatus.RTO_DELIVERED
        );
      }
      if (activeTab === 'CLOSED') {
        return b.status === BookingStatus.REJECTED || b.status === BookingStatus.CANCELLED;
      }
      return b.status === BookingStatus.DELIVERED;
    });
  }, [dateAndRouteFiltered, activeTab]);

  useEffect(() => {
    if (visibleBookings.length > 0 && !visibleBookings.some((b) => b._id === selectedId)) {
      setSelectedId(visibleBookings[0]._id);
    }
  }, [visibleBookings, selectedId]);

  const activeBooking = useMemo(() => {
    if (selectedDetail?.booking && selectedDetail.booking._id === selectedId) {
      return selectedDetail.booking;
    }
    return bookings.find((b) => b._id === selectedId) || visibleBookings[0] || null;
  }, [selectedDetail, selectedId, bookings, visibleBookings]);

  const handleAdvanceStatus = async (booking: Booking, targetStatus: BookingStatus) => {
    setUpdatingId(booking._id);
    try {
      await apiClient.patch(`/bookings/${booking._id}/status`, {
        status: targetStatus,
        location: getDefaultLocationForNextStatus(booking, targetStatus),
      });
      showToast(`Shipment ${booking.lrNumber} marked as ${targetStatus}.`, 'success');
      await loadBookings();
      if (booking._id === selectedId) {
        await loadSelectedDetail(booking._id);
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update shipment status.'), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 4) {
      showToast('Please provide a clear rejection reason (at least 4 characters).', 'error');
      return;
    }

    setRejecting(true);
    try {
      await apiClient.patch(`/bookings/${rejectTarget._id}/status`, {
        status: BookingStatus.REJECTED,
        location: `${rejectTarget.origin.city} (${rejectTarget.origin.pincode})`,
        remarks: rejectReason.trim(),
      });
      showToast(
        rejectTarget.paymentMode === 'WALLET'
          ? `Booking ${rejectTarget.lrNumber} rejected and ${formatINR(rejectTarget.finalAmount)} refunded to seller wallet.`
          : `Booking ${rejectTarget.lrNumber} rejected.`,
        'info'
      );
      const targetId = rejectTarget._id;
      setRejectTarget(null);
      setRejectReason('');
      await loadBookings();
      if (targetId === selectedId) {
        await loadSelectedDetail(targetId);
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to reject booking.'), 'error');
    } finally {
      setRejecting(false);
    }
  };

  const handleExceptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionTarget) return;
    if (exceptionReason.trim().length < 4) {
      showToast('Please provide a clear reason (at least 4 characters).', 'error');
      return;
    }
    setSubmittingException(true);
    try {
      await apiClient.patch(`/bookings/${exceptionTarget.booking._id}/status`, {
        status: exceptionTarget.status,
        location: `${exceptionTarget.booking.destination.city} (${exceptionTarget.booking.destination.pincode})`,
        remarks: exceptionReason.trim(),
      });
      showToast(
        exceptionTarget.status === BookingStatus.NDR
          ? `NDR reported for ${exceptionTarget.booking.lrNumber}.`
          : `RTO initiated for ${exceptionTarget.booking.lrNumber}.`,
        'info'
      );
      const targetId = exceptionTarget.booking._id;
      setExceptionTarget(null);
      setExceptionReason('');
      await loadBookings();
      if (targetId === selectedId) {
        await loadSelectedDetail(targetId);
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update status.'), 'error');
    } finally {
      setSubmittingException(false);
    }
  };

  const handleUploadPod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking) return;
    if (!podFile) {
      showToast('Select a JPG, PNG, or WebP delivery proof image first.', 'error');
      return;
    }

    setUploadingPod(true);
    try {
      const formData = new FormData();
      formData.append('image', podFile);
      formData.append('receiverName', podReceiverName.trim() || activeBooking.receiver.name);
      formData.append('deliveryDate', new Date().toISOString().slice(0, 10));
      if (activeBooking.status === BookingStatus.ARRIVED || activeBooking.status === BookingStatus.NDR) {
        formData.append('markDelivered', 'true');
      }

      await apiClient.post(`/bookings/${activeBooking._id}/delivery-proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('Delivery proof uploaded successfully.', 'success');
      setPodFile(null);
      await loadBookings();
      await loadSelectedDetail(activeBooking._id);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to upload delivery proof.'), 'error');
    } finally {
      setUploadingPod(false);
    }
  };

  const currentRank = activeBooking ? STATUS_RANK[activeBooking.status] : 0;
  const nextStatus = activeBooking ? NEXT_BOOKING_STATUS[activeBooking.status] : null;
  const canUploadPod =
    Boolean(activeBooking) &&
    !selectedDetail?.deliveryProof &&
    (activeBooking?.status === BookingStatus.ARRIVED ||
      activeBooking?.status === BookingStatus.NDR ||
      activeBooking?.status === BookingStatus.DELIVERED);
  const scannedCount = activeBooking?.scannedCartons?.length ?? 0;
  const totalCartons = activeBooking?.parcel.numberOfPackages ?? 0;

  return (
    <div className="space-y-4">
      {/* Header & Top Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Assigned Bookings</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Accept or reject incoming dispatches, scan cartons, advance milestones, and upload delivery proof
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Booking ID, LR, party..."
              className="pl-8 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none w-52 sm:w-60"
            />
          </div>

          <label className="relative inline-flex items-center">
            <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="pl-8 pr-7 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 focus:outline-none"
              aria-label="Filter by route"
            >
              <option value="ALL">All Routes</option>
              {routeOptions.map((lane) => (
                <option key={lane} value={lane}>
                  {lane}
                </option>
              ))}
            </select>
          </label>

          <label className="relative inline-flex items-center">
            <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateRangeFilter)}
              className="pl-8 pr-7 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 focus:outline-none"
              aria-label="Filter by date"
            >
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
            </select>
          </label>
        </div>
      </div>

      {/* Status Filter Tabs */}
      {/* <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'ALL', label: `All (${tabCounts.ALL})` },
            { id: 'NEW', label: `New (${tabCounts.NEW})` },
            { id: 'IN_TRANSIT', label: `In Transit (${tabCounts.IN_TRANSIT})` },
            { id: 'ARRIVED', label: `Arrived (${tabCounts.ARRIVED})` },
            { id: 'NDR_RTO', label: `NDR / RTO (${tabCounts.NDR_RTO})` },
            { id: 'DELIVERED', label: `Delivered (${tabCounts.DELIVERED})` },
            { id: 'CLOSED', label: `Cancelled / Rejected (${tabCounts.CLOSED})` },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border transition whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div> */}

      {/* Status Filter Tabs */}
      <div className="border-b border-slate-200 overflow-x-auto">
        <div className="flex items-center min-w-max">
          {(
            [
              { id: 'ALL', label: `All (${tabCounts.ALL})` },
              { id: 'NEW', label: `New (${tabCounts.NEW})` },
              { id: 'IN_TRANSIT', label: `In Transit (${tabCounts.IN_TRANSIT})` },
              { id: 'ARRIVED', label: `Arrived (${tabCounts.ARRIVED})` },
              { id: 'NDR_RTO', label: `NDR / RTO (${tabCounts.NDR_RTO})` },
              { id: 'DELIVERED', label: `Delivered (${tabCounts.DELIVERED})` },
              { id: 'CLOSED', label: `Cancelled / Rejected (${tabCounts.CLOSED})` },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative -mb-px px-4 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors ${active
                    ? 'text-blue-600 border-blue-600 bg-blue-50/50'
                    : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Assigned Bookings Table */}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorBanner message={error} onRetry={loadBookings} />
      ) : visibleBookings.length === 0 ? (
        <EmptyState
          title="No assigned bookings match"
          description="Try switching the status tab, route filter, or date range."
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
                  <th className="py-3 pl-4 pr-2 w-10">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="py-3 px-3">Booking ID</th>
                  <th className="py-3 px-3">Route</th>
                  <th className="py-3 px-3">Sender</th>
                  <th className="py-3 px-3">Receiver</th>
                  <th className="py-3 px-3">Packages</th>
                  <th className="py-3 px-3">Weight</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Booking Time</th>
                  <th className="py-3 pl-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {visibleBookings.map((b) => {
                  const isSelected = activeBooking?._id === b._id;
                  const rowNext = NEXT_BOOKING_STATUS[b.status];
                  const isUpdating = updatingId === b._id;
                  const sellerName = (b.sellerId as SellerProfile)?.businessName || b.sender.name;
                  const rowScanned = b.scannedCartons?.length ?? 0;

                  return (
                    <tr
                      key={b._id}
                      onClick={() => setSelectedId(b._id)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'
                        }`}
                    >
                      <td className="py-3 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => setSelectedId(b._id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select booking ${b.bookingId}`}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(b._id);
                          }}
                          className="font-mono font-semibold text-blue-600 hover:underline tabular-nums block text-left"
                        >
                          {b.bookingId}
                        </button>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {b.lrNumber}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {b.origin.city} → {b.destination.city}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-800 leading-tight">{sellerName}</p>
                        <p className="text-xs text-slate-500">{b.sender.city}</p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-800 leading-tight">
                          {b.receiver.name}
                        </p>
                        <p className="text-xs text-slate-500">{b.receiver.city}</p>
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        <span>
                          {b.parcel.numberOfPackages}{' '}
                          {b.parcel.numberOfPackages === 1 ? 'Box' : 'Boxes'}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          {rowScanned}/{b.parcel.numberOfPackages} scanned
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatWeight(b.chargeableWeight)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="py-3 px-3 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                        {formatShortBookingTime(b.createdAt)}
                      </td>
                      <td
                        className="py-3 pl-3 pr-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          {rowNext && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleAdvanceStatus(b, rowNext)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50 whitespace-nowrap shrink-0"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>
                                {isUpdating
                                  ? 'Updating...'
                                  : rowNext === BookingStatus.ACCEPTED
                                    ? 'Accept'
                                    : rowNext === BookingStatus.DISPATCHED
                                      ? 'Dispatch'
                                      : rowNext === BookingStatus.ARRIVED
                                        ? 'Arrived'
                                        : rowNext === BookingStatus.RTO_DELIVERED
                                          ? 'RTO Delivered'
                                          : 'Deliver'}
                              </span>
                            </button>
                          )}
                          {b.status === BookingStatus.BOOKED && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => {
                                setRejectTarget(b);
                                setRejectReason('');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition disabled:opacity-50 whitespace-nowrap shrink-0"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(`/transporter/bookings/${b._id}`)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition whitespace-nowrap shrink-0"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject Booking Modal */}
      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => !rejecting && setRejectTarget(null)}
        title="Reject Assigned Booking"
        subtitle={
          rejectTarget
            ? `LR ${rejectTarget.lrNumber} · ${rejectTarget.origin.city} → ${rejectTarget.destination.city}`
            : undefined
        }
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          {rejectTarget?.paymentMode === 'WALLET' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              This shipment was prepaid via Seller Wallet ({formatINR(rejectTarget.finalAmount)}).
              Rejecting will automatically refund the full amount back to the seller&apos;s wallet.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Rejection Reason *
            </label>
            <textarea
              rows={3}
              required
              minLength={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., No vehicle capacity available for Pune MIDC pickup today"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-red-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={rejecting}
              onClick={() => setRejectTarget(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={rejecting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>{rejecting ? 'Rejecting...' : 'Confirm Reject'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* NDR / RTO Exception Modal */}
      <Modal
        open={Boolean(exceptionTarget)}
        onClose={() => !submittingException && setExceptionTarget(null)}
        title={
          exceptionTarget?.status === BookingStatus.NDR
            ? 'Report Non-Delivery (NDR)'
            : 'Initiate Return to Origin (RTO)'
        }
        subtitle={
          exceptionTarget
            ? `LR ${exceptionTarget.booking.lrNumber} · ${exceptionTarget.booking.destination.city} → ${exceptionTarget.booking.origin.city}`
            : undefined
        }
      >
        <form onSubmit={handleExceptionSubmit} className="space-y-4">
          {exceptionTarget?.status === BookingStatus.RTO_INITIATED &&
            exceptionTarget.booking.rtoCharges > 0 && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 px-3.5 py-2.5 text-xs text-purple-950">
                RTO charge ({formatINR(exceptionTarget.booking.rtoCharges)}) will be applied to
                seller&apos;s {exceptionTarget.booking.paymentMode === 'WALLET' ? 'wallet / invoice.' : 'invoice account.'}
              </div>
            )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {exceptionTarget?.status === BookingStatus.NDR ? 'NDR Failure Reason *' : 'RTO Reason *'}
            </label>
            <textarea
              rows={3}
              required
              minLength={4}
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              placeholder={
                exceptionTarget?.status === BookingStatus.NDR
                  ? 'e.g., Consignee warehouse closed at delivery time'
                  : 'e.g., Consignee refused delivery; returning to origin'
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={submittingException}
              onClick={() => setExceptionTarget(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingException}
              className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${exceptionTarget?.status === BookingStatus.NDR
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-purple-600 hover:bg-purple-700'
                }`}
            >
              {submittingException
                ? 'Saving...'
                : exceptionTarget?.status === BookingStatus.NDR
                  ? 'Submit NDR'
                  : 'Confirm RTO'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
