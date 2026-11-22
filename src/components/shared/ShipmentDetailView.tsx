import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Ban, Barcode, CheckCircle2, Download, FileText, Link2, RotateCcw, ScanLine, XCircle } from 'lucide-react';
import { apiClient, extractErrorMessage } from '../../services/api.ts';
import { formatDate, formatDateTime, formatINR, formatWeight } from '../../utils/formatters.ts';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import { TrackingTimeline } from '../ui/TrackingTimeline.tsx';
import { ErrorBanner, LoadingSkeleton } from '../ui/States.tsx';
import { AuthenticatedProofImage } from './AuthenticatedProofImage.tsx';
import { WeightDiscrepancyCard } from './WeightDiscrepancyCard.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  BookingStatus,
  UserRole,
  type Booking,
  type DeliveryProof,
  type SellerProfile,
  type TrackingEvent,
  type Transporter,
  type WeightDiscrepancy,
} from '../../types/index.ts';

export interface ShipmentDetailsPayload {
  booking: Booking;
  trackingEvents: TrackingEvent[];
  deliveryProof: DeliveryProof | null;
  weightDiscrepancy?: WeightDiscrepancy | null;
}

interface ShipmentDetailViewProps {
  bookingId: string;
  backPath: string;
  renderActions?: (
    data: ShipmentDetailsPayload,
    reload: () => Promise<void>
  ) => React.ReactNode;
}

