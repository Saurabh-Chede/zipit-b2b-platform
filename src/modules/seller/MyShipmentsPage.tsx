// import React, { useCallback, useEffect, useMemo, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import {
//   AlertTriangle,
//   Ban,
//   Barcode,
//   Box,
//   Calendar,
//   Check,
//   CheckCircle2,
//   FileDown,
//   FileText,
//   MapPin,
//   Package,
//   RotateCcw,
//   Scale,
//   Search,
//   Truck,
// } from 'lucide-react';
// import { apiClient, extractErrorMessage } from '../../services/api.ts';
// import { useToast } from '../../context/ToastContext.tsx';
// import { useAuth } from '../../context/AuthContext.tsx';
// import { formatDateTime, formatINR, formatWeight } from '../../utils/formatters.ts';
// import { StatusBadge } from '../../components/ui/StatusBadge.tsx';
// import { Modal } from '../../components/ui/Modal.tsx';
// import { EmptyState, ErrorBanner, LoadingSkeleton } from '../../components/ui/States.tsx';
// import { AuthenticatedProofImage } from '../../components/shared/AuthenticatedProofImage.tsx';
// import {
//   BookingStatus,
//   type Booking,
//   type DeliveryProof,
//   type PaginatedResponse,
//   type TrackingEvent,
//   type Transporter,
// } from '../../types/index.ts';

// type StatusTab = 'ALL' | 'NEW' | 'IN_TRANSIT' | 'ARRIVED' | 'NDR_RTO' | 'DELIVERED' | 'CLOSED';
// type DateRangeFilter = 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS';

// interface BookingDetailPayload {
//   booking: Booking;
//   trackingEvents: TrackingEvent[];
//   deliveryProof: DeliveryProof | null;
// }

// const PROGRESS_STEPS: { status: BookingStatus; label: string }[] = [
//   { status: BookingStatus.ACCEPTED, label: 'Accepted' },
//   { status: BookingStatus.DISPATCHED, label: 'Dispatched' },
//   { status: BookingStatus.ARRIVED, label: 'Arrived' },
//   { status: BookingStatus.DELIVERED, label: 'Delivered' },
// ];

// const STATUS_RANK: Record<BookingStatus, number> = {
//   [BookingStatus.BOOKED]: 0,
//   [BookingStatus.ACCEPTED]: 1,
//   [BookingStatus.DISPATCHED]: 2,
//   [BookingStatus.ARRIVED]: 3,
//   [BookingStatus.DELIVERED]: 4,
//   [BookingStatus.REJECTED]: -1,
//   [BookingStatus.CANCELLED]: -1,
//   [BookingStatus.NDR]: 3,
//   [BookingStatus.RTO_INITIATED]: 3,
//   [BookingStatus.RTO_DELIVERED]: 4,
// };

// function formatShortBookingTime(iso: string): string {
//   const date = new Date(iso);
//   if (Number.isNaN(date.getTime())) return '—';
//   return new Intl.DateTimeFormat('en-IN', {
//     day: '2-digit',
//     month: 'short',
//     hour: '2-digit',
//     minute: '2-digit',
//   }).format(date);
// }

// export function MyShipmentsPage() {
//   const navigate = useNavigate();
//   const { showToast } = useToast();
//   const { refreshUser } = useAuth();

//   const [bookings, setBookings] = useState<Booking[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const [activeTab, setActiveTab] = useState<StatusTab>('ALL');
//   const [routeFilter, setRouteFilter] = useState<string>('ALL');
//   const [dateFilter, setDateFilter] = useState<DateRangeFilter>('ALL');
//   const [search, setSearch] = useState('');

//   const [selectedId, setSelectedId] = useState<string | null>(null);
//   const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
//   const [selectedDetail, setSelectedDetail] = useState<BookingDetailPayload | null>(null);
//   const [loadingDetail, setLoadingDetail] = useState(false);

//   const [downloadingLrId, setDownloadingLrId] = useState<string | null>(null);
//   const [downloadingBulkLr, setDownloadingBulkLr] = useState(false);
//   const [downloadingInvoice, setDownloadingInvoice] = useState(false);
//   const [downloadingBarcode, setDownloadingBarcode] = useState(false);

//   const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
//   const [cancelReason, setCancelReason] = useState('');
//   const [cancelling, setCancelling] = useState(false);

//   const [ndrTarget, setNdrTarget] = useState<Booking | null>(null);
//   const [ndrAction, setNdrAction] = useState<'REATTEMPT' | 'INITIATE_RTO'>('REATTEMPT');
//   const [ndrRemarks, setNdrRemarks] = useState('');
//   const [submittingNdr, setSubmittingNdr] = useState(false);

//   const loadShipments = useCallback(async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       const res = await apiClient.get<{ success: boolean; data: PaginatedResponse<Booking> }>(
//         '/bookings',
//         { params: { page: 1, limit: 100 } }
//       );
//       const items = res.data.data.items;
//       setBookings(items);
//       setSelectedId((prev) => {
//         if (prev && items.some((b) => b._id === prev)) return prev;
//         return items[0]?._id || null;
//       });
//     } catch (err) {
//       setError(extractErrorMessage(err, 'Failed to load bookings.'));
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     loadShipments();
//   }, [loadShipments]);

//   const loadSelectedDetail = useCallback(async (bookingId: string) => {
//     setLoadingDetail(true);
//     try {
//       const res = await apiClient.get<{ success: boolean; data: BookingDetailPayload }>(
//         `/bookings/${bookingId}`
//       );
//       setSelectedDetail(res.data.data);
//     } catch {
//       setSelectedDetail(null);
//     } finally {
//       setLoadingDetail(false);
//     }
//   }, []);

//   useEffect(() => {
//     if (selectedId) {
//       loadSelectedDetail(selectedId);
//     } else {
//       setSelectedDetail(null);
//     }
//   }, [selectedId, loadSelectedDetail]);

//   const routeOptions = useMemo(() => {
//     const map = new Map<string, string>();
//     for (const b of bookings) {
//       const label = `${b.origin.city} → ${b.destination.city}`;
//       map.set(label, label);
//     }
//     return Array.from(map.values());
//   }, [bookings]);

