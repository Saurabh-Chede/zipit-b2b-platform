import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRightCircle, RotateCcw, Scale, ScanLine, Upload, XCircle } from 'lucide-react';
import { apiClient, extractErrorMessage } from '../../services/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { formatINR } from '../../utils/formatters.ts';
import { Modal } from '../../components/ui/Modal.tsx';
import {
  ShipmentDetailView,
  type ShipmentDetailsPayload,
} from '../../components/shared/ShipmentDetailView.tsx';
import { BookingStatus, NEXT_BOOKING_STATUS } from '../../types/index.ts';

function TransporterActionControls({
  data,
  reload,
}: {
  data: ShipmentDetailsPayload;
  reload: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { booking, deliveryProof } = data;
  const nextStatus = NEXT_BOOKING_STATUS[booking.status];

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [location, setLocation] = useState(
    nextStatus === BookingStatus.ARRIVED || nextStatus === BookingStatus.DELIVERED
      ? `${booking.destination.city} (${booking.destination.pincode})`
      : `${booking.origin.city} (${booking.origin.pincode})`
  );
  const [remarks, setRemarks] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  const [exceptionStatus, setExceptionStatus] = useState<
    BookingStatus.NDR | BookingStatus.RTO_INITIATED | null
  >(null);
  const [exceptionLocation, setExceptionLocation] = useState(
    `${booking.destination.city} (${booking.destination.pincode})`
  );
  const [exceptionReason, setExceptionReason] = useState('');
  const [submittingException, setSubmittingException] = useState(false);

  const [podModalOpen, setPodModalOpen] = useState(false);
  const [receiverName, setReceiverName] = useState(booking.receiver.name);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [podRemarks, setPodRemarks] = useState('');
  const [podFile, setPodFile] = useState<File | null>(null);
  const [submittingPod, setSubmittingPod] = useState(false);

  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [reportedWeightKg, setReportedWeightKg] = useState(String(booking.chargeableWeight + 5));
  const [reportedRemarks, setReportedRemarks] = useState('');
  const [scaleFile, setScaleFile] = useState<File | null>(null);
  const [submittingWeight, setSubmittingWeight] = useState(false);

  const handleAdvanceStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextStatus) return;
    setSubmittingStatus(true);
    try {
      await apiClient.patch(`/bookings/${booking._id}/status`, {
        status: nextStatus,
        location,
        remarks: remarks.trim() || undefined,
      });
      showToast(`Shipment marked as ${nextStatus.replace(/_/g, ' ')}.`, 'success');
      setStatusModalOpen(false);
      setRemarks('');
      await reload();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update status.'), 'error');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleRejectBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rejectReason.trim().length < 4) {
      showToast('Please enter a rejection reason (min 4 characters).', 'error');
      return;
    }
    setSubmittingReject(true);
    try {
      await apiClient.patch(`/bookings/${booking._id}/status`, {
        status: BookingStatus.REJECTED,
        location: `${booking.origin.city} (${booking.origin.pincode})`,
        remarks: rejectReason.trim(),
      });
      showToast(
        booking.paymentMode === 'WALLET'
          ? `Booking rejected & ${formatINR(booking.finalAmount)} refunded to seller wallet.`
          : 'Booking rejected.',
        'info'
      );
      setRejectModalOpen(false);
      setRejectReason('');
      await reload();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to reject booking.'), 'error');
    } finally {
      setSubmittingReject(false);
    }
  };

  const handleExceptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionStatus) return;
    if (exceptionReason.trim().length < 4) {
      showToast('Please enter a clear reason (min 4 characters).', 'error');
      return;
    }
    setSubmittingException(true);
    try {
      await apiClient.patch(`/bookings/${booking._id}/status`, {
        status: exceptionStatus,
        location: exceptionLocation.trim() || `${booking.destination.city} (${booking.destination.pincode})`,
        remarks: exceptionReason.trim(),
      });
      showToast(
        exceptionStatus === BookingStatus.NDR
          ? 'NDR recorded and seller notified.'
          : 'RTO initiated and seller notified.',
        'info'
      );
      setExceptionStatus(null);
      setExceptionReason('');
      await reload();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update exception status.'), 'error');
    } finally {
      setSubmittingException(false);
    }
  };

  const handleUploadPod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podFile) {
      showToast('Select a delivery proof image (JPEG, PNG, or WebP).', 'error');
      return;
    }
    setSubmittingPod(true);
    try {
      const formData = new FormData();
      formData.append('image', podFile);
      formData.append('receiverName', receiverName);
      formData.append('deliveryDate', deliveryDate);
      if (podRemarks.trim()) formData.append('remarks', podRemarks.trim());
      if (booking.status === BookingStatus.ARRIVED || booking.status === BookingStatus.NDR) {
        formData.append('markDelivered', 'true');
      }

      await apiClient.post(`/bookings/${booking._id}/delivery-proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('Delivery proof uploaded successfully.', 'success');
      setPodModalOpen(false);
      await reload();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to upload delivery proof.'), 'error');
    } finally {
      setSubmittingPod(false);
    }
  };

  const handleReportWeightDiscrepancy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scaleFile) {
      showToast('Upload a weighing scale proof photo (JPEG, PNG, or WebP).', 'error');
      return;
    }
    setSubmittingWeight(true);
    try {
      const formData = new FormData();
      formData.append('image', scaleFile);
      formData.append('reportedActualWeightKg', reportedWeightKg);
      if (reportedRemarks.trim()) formData.append('remarks', reportedRemarks.trim());

      await apiClient.post(`/bookings/${booking._id}/weight-discrepancy`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('Weight discrepancy reported and seller notified.', 'success');
      setWeightModalOpen(false);
      setScaleFile(null);
      setReportedRemarks('');
      await reload();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to report weight discrepancy.'), 'error');
    } finally {
      setSubmittingWeight(false);
    }
  };

  const canUploadPod =
    !deliveryProof &&
    (booking.status === BookingStatus.ARRIVED ||
      booking.status === BookingStatus.NDR ||
      booking.status === BookingStatus.DELIVERED);
  const canScanCartons =
    booking.status !== BookingStatus.REJECTED &&
    booking.status !== BookingStatus.CANCELLED &&
    booking.status !== BookingStatus.RTO_DELIVERED;
  const canReportWeightDiscrepancy =
    !data.weightDiscrepancy &&
    (booking.status === BookingStatus.ACCEPTED ||
      booking.status === BookingStatus.DISPATCHED ||
      booking.status === BookingStatus.ARRIVED ||
      booking.status === BookingStatus.NDR);
  const canReportNdr = booking.status === BookingStatus.ARRIVED;
  const canInitiateRto =
    booking.status === BookingStatus.ARRIVED || booking.status === BookingStatus.NDR;

  return (
    <>
      {canScanCartons && (
        <button
          type="button"
          onClick={() => navigate(`/transporter/scanner?lr=${encodeURIComponent(booking.lrNumber)}`)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <ScanLine className="w-4 h-4 text-blue-600" />
          <span>Scan Cartons</span>
        </button>
      )}

      {nextStatus && (
        <button
          type="button"
          onClick={() => {
            setLocation(
              nextStatus === BookingStatus.ARRIVED || nextStatus === BookingStatus.DELIVERED
                ? `${booking.destination.city} (${booking.destination.pincode})`
                : `${booking.origin.city} (${booking.origin.pincode})`
            );
            setStatusModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowRightCircle className="w-4 h-4" />
          <span>
            {nextStatus === BookingStatus.ACCEPTED
              ? 'Accept Booking'
              : nextStatus === BookingStatus.RTO_DELIVERED
                ? 'Mark RTO Delivered'
                : booking.status === BookingStatus.NDR
                  ? 'Retry & Mark Delivered'
                  : `Mark ${nextStatus}`}
          </span>
        </button>
      )}

      {canReportNdr && (
        <button
          type="button"
          onClick={() => {
            setExceptionLocation(`${booking.destination.city} (${booking.destination.pincode})`);
            setExceptionReason('');
            setExceptionStatus(BookingStatus.NDR);
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-orange-800 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors whitespace-nowrap shrink-0"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Report NDR</span>
        </button>
      )}

      {canInitiateRto && (
        <button
          type="button"
          onClick={() => {
            setExceptionLocation(`${booking.destination.city} (${booking.destination.pincode})`);
            setExceptionReason('');
            setExceptionStatus(BookingStatus.RTO_INITIATED);
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-purple-800 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Initiate RTO</span>
        </button>
      )}

      {booking.status === BookingStatus.BOOKED && (
        <button
          type="button"
          onClick={() => setRejectModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap shrink-0"
        >
          <XCircle className="w-4 h-4" />
          <span>Reject Booking</span>
        </button>
      )}

      {canUploadPod && (
        <button
          type="button"
          onClick={() => setPodModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Delivery Proof</span>
        </button>
      )}

      {canReportWeightDiscrepancy && (
        <button
          type="button"
          onClick={() => setWeightModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
        >
          <Scale className="w-4 h-4" />
          <span>Report Weight Discrepancy</span>
        </button>
      )}

      <Modal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={`Update Status to ${nextStatus?.replace(/_/g, ' ')}`}
        subtitle={`LR ${booking.lrNumber} · Current status: ${booking.status}`}
      >
        <form onSubmit={handleAdvanceStatus} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Checkpoint Location</label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Remarks (Optional)</label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Vehicle number, gate pass, or hub arrival notes"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStatusModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingStatus}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submittingStatus ? 'Updating...' : `Confirm ${nextStatus?.replace(/_/g, ' ')}`}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(exceptionStatus)}
        onClose={() => !submittingException && setExceptionStatus(null)}
        title={
          exceptionStatus === BookingStatus.NDR
            ? 'Report Delivery Exception (NDR)'
            : 'Initiate Return to Origin (RTO)'
        }
        subtitle={`LR ${booking.lrNumber} · ${booking.destination.city} → ${booking.origin.city}`}
      >
        <form onSubmit={handleExceptionSubmit} className="space-y-4">
          {exceptionStatus === BookingStatus.RTO_INITIATED && booking.rtoCharges > 0 && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 px-3.5 py-2.5 text-xs text-purple-950">
              RTO return charge ({formatINR(booking.rtoCharges)}) will be applied to seller&apos;s{' '}
              {booking.paymentMode === 'WALLET' ? 'wallet / invoice.' : 'invoice account.'}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Checkpoint Location *
            </label>
            <input
              type="text"
              required
              value={exceptionLocation}
              onChange={(e) => setExceptionLocation(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {exceptionStatus === BookingStatus.NDR ? 'NDR Failure Reason *' : 'RTO Reason *'}
            </label>
            <textarea
              rows={3}
              required
              minLength={4}
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              placeholder={
                exceptionStatus === BookingStatus.NDR
                  ? 'e.g., Consignee warehouse closed at 4 PM / phone unreachable'
                  : 'e.g., Consignee refused delivery after 2 attempts'
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={submittingException}
              onClick={() => setExceptionStatus(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingException}
              className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${
                exceptionStatus === BookingStatus.NDR
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {submittingException
                ? 'Saving...'
                : exceptionStatus === BookingStatus.NDR
                  ? 'Submit NDR Report'
                  : 'Confirm RTO Initiation'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Booking Request"
        subtitle={`LR ${booking.lrNumber} · ${booking.origin.city} → ${booking.destination.city}`}
      >
        <form onSubmit={handleRejectBooking} className="space-y-4">
          {booking.paymentMode === 'WALLET' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              Prepaid Wallet amount ({formatINR(booking.finalAmount)}) will be refunded automatically to the seller.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rejection Reason *</label>
            <textarea
              rows={3}
              required
              minLength={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Specify reason (vehicle unavailability, restricted goods, pin unserviceable, etc.)"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingReject}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {submittingReject ? 'Rejecting...' : 'Confirm Reject'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={podModalOpen}
        onClose={() => setPodModalOpen(false)}
        title="Upload Proof of Delivery"
        subtitle={`LR ${booking.lrNumber}`}
      >
        <form onSubmit={handleUploadPod} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Receiver Name</label>
            <input
              type="text"
              required
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Date</label>
            <input
              type="date"
              required
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Delivery Image (JPEG/PNG/WebP, max 5 MB)
            </label>
            <input
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPodFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-slate-300 file:text-xs file:font-medium file:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Remarks (Optional)</label>
            <textarea
              rows={2}
              value={podRemarks}
              onChange={(e) => setPodRemarks(e.target.value)}
              placeholder="Signed challan received"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPodModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingPod}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {submittingPod ? 'Uploading...' : 'Submit Proof of Delivery'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={weightModalOpen}
        onClose={() => !submittingWeight && setWeightModalOpen(false)}
        title="Report Weight Discrepancy"
        subtitle={`LR ${booking.lrNumber} · Declared chargeable: ${booking.chargeableWeight.toFixed(2)} kg`}
      >
        <form onSubmit={handleReportWeightDiscrepancy} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Scale Verified Actual Weight (kg) *
            </label>
            <input
              type="number"
              step="0.01"
              min={booking.chargeableWeight + 0.01}
              required
              value={reportedWeightKg}
              onChange={(e) => setReportedWeightKg(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Weighing Scale Proof Photo (JPEG/PNG/WebP, max 5 MB) *
            </label>
            <input
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setScaleFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-slate-300 file:text-xs file:font-medium file:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Hub Scale Remarks (Optional)
            </label>
            <textarea
              rows={2}
              value={reportedRemarks}
              onChange={(e) => setReportedRemarks(e.target.value)}
              placeholder="e.g., Re-weighed on calibrated hub digital floor scale"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={submittingWeight}
              onClick={() => setWeightModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingWeight}
              className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {submittingWeight ? 'Submitting...' : 'Submit Discrepancy Claim'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function TransporterBookingDetailsPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;

  return (
    <ShipmentDetailView
      bookingId={id}
      backPath="/transporter/bookings"
      renderActions={(data, reload) => <TransporterActionControls data={data} reload={reload} />}
    />
  );
}