export function ShipmentDetailView({
  bookingId,
  backPath,
  renderActions,
}: ShipmentDetailViewProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [data, setData] = useState<ShipmentDetailsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingLr, setDownloadingLr] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [cartonScanInput, setCartonScanInput] = useState('');
  const [scanningCarton, setScanningCarton] = useState(false);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: ShipmentDetailsPayload }>(
        `/bookings/${bookingId}`
      );
      setData(res.data.data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load shipment details.'));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleDownloadLr = async () => {
    if (!data) return;
    setDownloadingLr(true);
    try {
      const res = await apiClient.get(`/bookings/${bookingId}/lr`, { responseType: 'blob' });
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.booking.lrNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${data.booking.lrNumber}.pdf`, 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to download LR PDF'), 'error');
    } finally {
      setDownloadingLr(false);
    }
  };

  const handleDownloadTaxInvoice = async () => {
    if (!data) return;
    setDownloadingInvoice(true);
    try {
      const res = await apiClient.get(`/bookings/${bookingId}/tax-invoice`, { responseType: 'blob' });
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.booking.invoiceNumber || data.booking.lrNumber}-TAX-INVOICE.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Downloaded GST Tax Invoice PDF', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to download Tax Invoice PDF'), 'error');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const handleCopyBuyerTrackingLink = async () => {
    if (!data) return;
    const url = `${window.location.origin}/track/${encodeURIComponent(data.booking.lrNumber)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Buyer tracking link copied to clipboard.', 'success');
    } catch {
      showToast(url, 'info');
    }
  };

  const handleDownloadCartonBarcode = async (cartonNumber: number, cartonCode: string) => {
    try {
      const res = await apiClient.get(
        `/bookings/${bookingId}/cartons/${cartonNumber}/barcode?download=1`,
        { responseType: 'blob' }
      );
      const blob = new Blob([res.data as BlobPart], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cartonCode}-barcode.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(`Downloaded barcode for ${cartonCode}`, 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to download carton barcode.'), 'error');
    }
  };

  const handleScanCarton = async (payload: { cartonNumber?: number; cartonCode?: string }) => {
    setScanningCarton(true);
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>(
        `/bookings/${bookingId}/cartons/scan`,
        payload
      );
      showToast(res.data.message, 'success');
      setCartonScanInput('');
      await loadDetails();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to scan carton barcode.'), 'error');
    } finally {
      setScanningCarton(false);
    }
  };

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error || !data) return <ErrorBanner message={error || 'Shipment not found'} onRetry={loadDetails} />;

  const { booking, trackingEvents, deliveryProof } = data;
  const transporter = booking.transporterId as Transporter;
  const seller = booking.sellerId as SellerProfile;
  const isTransporter = user?.role === UserRole.TRANSPORTER;
  const totalCartons = Math.max(1, booking.parcel.numberOfPackages || 1);
  const scannedMap = new Map(
    (booking.scannedCartons || []).map((c) => [c.cartonNumber, c])
  );
  const scannedCount = scannedMap.size;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            aria-label="Back to list"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900 font-mono tabular-nums">
                {booking.lrNumber}
              </h1>
              <StatusBadge status={booking.status} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
              <span className="font-mono">{booking.bookingId}</span>
              <span aria-hidden="true">·</span>
              <span>Created {formatDateTime(booking.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyBuyerTrackingLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Link2 className="w-4 h-4 text-blue-600" />
            <span>Copy Buyer Tracking Link</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTaxInvoice}
            disabled={downloadingInvoice}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-slate-600" />
            <span>{downloadingInvoice ? 'Generating...' : 'Tax Invoice PDF'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadLr}
            disabled={downloadingLr}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{downloadingLr ? 'Generating PDF...' : 'Download LR PDF'}</span>
          </button>
          {renderActions && renderActions(data, loadDetails)}
        </div>
      </div>

      {booking.status === BookingStatus.REJECTED && booking.rejectionReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3 text-sm text-red-900">
          <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Booking Rejected by Transporter</p>
            <p className="text-xs text-red-800 mt-0.5">
              Reason: {booking.rejectionReason}
              {booking.paymentMode === 'WALLET'
                ? ' · Paid wallet amount was automatically refunded to the seller.'
                : ''}
            </p>
          </div>
        </div>
      )}

      {booking.status === BookingStatus.CANCELLED && (
        <div className="rounded-xl border border-slate-300 bg-slate-100 px-5 py-4 flex items-start gap-3 text-sm text-slate-900">
          <Ban className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Booking Self-Cancelled by Seller</p>
            <p className="text-xs text-slate-700 mt-0.5">
              {booking.cancellationReason ? `Reason: ${booking.cancellationReason}` : 'Cancelled prior to dispatch.'}
              {booking.paymentMode === 'WALLET'
                ? ' · Paid wallet amount was automatically refunded to the seller.'
                : ''}
            </p>
          </div>
        </div>
      )}

      {booking.status === BookingStatus.NDR && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-4 flex items-start gap-3 text-sm text-orange-950">
          <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              Non-Delivery Report (NDR) · Attempt #{booking.ndrAttempts || 1}
            </p>
            <p className="text-xs text-orange-900 mt-0.5">
              {booking.ndrReason ? `Reason: ${booking.ndrReason}` : 'Delivery attempt could not be completed.'}
              {' · '}Seller can request a re-attempt or approve Return to Origin (RTO).
            </p>
          </div>
        </div>
      )}

      {(booking.status === BookingStatus.RTO_INITIATED ||
        booking.status === BookingStatus.RTO_DELIVERED) && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 px-5 py-4 flex items-start gap-3 text-sm text-purple-950">
          <RotateCcw className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              {booking.status === BookingStatus.RTO_DELIVERED
                ? 'RTO Return Delivered Back to Origin'
                : 'Return to Origin (RTO) In Progress'}
            </p>
            <p className="text-xs text-purple-900 mt-0.5">
              {booking.rtoReason ? `Reason: ${booking.rtoReason}` : 'Shipment returning to consignor origin.'}
              {booking.rtoCharges > 0 && (
                <>
                  {' · '}RTO Fee: {formatINR(booking.rtoCharges)} (
                  {booking.rtoBilledStatus === 'WALLET_DEBITED'
                    ? 'Debited from Seller Wallet'
                    : booking.rtoBilledStatus === 'INVOICE_PENDING'
                      ? 'Pending Wallet Settlement / Invoice'
                      : 'Billed via Invoice'}
                  )
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Route & Parties */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Sender (Consignor)</p>
              <p className="text-sm font-semibold text-slate-900">{booking.sender.name}</p>
              <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                {booking.sender.phone}
              </p>
              <p className="text-sm text-slate-600 mt-1.5">{booking.sender.address}</p>
              <p className="text-sm text-slate-700 font-medium mt-0.5">
                {booking.sender.city} — {booking.sender.pincode}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Receiver (Consignee)</p>
              <p className="text-sm font-semibold text-slate-900">{booking.receiver.name}</p>
              <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                {booking.receiver.phone}
              </p>
              <p className="text-sm text-slate-600 mt-1.5">{booking.receiver.address}</p>
              <p className="text-sm text-slate-700 font-medium mt-0.5">
                {booking.receiver.city} — {booking.receiver.pincode}
              </p>
            </div>
          </div>

          {/* Parcel & Carrier */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Parcel & Carrier Manifest</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Packages</p>
                <p className="font-mono tabular-nums font-medium text-slate-900 mt-0.5">
                  {booking.parcel.numberOfPackages}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Dimensions (L×W×H)</p>
                <p className="font-mono tabular-nums font-medium text-slate-900 mt-0.5">
                  {booking.parcel.lengthCm}×{booking.parcel.widthCm}×{booking.parcel.heightCm} cm
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Actual / Volumetric</p>
                <p className="font-mono tabular-nums font-medium text-slate-900 mt-0.5">
                  {formatWeight(booking.actualWeight)} / {formatWeight(booking.volumetricWeight)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Chargeable Weight</p>
                <p className="font-mono tabular-nums font-semibold text-blue-700 mt-0.5">
                  {formatWeight(booking.chargeableWeight)}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Goods Description</p>
                <p className="text-slate-800 mt-0.5">{booking.parcel.description}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Transporter & Seller</p>
                <p className="text-slate-900 font-medium mt-0.5">
                  {transporter?.companyName || '—'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seller: {seller?.businessName || '—'}
                </p>
              </div>
              {(booking.ewayBillNumber || booking.invoiceNumber) && (
                <div className="sm:col-span-2 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {booking.ewayBillNumber && (
                    <div>
                      <p className="text-xs text-slate-500">E-Way Bill (EWB)</p>
                      <p className="font-mono font-semibold text-slate-900 mt-0.5">
                        {booking.ewayBillNumber}
                        {booking.ewayBillValidUpto
                          ? ` · Valid upto ${formatDate(booking.ewayBillValidUpto)}`
                          : ''}
                      </p>
                    </div>
                  )}
                  {booking.invoiceNumber && (
                    <div>
                      <p className="text-xs text-slate-500">Tax Invoice Ref</p>
                      <p className="font-mono font-medium text-slate-800 mt-0.5">
                        {booking.invoiceNumber}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Individual Carton Barcodes & Scan Manifest */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Individual Carton Barcodes ({scannedCount} / {totalCartons} Scanned)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Code 128 carton labels for piece-level verification at pickup and delivery
                </p>
              </div>
            </div>

            {isTransporter &&
              booking.status !== BookingStatus.REJECTED &&
              booking.status !== BookingStatus.CANCELLED &&
              booking.status !== BookingStatus.RTO_DELIVERED && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!cartonScanInput.trim()) return;
                  handleScanCarton({ cartonCode: cartonScanInput.trim() });
                }}
                className="flex flex-wrap items-center gap-2.5"
              >
                <div className="relative flex-1 min-w-[220px]">
                  <ScanLine className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={cartonScanInput}
                    onChange={(e) => setCartonScanInput(e.target.value.toUpperCase())}
                    placeholder={`Scan or enter ${booking.lrNumber}-C01`}
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={scanningCarton || !cartonScanInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>{scanningCarton ? 'Scanning...' : 'Verify Scan'}</span>
                </button>
              </form>
            )}

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {Array.from({ length: Math.min(totalCartons, 50) }, (_, idx) => {
                const cartonNumber = idx + 1;
                const cartonCode = `${booking.lrNumber}-C${String(cartonNumber).padStart(2, '0')}`;
                const scanned = scannedMap.get(cartonNumber);

                return (
                  <div
                    key={cartonCode}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs bg-white"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {cartonCode}
                      </span>
                      <span className="text-slate-400">·</span>
                      {scanned ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Scanned {formatDateTime(scanned.scannedAt)}
                            {scanned.location ? ` · ${scanned.location}` : ''}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-500">Pending scan</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownloadCartonBarcode(cartonNumber, cartonCode)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 whitespace-nowrap"
                      >
                        <Barcode className="w-3.5 h-3.5" />
                        <span>Label PNG</span>
                      </button>
                      {isTransporter &&
                        !scanned &&
                        booking.status !== BookingStatus.REJECTED &&
                        booking.status !== BookingStatus.CANCELLED &&
                        booking.status !== BookingStatus.RTO_DELIVERED && (
                          <button
                            type="button"
                            disabled={scanningCarton}
                            onClick={() => handleScanCarton({ cartonNumber })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
                          >
                            <ScanLine className="w-3.5 h-3.5" />
                            <span>Mark Scanned</span>
                          </button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weight Discrepancy & Re-Weigh Card */}
          <WeightDiscrepancyCard
            booking={booking}
            discrepancy={data.weightDiscrepancy || null}
            onUpdated={loadDetails}
          />

          {/* Tracking Timeline */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Tracking Timeline</h2>
            <TrackingTimeline events={trackingEvents} />
          </div>

          {/* Delivery Proof */}
          {deliveryProof && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Proof of Delivery (POD)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Received By</p>
                  <p className="font-medium text-slate-900 mt-0.5">{deliveryProof.receiverName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Delivery Date</p>
                  <p className="font-mono tabular-nums text-slate-900 mt-0.5">
                    {formatDate(deliveryProof.deliveryDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Remarks</p>
                  <p className="text-slate-700 mt-0.5">{deliveryProof.remarks || '—'}</p>
                </div>
              </div>
              <AuthenticatedProofImage
                bookingId={booking._id}
                alt={`Delivery proof for ${booking.lrNumber}`}
              />
            </div>
          )}
        </div>

        {/* Pricing Snapshot Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Applied Freight Snapshot</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Rate Per Kg</dt>
                <dd className="font-mono tabular-nums text-slate-900">
                  {formatINR(booking.pricingSnapshot.ratePerKg)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Minimum Freight</dt>
                <dd className="font-mono tabular-nums text-slate-900">
                  {formatINR(booking.pricingSnapshot.minimumFreight)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Base Freight</dt>
                <dd className="font-mono tabular-nums font-medium text-slate-900">
                  {formatINR(booking.freight)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Additional Charges</dt>
                <dd className="font-mono tabular-nums text-slate-900">
                  {formatINR(booking.pricingSnapshot.additionalCharges)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">
                  GST ({booking.pricingSnapshot.gstApplicable ? `${booking.pricingSnapshot.gstRatePercent}%` : 'N/A'})
                </dt>
                <dd className="font-mono tabular-nums text-slate-900">
                  {formatINR(booking.tax)}
                </dd>
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                <dt className="font-semibold text-slate-900">Total Payable</dt>
                <dd className="text-lg font-bold font-mono tabular-nums text-blue-600">
                  {formatINR(booking.finalAmount)}
                </dd>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between text-xs">
                <dt className="text-slate-500">RTO Charges (if returned)</dt>
                <dd className="font-mono tabular-nums text-slate-700">
                  {formatINR(booking.rtoCharges)}
                </dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-slate-500">Estimated Transit</dt>
                <dd className="text-slate-700 font-medium">
                  {booking.pricingSnapshot.estimatedDeliveryTime || '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