//   const dateAndRouteFiltered = useMemo(() => {
//     const now = new Date();
//     const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
//     const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
//     const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
//     const q = search.trim().toLowerCase();

//     return bookings.filter((b) => {
//       const laneLabel = `${b.origin.city} → ${b.destination.city}`;
//       if (routeFilter !== 'ALL' && laneLabel !== routeFilter) return false;

//       const createdMs = new Date(b.createdAt).getTime();
//       if (dateFilter === 'TODAY' && createdMs < startOfToday) return false;
//       if (dateFilter === 'LAST_7_DAYS' && createdMs < sevenDaysAgo) return false;
//       if (dateFilter === 'LAST_30_DAYS' && createdMs < thirtyDaysAgo) return false;

//       if (q) {
//         const transporterName = ((b.transporterId as Transporter)?.companyName || '').toLowerCase();
//         const hay = `${b.bookingId} ${b.lrNumber} ${laneLabel} ${b.sender.name} ${b.receiver.name} ${transporterName}`.toLowerCase();
//         if (!hay.includes(q)) return false;
//       }

//       return true;
//     });
//   }, [bookings, routeFilter, dateFilter, search]);

//   const tabCounts = useMemo(() => {
//     let booked = 0;
//     let inTransit = 0;
//     let arrived = 0;
//     let ndrRto = 0;
//     let delivered = 0;
//     let closed = 0;

//     for (const b of dateAndRouteFiltered) {
//       if (b.status === BookingStatus.BOOKED) booked += 1;
//       else if (b.status === BookingStatus.ACCEPTED || b.status === BookingStatus.DISPATCHED) {
//         inTransit += 1;
//       } else if (b.status === BookingStatus.ARRIVED) arrived += 1;
//       else if (
//         b.status === BookingStatus.NDR ||
//         b.status === BookingStatus.RTO_INITIATED ||
//         b.status === BookingStatus.RTO_DELIVERED
//       ) {
//         ndrRto += 1;
//       } else if (b.status === BookingStatus.DELIVERED) delivered += 1;
//       else if (b.status === BookingStatus.REJECTED || b.status === BookingStatus.CANCELLED) {
//         closed += 1;
//       }
//     }

//     return {
//       ALL: dateAndRouteFiltered.length,
//       NEW: booked,
//       IN_TRANSIT: inTransit,
//       ARRIVED: arrived,
//       NDR_RTO: ndrRto,
//       DELIVERED: delivered,
//       CLOSED: closed,
//     };
//   }, [dateAndRouteFiltered]);

//   const visibleBookings = useMemo(() => {
//     return dateAndRouteFiltered.filter((b) => {
//       if (activeTab === 'ALL') return true;
//       if (activeTab === 'NEW') return b.status === BookingStatus.BOOKED;
//       if (activeTab === 'IN_TRANSIT') {
//         return b.status === BookingStatus.ACCEPTED || b.status === BookingStatus.DISPATCHED;
//       }
//       if (activeTab === 'ARRIVED') return b.status === BookingStatus.ARRIVED;
//       if (activeTab === 'NDR_RTO') {
//         return (
//           b.status === BookingStatus.NDR ||
//           b.status === BookingStatus.RTO_INITIATED ||
//           b.status === BookingStatus.RTO_DELIVERED
//         );
//       }
//       if (activeTab === 'CLOSED') {
//         return b.status === BookingStatus.REJECTED || b.status === BookingStatus.CANCELLED;
//       }
//       return b.status === BookingStatus.DELIVERED;
//     });
//   }, [dateAndRouteFiltered, activeTab]);

//   useEffect(() => {
//     if (visibleBookings.length > 0 && !visibleBookings.some((b) => b._id === selectedId)) {
//       setSelectedId(visibleBookings[0]._id);
//     }
//   }, [visibleBookings, selectedId]);

//   const activeBooking = useMemo(() => {
//     if (selectedDetail?.booking && selectedDetail.booking._id === selectedId) {
//       return selectedDetail.booking;
//     }
//     return bookings.find((b) => b._id === selectedId) || visibleBookings[0] || null;
//   }, [selectedDetail, selectedId, bookings, visibleBookings]);

//   const triggerBlobDownload = async (endpoint: string, filename: string, mime: string) => {
//     const res = await apiClient.get(endpoint, { responseType: 'blob' });
//     const blob = new Blob([res.data as BlobPart], { type: mime });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = filename;
//     document.body.appendChild(a);
//     a.click();
//     a.remove();
//     URL.revokeObjectURL(url);
//   };

//   const handleDownloadLr = async (booking: Booking) => {
//     setDownloadingLrId(booking._id);
//     try {
//       await triggerBlobDownload(
//         `/bookings/${booking._id}/lr`,
//         `${booking.lrNumber}.pdf`,
//         'application/pdf'
//       );
//       showToast(`Downloaded ${booking.lrNumber}.pdf`, 'success');
//     } catch (err) {
//       showToast(extractErrorMessage(err, 'Failed to download LR PDF.'), 'error');
//     } finally {
//       setDownloadingLrId(null);
//     }
//   };

//   const handleDownloadBarcode = async (booking: Booking) => {
//     setDownloadingBarcode(true);
//     try {
//       await triggerBlobDownload(
//         `/bookings/${booking._id}/barcode?download=1`,
//         `${booking.lrNumber}-barcode.png`,
//         'image/png'
//       );
//       showToast(`Downloaded barcode for ${booking.lrNumber}`, 'success');
//     } catch (err) {
//       showToast(extractErrorMessage(err, 'Failed to download barcode label.'), 'error');
//     } finally {
//       setDownloadingBarcode(false);
//     }
//   };

//   const handleDownloadTaxInvoice = async (booking: Booking) => {
//     setDownloadingInvoice(true);
//     try {
//       await triggerBlobDownload(
//         `/bookings/${booking._id}/tax-invoice`,
//         `${booking.invoiceNumber || booking.lrNumber}-TAX-INVOICE.pdf`,
//         'application/pdf'
//       );
//       showToast('Downloaded GST Tax Invoice PDF', 'success');
//     } catch (err) {
//       showToast(extractErrorMessage(err, 'Failed to download Tax Invoice PDF.'), 'error');
//     } finally {
//       setDownloadingInvoice(false);
//     }
//   };

//   const toggleBulkRow = (bookingId: string) => {
//     setBulkSelectedIds((prev) =>
//       prev.includes(bookingId) ? prev.filter((id) => id !== bookingId) : [...prev, bookingId]
//     );
//   };

//   const allVisibleChecked =
//     visibleBookings.length > 0 && visibleBookings.every((b) => bulkSelectedIds.includes(b._id));

//   const toggleAllVisible = () => {
//     if (allVisibleChecked) {
//       const visibleSet = new Set(visibleBookings.map((b) => b._id));
//       setBulkSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
//     } else {
//       const merged = new Set([...bulkSelectedIds, ...visibleBookings.map((b) => b._id)]);
//       setBulkSelectedIds(Array.from(merged));
//     }
//   };

//   const handleDownloadBulkLr = async () => {
//     if (bulkSelectedIds.length === 0) return;
//     setDownloadingBulkLr(true);
//     try {
//       const res = await apiClient.post(
//         '/bookings/bulk-lr',
//         { bookingIds: bulkSelectedIds },
//         { responseType: 'blob' }
//       );
//       const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
//       const url = URL.createObjectURL(blob);
//       const a = document.createElement('a');
//       a.href = url;
//       a.download = `ZIPIT-LR-BUNDLE-${bulkSelectedIds.length}.pdf`;
//       document.body.appendChild(a);
//       a.click();
//       a.remove();
//       URL.revokeObjectURL(url);
//       showToast(`Downloaded combined PDF for ${bulkSelectedIds.length} LRs.`, 'success');
//     } catch (err) {
//       showToast(extractErrorMessage(err, 'Failed to download selected LR bundle.'), 'error');
//     } finally {
//       setDownloadingBulkLr(false);
//     }
//   };

//   const handleCancelSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!cancelTarget) return;
//     if (cancelReason.trim().length < 4) {
//       showToast('Please enter a cancellation reason (at least 4 characters).', 'error');
//       return;
//     }
//     setCancelling(true);
//     try {
//       const res = await apiClient.post<{ success: boolean; message: string }>(
//         `/bookings/${cancelTarget._id}/cancel`,
//         { reason: cancelReason.trim() }
//       );
//       showToast(res.data.message || 'Booking cancelled.', 'info');
//       const targetId = cancelTarget._id;
//       setCancelTarget(null);
//       setCancelReason('');
//       await Promise.all([loadShipments(), refreshUser()]);
//       if (targetId === selectedId) {
//         await loadSelectedDetail(targetId);
//       }
//     } catch (err) {
//       showToast(extractErrorMessage(err, 'Failed to cancel booking.'), 'error');
//     } finally {
//       setCancelling(false);
//     }
//   };

//   const handleNdrSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!ndrTarget) return;
//     if (ndrRemarks.trim().length < 4) {
//       showToast('Please provide clear instructions or reason (at least 4 characters).', 'error');
//       return;
//     }
//     setSubmittingNdr(true);
//     try {
//       const res = await apiClient.post<{ success: boolean; message: string }>(
//         `/bookings/${ndrTarget._id}/ndr-action`,
//         { action: ndrAction, remarks: ndrRemarks.trim() }
//       );
//       showToast(res.data.message || 'NDR instructions sent.', 'success');
//       const targetId = ndrTarget._id;
//       setNdrTarget(null);
//       setNdrRemarks('');
//       await Promise.all([loadShipments(), refreshUser()]);
//       if (targetId === selectedId) {
//         await loadSelectedDetail(targetId);
//       }
//     } catch (err) {
//       showToast(extractErrorMessage(err, 'Failed to submit NDR instruction.'), 'error');
//     } finally {
//       setSubmittingNdr(false);
//     }
//   };

//   const currentRank = activeBooking ? STATUS_RANK[activeBooking.status] : 0;

//   return (
//     <div className="space-y-4">
//       {/* Header & Top Filters */}
//       <div className="flex flex-wrap items-center justify-between gap-3">
//         <div>
//           <h1 className="text-xl font-bold tracking-tight text-slate-900">My Bookings</h1>
//           <p className="text-xs text-slate-500 mt-0.5">
//             Inspect shipment status, download LR receipts &amp; barcodes, and view proof of delivery
//           </p>
//         </div>

//         <div className="flex flex-wrap items-center gap-2.5">
//           {bulkSelectedIds.length > 0 && (
//             <button
//               type="button"
//               disabled={downloadingBulkLr}
//               onClick={handleDownloadBulkLr}
//               className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition disabled:opacity-50 whitespace-nowrap"
//             >
//               <FileDown className="w-4 h-4" />
//               <span>
//                 {downloadingBulkLr
//                   ? 'Bundling...'
//                   : `Download Selected LRs (${bulkSelectedIds.length})`}
//               </span>
//             </button>
//           )}
//           <div className="relative">
//             <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
//             <input
//               type="text"
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               placeholder="Search Booking ID, LR, receiver..."
//               className="pl-8 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none w-52 sm:w-60"
//             />
//           </div>

//           <label className="relative inline-flex items-center">
//             <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
//             <select
//               value={routeFilter}
//               onChange={(e) => setRouteFilter(e.target.value)}
//               className="pl-8 pr-7 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 focus:outline-none"
//               aria-label="Filter by route"
//             >
//               <option value="ALL">All Routes</option>
//               {routeOptions.map((lane) => (
//                 <option key={lane} value={lane}>
//                   {lane}
//                 </option>
//               ))}
//             </select>
//           </label>

//           <label className="relative inline-flex items-center">
//             <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
//             <select
//               value={dateFilter}
//               onChange={(e) => setDateFilter(e.target.value as DateRangeFilter)}
//               className="pl-8 pr-7 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 focus:outline-none"
//               aria-label="Filter by date"
//             >
//               <option value="ALL">All Dates</option>
//               <option value="TODAY">Today</option>
//               <option value="LAST_7_DAYS">Last 7 Days</option>
//               <option value="LAST_30_DAYS">Last 30 Days</option>
//             </select>
//           </label>
//         </div>
//       </div>

//       {/* Status Tabs */}
//       <div className="flex flex-wrap items-center gap-2">
//         {(
//           [
//             { id: 'ALL', label: `All (${tabCounts.ALL})` },
//             { id: 'NEW', label: `New (${tabCounts.NEW})` },
//             { id: 'IN_TRANSIT', label: `In Transit (${tabCounts.IN_TRANSIT})` },
//             { id: 'ARRIVED', label: `Arrived (${tabCounts.ARRIVED})` },
//             { id: 'NDR_RTO', label: `NDR / RTO (${tabCounts.NDR_RTO})` },
//             { id: 'DELIVERED', label: `Delivered (${tabCounts.DELIVERED})` },
//             { id: 'CLOSED', label: `Cancelled / Rejected (${tabCounts.CLOSED})` },
//           ] as const
//         ).map((tab) => {
//           const active = activeTab === tab.id;
//           return (
//             <button
//               key={tab.id}
//               type="button"
//               onClick={() => setActiveTab(tab.id)}
//               className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border transition whitespace-nowrap ${
//                 active
//                   ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
//                   : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
//               }`}
//             >
//               {tab.label}
//             </button>
//           );
//         })}
//       </div>

//       {/* Bookings Table */}
//       {loading ? (
//         <LoadingSkeleton rows={5} />
//       ) : error ? (
//         <ErrorBanner message={error} onRetry={loadShipments} />
//       ) : visibleBookings.length === 0 ? (
//         <EmptyState
//           title="No matching bookings"
//           description="No bookings match your current status tab, route, or search filter."
//         />
//       ) : (
//         <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
//           <div className="overflow-x-auto">
//             <table className="w-full text-left border-collapse">
//               <thead>
//                 <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
//                   <th className="py-3 pl-4 pr-2 w-10">
//                     <input
//                       type="checkbox"
//                       checked={allVisibleChecked}
//                       onChange={toggleAllVisible}
//                       aria-label="Select all visible shipments for batch LR download"
//                       className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
//                     />
//                   </th>
//                   <th className="py-3 px-3">Booking ID</th>
//                   <th className="py-3 px-3">Route</th>
//                   <th className="py-3 px-3">Transporter</th>
//                   <th className="py-3 px-3">Receiver</th>
//                   <th className="py-3 px-3">Packages</th>
//                   <th className="py-3 px-3">Weight</th>
//                   <th className="py-3 px-3">Amount</th>
//                   <th className="py-3 px-3">Booking Time</th>
//                   <th className="py-3 pl-3 pr-4 text-right">Action</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-slate-100 text-sm">
//                 {visibleBookings.map((b) => {
//                   const isSelected = activeBooking?._id === b._id;
//                   const isChecked = bulkSelectedIds.includes(b._id);
//                   const transporterName = (b.transporterId as Transporter)?.companyName || '—';

//                   return (
//                     <tr
//                       key={b._id}
//                       onClick={() => setSelectedId(b._id)}
//                       className={`cursor-pointer transition-colors ${
//                         isSelected
//                           ? 'bg-blue-50/50 border-l-4 border-l-blue-600'
//                           : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'
//                       }`}
//                     >
//                       <td className="py-3 pl-3 pr-2">
//                         <input
//                           type="checkbox"
//                           checked={isChecked}
//                           onChange={() => toggleBulkRow(b._id)}
//                           onClick={(e) => e.stopPropagation()}
//                           aria-label={`Select booking ${b.bookingId} for batch LR PDF`}
//                           className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
//                         />
//                       </td>
//                       <td className="py-3 px-3">
//                         <button
//                           type="button"
//                           onClick={(e) => {
//                             e.stopPropagation();
//                             setSelectedId(b._id);
//                           }}
//                           className="font-mono font-semibold text-blue-600 hover:underline tabular-nums block text-left"
//                         >
//                           {b.bookingId}
//                         </button>
//                         <span className="font-mono text-[11px] text-slate-400 tabular-nums">
//                           {b.lrNumber}
//                         </span>
//                       </td>
//                       <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
//                         {b.origin.city} → {b.destination.city}
//                       </td>
//                       <td className="py-3 px-3">
//                         <p className="font-medium text-slate-800 leading-tight truncate max-w-[180px]">
//                           {transporterName}
//                         </p>
//                       </td>
//                       <td className="py-3 px-3">
//                         <p className="font-semibold text-slate-800 leading-tight">
//                           {b.receiver.name}
//                         </p>
//                         <p className="text-xs text-slate-500">{b.receiver.city}</p>
//                       </td>
//                       <td className="py-3 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
//                         {b.parcel.numberOfPackages}{' '}
//                         {b.parcel.numberOfPackages === 1 ? 'Box' : 'Boxes'}
//                       </td>
//                       <td className="py-3 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
//                         {formatWeight(b.chargeableWeight)}
//                       </td>
//                       <td className="py-3 px-3 font-mono font-semibold tabular-nums text-slate-900 whitespace-nowrap">
//                         {formatINR(b.finalAmount)}
//                       </td>
//                       <td className="py-3 px-3 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
//                         {formatShortBookingTime(b.createdAt)}
//                       </td>
//                       <td
//                         className="py-3 pl-3 pr-4 text-right whitespace-nowrap"
//                         onClick={(e) => e.stopPropagation()}
//                       >
//                         <div className="inline-flex items-center gap-2">
//                           <button
//                             type="button"
//                             disabled={downloadingLrId === b._id}
//                             onClick={() => handleDownloadLr(b)}
//                             className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
//                           >
//                             <FileDown className="w-3.5 h-3.5" />
//                             <span>{downloadingLrId === b._id ? 'PDF...' : 'LR PDF'}</span>
//                           </button>
//                           <button
//                             type="button"
//                             onClick={() => navigate(`/seller/shipments/${b._id}`)}
//                             className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
//                           >
//                             View
//                           </button>
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       )}

//       {/* Bottom 3-Card Selected Booking Workbench */}

//       {/* Self-Cancel Modal */}
//       <Modal
//         open={Boolean(cancelTarget)}
//         onClose={() => !cancelling && setCancelTarget(null)}
//         title="Cancel Shipment Booking"
//         subtitle={
//           cancelTarget
//             ? `LR ${cancelTarget.lrNumber} · ${cancelTarget.origin.city} → ${cancelTarget.destination.city}`
//             : undefined
//         }
//       >
//         <form onSubmit={handleCancelSubmit} className="space-y-4">
//           {cancelTarget?.paymentMode === 'WALLET' && (
//             <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900">
//               Full prepaid freight ({formatINR(cancelTarget.finalAmount)}) will be refunded
//               automatically to your Zipit Wallet.
//             </div>
//           )}
//           <div>
//             <label className="block text-sm font-medium text-slate-700 mb-1">
//               Cancellation Reason *
//             </label>
//             <textarea
//               rows={3}
//               required
//               minLength={4}
//               value={cancelReason}
//               onChange={(e) => setCancelReason(e.target.value)}
//               placeholder="e.g., Buyer postponed order / pickup reschedule required"
//               className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-500"
//             />
//           </div>
//           <div className="flex justify-end gap-2.5">
//             <button
//               type="button"
//               disabled={cancelling}
//               onClick={() => setCancelTarget(null)}
//               className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
//             >
//               Keep Booking
//             </button>
//             <button
//               type="submit"
//               disabled={cancelling}
//               className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
//             >
//               {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
//             </button>
//           </div>
//         </form>
//       </Modal>

//       {/* NDR Resolution Modal */}
//       <Modal
//         open={Boolean(ndrTarget)}
//         onClose={() => !submittingNdr && setNdrTarget(null)}
//         title="Resolve Non-Delivery Report (NDR)"
//         subtitle={
//           ndrTarget ? `LR ${ndrTarget.lrNumber} · Attempt #${ndrTarget.ndrAttempts || 1}` : undefined
//         }
//       >
//         <form onSubmit={handleNdrSubmit} className="space-y-4">
//           {ndrTarget?.ndrReason && (
//             <div className="rounded-lg border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-xs text-orange-950">
//               <strong>Carrier NDR Remark:</strong> {ndrTarget.ndrReason}
//             </div>
//           )}

//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//             <button
//               type="button"
//               onClick={() => setNdrAction('REATTEMPT')}
//               className={`p-3 rounded-xl border text-left transition ${
//                 ndrAction === 'REATTEMPT'
//                   ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
//                   : 'border-slate-200 bg-white hover:bg-slate-50'
//               }`}
//             >
//               <p className="text-sm font-semibold text-slate-900">Request Re-Attempt</p>
//               <p className="text-xs text-slate-600 mt-0.5">Send instructions to transporter</p>
//             </button>

//             <button
//               type="button"
//               onClick={() => setNdrAction('INITIATE_RTO')}
//               className={`p-3 rounded-xl border text-left transition ${
//                 ndrAction === 'INITIATE_RTO'
//                   ? 'border-purple-600 bg-purple-50/70 ring-1 ring-purple-600'
//                   : 'border-slate-200 bg-white hover:bg-slate-50'
//               }`}
//             >
//               <p className="text-sm font-semibold text-slate-900">Initiate RTO Return</p>
//               <p className="text-xs text-slate-600 mt-0.5">
//                 Return to origin ({formatINR(ndrTarget?.rtoCharges || 0)})
//               </p>
//             </button>
//           </div>

//           <div>
//             <label className="block text-sm font-medium text-slate-700 mb-1">
//               {ndrAction === 'REATTEMPT' ? 'Re-Attempt Instructions *' : 'RTO Reason *'}
//             </label>
//             <textarea
//               rows={3}
//               required
//               minLength={4}
//               value={ndrRemarks}
//               onChange={(e) => setNdrRemarks(e.target.value)}
//               placeholder={
//                 ndrAction === 'REATTEMPT'
//                   ? 'Updated delivery time window or alternate phone number'
//                   : 'Confirm return to origin warehouse'
//               }
//               className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
//             />
//           </div>

//           <div className="flex justify-end gap-2.5">
//             <button
//               type="button"
//               disabled={submittingNdr}
//               onClick={() => setNdrTarget(null)}
//               className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
//             >
//               Cancel
//             </button>
//             <button
//               type="submit"
//               disabled={submittingNdr}
//               className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${
//                 ndrAction === 'INITIATE_RTO'
//                   ? 'bg-purple-600 hover:bg-purple-700'
//                   : 'bg-blue-600 hover:bg-blue-700'
//               }`}
//             >
//               {submittingNdr
//                 ? 'Submitting...'
//                 : ndrAction === 'INITIATE_RTO'
//                   ? 'Confirm RTO Return'
//                   : 'Send Instructions'}
//             </button>
//           </div>
//         </form>
//       </Modal>
//     </div>
//   );
// }

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Ban,
  Barcode,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  FileDown,
  FileText,
  MapPin,
  Package,
  RotateCcw,
  Scale,
  Search,
  Truck,
} from 'lucide-react';
import { apiClient, extractErrorMessage } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { formatDateTime, formatINR, formatWeight } from '../../utils/formatters.ts';
import { StatusBadge } from '../../components/ui/StatusBadge.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../../components/ui/States.tsx';
import { AuthenticatedProofImage } from '../../components/shared/AuthenticatedProofImage.tsx';
import {
  BookingStatus,
  type Booking,
  type DeliveryProof,
  type PaginatedResponse,
  type TrackingEvent,
  type Transporter,
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

// Table typography & layout tokens (keep all table cells consistent)
const TH =
  'px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate';
const TD = 'px-3 py-3 align-middle';
const PRIMARY = 'text-[13px] font-medium text-slate-900 leading-5 truncate';
const SECONDARY = 'text-xs text-slate-500 leading-4 truncate';
const ACTION_BTN =
  'inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition disabled:opacity-50';
const MOBILE_BTN =
  'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition disabled:opacity-50';

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'NEW', label: 'New' },
  { id: 'IN_TRANSIT', label: 'In Transit' },
  { id: 'ARRIVED', label: 'Arrived' },
  { id: 'NDR_RTO', label: 'NDR / RTO' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CLOSED', label: 'Cancelled / Rejected' },
];

export function MyShipmentsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { refreshUser } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<StatusTab>('ALL');
  const [routeFilter, setRouteFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('ALL');
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<BookingDetailPayload | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [downloadingLrId, setDownloadingLrId] = useState<string | null>(null);
  const [downloadingBulkLr, setDownloadingBulkLr] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [downloadingBarcode, setDownloadingBarcode] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [ndrTarget, setNdrTarget] = useState<Booking | null>(null);
  const [ndrAction, setNdrAction] = useState<'REATTEMPT' | 'INITIATE_RTO'>('REATTEMPT');
  const [ndrRemarks, setNdrRemarks] = useState('');
  const [submittingNdr, setSubmittingNdr] = useState(false);

  const tabScrollRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Partial<Record<StatusTab, HTMLButtonElement | null>>>({});
  const tabsMountedRef = useRef(false);
  const [tabIndicator, setTabIndicator] = useState<{ left: number; width: number } | null>(null);
  const [tabIndicatorAnimated, setTabIndicatorAnimated] = useState(false);

  const loadShipments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: PaginatedResponse<Booking> }>(
        '/bookings',
        { params: { page: 1, limit: 100 } }
      );
      const items = res.data.data.items;
      setBookings(items);
      setSelectedId((prev) => {
        if (prev && items.some((b) => b._id === prev)) return prev;
        return items[0]?._id || null;
      });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load bookings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  const loadSelectedDetail = useCallback(async (bookingId: string) => {
    setLoadingDetail(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: BookingDetailPayload }>(
        `/bookings/${bookingId}`
      );
      setSelectedDetail(res.data.data);
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
        const transporterName = ((b.transporterId as Transporter)?.companyName || '').toLowerCase();
        const hay = `${b.bookingId} ${b.lrNumber} ${laneLabel} ${b.sender.name} ${b.receiver.name} ${transporterName}`.toLowerCase();
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

  const triggerBlobDownload = async (endpoint: string, filename: string, mime: string) => {
    const res = await apiClient.get(endpoint, { responseType: 'blob' });
    const blob = new Blob([res.data as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadLr = async (booking: Booking) => {
    setDownloadingLrId(booking._id);
    try {
      await triggerBlobDownload(
        `/bookings/${booking._id}/lr`,
        `${booking.lrNumber}.pdf`,
        'application/pdf'
      );
      showToast(`Downloaded ${booking.lrNumber}.pdf`, 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to download LR PDF.'), 'error');
    } finally {
      setDownloadingLrId(null);
    }
  };

  const handleDownloadBarcode = async (booking: Booking) => {
    setDownloadingBarcode(true);
    try {
      await triggerBlobDownload(
        `/bookings/${booking._id}/barcode?download=1`,
        `${booking.lrNumber}-barcode.png`,
        'image/png'
      );
      showToast(`Downloaded barcode for ${booking.lrNumber}`, 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to download barcode label.'), 'error');
    } finally {
      setDownloadingBarcode(false);
    }
  };

  const handleDownloadTaxInvoice = async (booking: Booking) => {
    setDownloadingInvoice(true);
    try {
      await triggerBlobDownload(
        `/bookings/${booking._id}/tax-invoice`,
        `${booking.invoiceNumber || booking.lrNumber}-TAX-INVOICE.pdf`,
        'application/pdf'
      );
      showToast('Downloaded GST Tax Invoice PDF', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to download Tax Invoice PDF.'), 'error');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const toggleBulkRow = (bookingId: string) => {
    setBulkSelectedIds((prev) =>
      prev.includes(bookingId) ? prev.filter((id) => id !== bookingId) : [...prev, bookingId]
    );
  };

  const allVisibleChecked =
    visibleBookings.length > 0 && visibleBookings.every((b) => bulkSelectedIds.includes(b._id));

  const toggleAllVisible = () => {
    if (allVisibleChecked) {
      const visibleSet = new Set(visibleBookings.map((b) => b._id));
      setBulkSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const merged = new Set([...bulkSelectedIds, ...visibleBookings.map((b) => b._id)]);
      setBulkSelectedIds(Array.from(merged));
    }
  };

  const handleDownloadBulkLr = async () => {
    if (bulkSelectedIds.length === 0) return;
    setDownloadingBulkLr(true);
    try {
      const res = await apiClient.post(
        '/bookings/bulk-lr',
        { bookingIds: bulkSelectedIds },
        { responseType: 'blob' }
      );
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ZIPIT-LR-BUNDLE-${bulkSelectedIds.length}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(`Downloaded combined PDF for ${bulkSelectedIds.length} LRs.`, 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to download selected LR bundle.'), 'error');
    } finally {
      setDownloadingBulkLr(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 4) {
      showToast('Please enter a cancellation reason (at least 4 characters).', 'error');
      return;
    }
    setCancelling(true);
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>(
        `/bookings/${cancelTarget._id}/cancel`,
        { reason: cancelReason.trim() }
      );
      showToast(res.data.message || 'Booking cancelled.', 'info');
      const targetId = cancelTarget._id;
      setCancelTarget(null);
      setCancelReason('');
      await Promise.all([loadShipments(), refreshUser()]);
      if (targetId === selectedId) {
        await loadSelectedDetail(targetId);
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to cancel booking.'), 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleNdrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ndrTarget) return;
    if (ndrRemarks.trim().length < 4) {
      showToast('Please provide clear instructions or reason (at least 4 characters).', 'error');
      return;
    }
    setSubmittingNdr(true);
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>(
        `/bookings/${ndrTarget._id}/ndr-action`,
        { action: ndrAction, remarks: ndrRemarks.trim() }
      );
      showToast(res.data.message || 'NDR instructions sent.', 'success');
      const targetId = ndrTarget._id;
      setNdrTarget(null);
      setNdrRemarks('');
      await Promise.all([loadShipments(), refreshUser()]);
      if (targetId === selectedId) {
        await loadSelectedDetail(targetId);
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to submit NDR instruction.'), 'error');
    } finally {
      setSubmittingNdr(false);
    }
  };

  const measureTabIndicator = useCallback(() => {
    const el = tabRefs.current[activeTab];
    if (!el) return;
    setTabIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeTab]);

  // Re-measure when the active tab or the counts (label widths) change
  useLayoutEffect(() => {
    measureTabIndicator();
  }, [measureTabIndicator, tabCounts]);

  useEffect(() => {
    window.addEventListener('resize', measureTabIndicator);
    return () => window.removeEventListener('resize', measureTabIndicator);
  }, [measureTabIndicator]);

  // Enable the slide animation only after the first paint
  useEffect(() => {
    const raf = requestAnimationFrame(() => setTabIndicatorAnimated(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Keep the active tab centered when the tab bar scrolls (mobile)
  useEffect(() => {
    if (!tabsMountedRef.current) {
      tabsMountedRef.current = true;
      return;
    }
    const container = tabScrollRef.current;
    const el = tabRefs.current[activeTab];
    if (!container || !el) return;
    container.scrollTo({
      left: el.offsetLeft - (container.clientWidth - el.offsetWidth) / 2,
      behavior: 'smooth',
    });
  }, [activeTab]);

  const currentRank = activeBooking ? STATUS_RANK[activeBooking.status] : 0;

  return (
    <div className="space-y-4">
      {/* Header & Top Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">My Bookings</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect shipment status, download LR receipts &amp; barcodes, and view proof of delivery
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          {bulkSelectedIds.length > 0 && (
            <button
              type="button"
              disabled={downloadingBulkLr}
              onClick={handleDownloadBulkLr}
              className="inline-flex w-full items-center justify-center gap-1.5 sm:w-auto px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition disabled:opacity-50 whitespace-nowrap"
            >
              <FileDown className="w-4 h-4" />
              <span>
                {downloadingBulkLr
                  ? 'Bundling...'
                  : `Download Selected LRs (${bulkSelectedIds.length})`}
              </span>
            </button>
          )}
          <div className="relative w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Booking ID, LR, receiver..."
              className="pl-8 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none w-full sm:w-60"
            />
          </div>

          <label className="relative inline-flex min-w-0 flex-1 items-center sm:flex-none">
            <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="w-full min-w-0 sm:w-auto pl-8 pr-7 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 focus:outline-none"
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

          <label className="relative inline-flex min-w-0 flex-1 items-center sm:flex-none">
            <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateRangeFilter)}
              className="w-full min-w-0 sm:w-auto pl-8 pr-7 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 focus:outline-none"
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

      {/* Status Tabs (segmented, sliding highlight) */}
      <div
        ref={tabScrollRef}
        className="max-w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          role="tablist"
          aria-label="Filter bookings by status"
          className="relative inline-flex min-w-max rounded-xl border border-slate-200 bg-slate-100 p-1"
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-1 left-0 top-1 rounded-lg bg-blue-600 shadow-sm ${
              tabIndicatorAnimated ? 'transition-[transform,width] duration-300 ease-out' : ''
            }`}
            style={{
              width: tabIndicator?.width ?? 0,
              transform: `translateX(${tabIndicator?.left ?? 0}px)`,
              opacity: tabIndicator ? 1 : 0,
            }}
          />
          {STATUS_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`relative z-10 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-300 sm:text-sm ${
                  active ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label} ({tabCounts[tab.id]})
              </button>
            );
          })}
        </div>
      </div>

      {/* Bookings Table */}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorBanner message={error} onRetry={loadShipments} />
      ) : visibleBookings.length === 0 ? (
        <EmptyState
          title="No matching bookings"
          description="No bookings match your current status tab, route, or search filter."
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden lg:block">
            <table className="w-full table-fixed text-left border-collapse">
              <colgroup>
                <col style={{ width: '44px' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '11%' }} />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 border-l-4 border-l-transparent">
                  <th className="py-3 pl-3 pr-0">
                    <input
                      type="checkbox"
                      checked={allVisibleChecked}
                      onChange={toggleAllVisible}
                      aria-label="Select all visible shipments for batch LR download"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className={TH}>Booking ID</th>
                  <th className={TH}>Route</th>
                  <th className={TH}>Transporter</th>
                  <th className={TH}>Receiver</th>
                  <th className={TH}>Packages</th>
                  <th className={TH}>Amount</th>
                  <th className={`${TH} text-right`}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleBookings.map((b) => {
                  const isSelected = activeBooking?._id === b._id;
                  const isChecked = bulkSelectedIds.includes(b._id);
                  const transporterName = (b.transporterId as Transporter)?.companyName || '—';
                  const pkgs = b.parcel.numberOfPackages;

                  return (
                    <tr
                      key={b._id}
                      onClick={() => setSelectedId(b._id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/50 border-l-4 border-l-blue-600'
                          : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <td className="py-3 pl-3 pr-0 align-middle">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleBulkRow(b._id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select booking ${b.bookingId} for batch LR PDF`}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Booking ID + LR */}
                      <td className={TD}>
                        <p className="font-mono text-[13px] font-semibold text-blue-600 tabular-nums leading-5 truncate">
                          {b.bookingId}
                        </p>
                        <p className={`${SECONDARY} font-mono tabular-nums`}>{b.lrNumber}</p>
                      </td>

                      {/* Route */}
                      <td className={TD}>
                        <p className={PRIMARY}>
                          {b.origin.city} <span className="text-slate-400">→</span> {b.destination.city}
                        </p>
                        <p className={`${SECONDARY} tabular-nums`}>
                          {b.origin.pincode} → {b.destination.pincode}
                        </p>
                      </td>

                      {/* Transporter */}
                      <td className={TD}>
                        <p className={PRIMARY} title={transporterName}>
                          {transporterName}
                        </p>
                      </td>

                      {/* Receiver */}
                      <td className={TD}>
                        <p className={PRIMARY} title={b.receiver.name}>
                          {b.receiver.name}
                        </p>
                        <p className={SECONDARY}>{b.receiver.city}</p>
                      </td>

                      {/* Packages + Weight */}
                      <td className={TD}>
                        <p className={`${PRIMARY} tabular-nums`}>
                          {pkgs} {pkgs === 1 ? 'Box' : 'Boxes'}
                        </p>
                        <p className={`${SECONDARY} tabular-nums`}>{formatWeight(b.chargeableWeight)}</p>
                      </td>

                      {/* Amount + Booking time */}
                      <td className={TD}>
                        <p className={`${PRIMARY} tabular-nums`}>{formatINR(b.finalAmount)}</p>
                        <p className={`${SECONDARY} tabular-nums`}>
                          {formatShortBookingTime(b.createdAt)}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className={`${TD} text-right`} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={downloadingLrId === b._id}
                            onClick={() => handleDownloadLr(b)}
                            className={`${ACTION_BTN} bg-blue-600 text-white hover:bg-blue-700`}
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            {downloadingLrId === b._id ? 'PDF...' : 'LR PDF'}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/seller/shipments/${b._id}`)}
                            className={`${ACTION_BTN} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
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

          {/* Mobile / tablet cards */}
          <div className="lg:hidden">
            <label className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={allVisibleChecked}
                onChange={toggleAllVisible}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Select all ({visibleBookings.length})</span>
            </label>

            <div className="divide-y divide-slate-100">
              {visibleBookings.map((b) => {
                const isSelected = activeBooking?._id === b._id;
                const isChecked = bulkSelectedIds.includes(b._id);
                const transporterName = (b.transporterId as Transporter)?.companyName || '—';
                const pkgs = b.parcel.numberOfPackages;

                return (
                  <div
                    key={b._id}
                    onClick={() => setSelectedId(b._id)}
                    className={`cursor-pointer border-l-4 p-4 transition-colors ${
                      isSelected ? 'border-l-blue-600 bg-blue-50/50' : 'border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleBulkRow(b._id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select booking ${b.bookingId} for batch LR PDF`}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[13px] font-semibold leading-5 text-blue-600 tabular-nums truncate">
                          {b.bookingId}
                        </p>
                        <p className={`${SECONDARY} font-mono tabular-nums`}>{b.lrNumber}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`${PRIMARY} tabular-nums`}>{formatINR(b.finalAmount)}</p>
                        <p className={`${SECONDARY} tabular-nums`}>
                          {formatShortBookingTime(b.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className={PRIMARY}>
                        {b.origin.city} <span className="text-slate-400">→</span> {b.destination.city}
                      </p>
                      <p className={`${SECONDARY} tabular-nums`}>
                        {b.origin.pincode} → {b.destination.pincode}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Transporter
                        </p>
                        <p className={PRIMARY} title={transporterName}>
                          {transporterName}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Receiver
                        </p>
                        <p className={PRIMARY} title={b.receiver.name}>
                          {b.receiver.name}
                        </p>
                        <p className={SECONDARY}>{b.receiver.city}</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                      <p className="truncate text-xs text-slate-600 tabular-nums">
                        <span className="font-medium text-slate-900">
                          {pkgs} {pkgs === 1 ? 'Box' : 'Boxes'}
                        </span>
                        <span className="text-slate-500"> · {formatWeight(b.chargeableWeight)}</span>
                      </p>
                    </div>

                    <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={downloadingLrId === b._id}
                        onClick={() => handleDownloadLr(b)}
                        className={`${MOBILE_BTN} bg-blue-600 text-white hover:bg-blue-700`}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        {downloadingLrId === b._id ? 'PDF...' : 'LR PDF'}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/seller/shipments/${b._id}`)}
                        className={`${MOBILE_BTN} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom 3-Card Selected Booking Workbench */}

      {/* Self-Cancel Modal */}
      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => !cancelling && setCancelTarget(null)}
        title="Cancel Shipment Booking"
        subtitle={
          cancelTarget
            ? `LR ${cancelTarget.lrNumber} · ${cancelTarget.origin.city} → ${cancelTarget.destination.city}`
            : undefined
        }
      >
        <form onSubmit={handleCancelSubmit} className="space-y-4">
          {cancelTarget?.paymentMode === 'WALLET' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900">
              Full prepaid freight ({formatINR(cancelTarget.finalAmount)}) will be refunded
              automatically to your Zipit Wallet.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Cancellation Reason *
            </label>
            <textarea
              rows={3}
              required
              minLength={4}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Buyer postponed order / pickup reschedule required"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-500"
            />
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              disabled={cancelling}
              onClick={() => setCancelTarget(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
            >
              Keep Booking
            </button>
            <button
              type="submit"
              disabled={cancelling}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* NDR Resolution Modal */}
      <Modal
        open={Boolean(ndrTarget)}
        onClose={() => !submittingNdr && setNdrTarget(null)}
        title="Resolve Non-Delivery Report (NDR)"
        subtitle={
          ndrTarget ? `LR ${ndrTarget.lrNumber} · Attempt #${ndrTarget.ndrAttempts || 1}` : undefined
        }
      >
        <form onSubmit={handleNdrSubmit} className="space-y-4">
          {ndrTarget?.ndrReason && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-xs text-orange-950">
              <strong>Carrier NDR Remark:</strong> {ndrTarget.ndrReason}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setNdrAction('REATTEMPT')}
              className={`p-3 rounded-xl border text-left transition ${
                ndrAction === 'REATTEMPT'
                  ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">Request Re-Attempt</p>
              <p className="text-xs text-slate-600 mt-0.5">Send instructions to transporter</p>
            </button>

            <button
              type="button"
              onClick={() => setNdrAction('INITIATE_RTO')}
              className={`p-3 rounded-xl border text-left transition ${
                ndrAction === 'INITIATE_RTO'
                  ? 'border-purple-600 bg-purple-50/70 ring-1 ring-purple-600'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">Initiate RTO Return</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Return to origin ({formatINR(ndrTarget?.rtoCharges || 0)})
              </p>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {ndrAction === 'REATTEMPT' ? 'Re-Attempt Instructions *' : 'RTO Reason *'}
            </label>
            <textarea
              rows={3}
              required
              minLength={4}
              value={ndrRemarks}
              onChange={(e) => setNdrRemarks(e.target.value)}
              placeholder={
                ndrAction === 'REATTEMPT'
                  ? 'Updated delivery time window or alternate phone number'
                  : 'Confirm return to origin warehouse'
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              disabled={submittingNdr}
              onClick={() => setNdrTarget(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingNdr}
              className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${
                ndrAction === 'INITIATE_RTO'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {submittingNdr
                ? 'Submitting...'
                : ndrAction === 'INITIATE_RTO'
                  ? 'Confirm RTO Return'
                  : 'Send Instructions'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}