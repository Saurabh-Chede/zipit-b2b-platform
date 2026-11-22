import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calculator, CheckCircle2, Truck, Wallet } from 'lucide-react';
import { apiClient, extractErrorMessage } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { formatINR, formatWeight } from '../../utils/formatters.ts';
import { ErrorBanner, LoadingSkeleton } from '../../components/ui/States.tsx';
import {
  SellerApprovalStatus,
  type Booking,
  type PaginatedResponse,
  type RateQuote,
  type SavedAddress,
  type SellerProfile,
  type TransportRoute,
} from '../../types/index.ts';

const shipmentFormSchema = z.object({
  routeId: z.string().min(1, 'Select a transport route'),
  senderName: z.string().min(2, 'Sender name is required'),
  senderPhone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit phone required'),
  senderAddress: z.string().min(5, 'Sender address is required'),
  senderCity: z.string().min(2, 'Sender city is required'),
  senderPincode: z.string().regex(/^\d{6}$/, '6-digit pincode required'),
  receiverName: z.string().min(2, 'Receiver name is required'),
  receiverPhone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit phone required'),
  receiverAddress: z.string().min(5, 'Receiver address is required'),
  receiverCity: z.string().min(2, 'Receiver city is required'),
  receiverPincode: z.string().regex(/^\d{6}$/, '6-digit pincode required'),
  description: z.string().min(2, 'Goods description is required'),
  actualWeightKg: z.number({ error: 'Enter a valid weight' }).positive('Weight must be > 0'),
  lengthCm: z.number({ error: 'Enter a valid length' }).positive('Length must be > 0'),
  widthCm: z.number({ error: 'Enter a valid width' }).positive('Width must be > 0'),
  heightCm: z.number({ error: 'Enter a valid height' }).positive('Height must be > 0'),
  numberOfPackages: z.number({ error: 'Enter package count' }).int().min(1, 'At least 1 package required'),
  ewayBillNumber: z
    .string()
    .optional()
    .refine((v) => !v || v.trim() === '' || /^\d{12}$/.test(v.trim()), {
      message: 'E-Way Bill must be 12 digits',
    }),
  ewayBillValidUpto: z.string().optional(),
});

type ShipmentFormValues = z.infer<typeof shipmentFormSchema>;

export function CreateShipmentPage() {
  const { profile, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const sellerProfile = profile as SellerProfile | null;
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [routesError, setRoutesError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<RateQuote[] | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<RateQuote | null>(null);
  const [paymentMode, setPaymentMode] = useState<'INVOICE' | 'WALLET'>('WALLET');
  const [calculating, setCalculating] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Idempotency key generated per form attempt so accidental double-clicks never duplicate bookings
  const idempotencyKey = useMemo(() => `zpt-${crypto.randomUUID()}`, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentFormSchema),
    defaultValues: {
      senderName: sellerProfile?.businessName || '',
      senderPhone: sellerProfile?.phone || '',
      senderAddress: sellerProfile?.businessAddress || '',
      senderCity: sellerProfile?.city || '',
      senderPincode: sellerProfile?.pincode || '',
      numberOfPackages: 1,
    },
  });

  const watchedRouteId = watch('routeId');

  useEffect(() => {
    apiClient
      .get<{ success: boolean; data: PaginatedResponse<TransportRoute> }>('/routes')
      .then((res) => setRoutes(res.data.data.items))
      .catch((err) => setRoutesError(extractErrorMessage(err, 'Failed to load active routes.')))
      .finally(() => setLoadingRoutes(false));

    apiClient
      .get<{ success: boolean; data: SavedAddress[] }>('/sellers/me/addresses')
      .then((res) => setSavedAddresses(res.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const selected = routes.find((r) => r._id === watchedRouteId);
    if (selected) {
      setValue('senderCity', selected.originCity);
      setValue('senderPincode', selected.originPincode);
      setValue('receiverCity', selected.destinationCity);
      setValue('receiverPincode', selected.destinationPincode);
      setQuotes(null);
      setSelectedQuote(null);
    }
  }, [watchedRouteId, routes, setValue]);

  if (sellerProfile && sellerProfile.approvalStatus !== SellerApprovalStatus.APPROVED) {
    return (
      <ErrorBanner
        message={
          sellerProfile.approvalStatus === SellerApprovalStatus.PENDING
            ? 'Your seller registration is still pending admin approval. You can create shipments once approved.'
            : `Your seller registration was rejected: ${sellerProfile.rejectionReason || 'Contact admin'}`
        }
      />
    );
  }

  if (loadingRoutes) return <LoadingSkeleton rows={6} />;
  if (routesError) return <ErrorBanner message={routesError} />;

  const handleCalculateQuotes = async () => {
    const valid = await trigger([
      'routeId',
      'actualWeightKg',
      'lengthCm',
      'widthCm',
      'heightCm',
      'numberOfPackages',
    ]);
    if (!valid) return;

    const vals = getValues();
    setCalculating(true);
    setQuoteError(null);
    setSelectedQuote(null);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { quotes: RateQuote[] };
      }>('/rates/calculate', {
        routeId: vals.routeId,
        actualWeightKg: vals.actualWeightKg,
        lengthCm: vals.lengthCm,
        widthCm: vals.widthCm,
        heightCm: vals.heightCm,
        numberOfPackages: vals.numberOfPackages,
      });
      setQuotes(res.data.data.quotes);
      if (res.data.data.quotes.length > 0) {
        setSelectedQuote(res.data.data.quotes[0]);
      }
    } catch (err) {
      setQuoteError(extractErrorMessage(err, 'Unable to calculate rates.'));
    } finally {
      setCalculating(false);
    }
  };

  const onConfirmBooking = async (values: ShipmentFormValues) => {
    if (!selectedQuote) {
      showToast('Calculate rates and select a transporter before confirming.', 'error');
      return;
    }

    setBookingSubmitting(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: Booking }>(
        '/bookings',
        {
          routeId: values.routeId,
          transporterId: selectedQuote.transporterId,
          rateId: selectedQuote.rateId,
          idempotencyKey,
          paymentMode,
          ewayBillNumber: values.ewayBillNumber?.trim() || undefined,
          ewayBillValidUpto: values.ewayBillValidUpto || null,
          sender: {
            name: values.senderName,
            phone: values.senderPhone,
            address: values.senderAddress,
            city: values.senderCity,
            pincode: values.senderPincode,
          },
          receiver: {
            name: values.receiverName,
            phone: values.receiverPhone,
            address: values.receiverAddress,
            city: values.receiverCity,
            pincode: values.receiverPincode,
          },
          parcel: {
            description: values.description,
            actualWeightKg: values.actualWeightKg,
            lengthCm: values.lengthCm,
            widthCm: values.widthCm,
            heightCm: values.heightCm,
            numberOfPackages: values.numberOfPackages,
          },
        },
        {
          headers: { 'Idempotency-Key': idempotencyKey },
        }
      );

      if (paymentMode === 'WALLET') {
        await refreshUser();
      }
      showToast(`Shipment booked. LR: ${res.data.data.lrNumber}`, 'success');
      navigate(`/seller/shipments/${res.data.data._id}`);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Booking confirmation failed.'), 'error');
    } finally {
      setBookingSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Create B2B Shipment</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Select an active route, specify sender, receiver, and parcel dimensions to compare transporter quotes
        </p>
      </div>

      <form onSubmit={handleSubmit(onConfirmBooking)} className="space-y-6" noValidate>
        {/* Route Selection */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">1. Select Route</h2>
          <select
            {...register('routeId')}
            className="w-full max-w-xl px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
          >
            <option value="">Choose an active lane...</option>
            {routes.map((r) => (
              <option key={r._id} value={r._id}>
                {r.originCity} ({r.originPincode}) → {r.destinationCity} ({r.destinationPincode})
                {r.distanceKm ? ` · ${r.distanceKm} km` : ''}
              </option>
            ))}
          </select>
          {errors.routeId && <p className="mt-1 text-xs text-red-600">{errors.routeId.message}</p>}
        </div>

        {/* Sender & Receiver */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">2. Sender Details</h2>
              {savedAddresses.filter((a) => a.addressType === 'PICKUP' || a.addressType === 'BOTH').length > 0 && (
                <select
                  aria-label="Quick-fill saved pickup address"
                  defaultValue=""
                  onChange={(e) => {
                    const found = savedAddresses.find((a) => a._id === e.target.value);
                    if (found) {
                      setValue('senderName', found.name);
                      setValue('senderPhone', found.phone);
                      setValue('senderAddress', found.address);
                      setValue('senderCity', found.city);
                      setValue('senderPincode', found.pincode);
                    }
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                >
                  <option value="">Quick-fill Saved Pickup...</option>
                  {savedAddresses
                    .filter((a) => a.addressType === 'PICKUP' || a.addressType === 'BOTH')
                    .map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.label} ({a.city})
                      </option>
                    ))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sender Name</label>
                <input
                  type="text"
                  {...register('senderName')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                {errors.senderName && <p className="text-xs text-red-600 mt-1">{errors.senderName.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                <input
                  type="tel"
                  {...register('senderPhone')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
                {errors.senderPhone && <p className="text-xs text-red-600 mt-1">{errors.senderPhone.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Pickup Address</label>
                <input
                  type="text"
                  {...register('senderAddress')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                {errors.senderAddress && <p className="text-xs text-red-600 mt-1">{errors.senderAddress.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                <input
                  type="text"
                  {...register('senderCity')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50"
                />
                {errors.senderCity && <p className="text-xs text-red-600 mt-1">{errors.senderCity.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pincode</label>
                <input
                  type="text"
                  {...register('senderPincode')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums bg-slate-50"
                />
                {errors.senderPincode && <p className="text-xs text-red-600 mt-1">{errors.senderPincode.message}</p>}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">3. Receiver Details</h2>
              {savedAddresses.filter((a) => a.addressType === 'DELIVERY' || a.addressType === 'BOTH').length > 0 && (
                <select
                  aria-label="Quick-fill saved delivery address"
                  defaultValue=""
                  onChange={(e) => {
                    const found = savedAddresses.find((a) => a._id === e.target.value);
                    if (found) {
                      setValue('receiverName', found.name);
                      setValue('receiverPhone', found.phone);
                      setValue('receiverAddress', found.address);
                      setValue('receiverCity', found.city);
                      setValue('receiverPincode', found.pincode);
                    }
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                >
                  <option value="">Quick-fill Saved Buyer...</option>
                  {savedAddresses
                    .filter((a) => a.addressType === 'DELIVERY' || a.addressType === 'BOTH')
                    .map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.label} ({a.city})
                      </option>
                    ))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Receiver Name</label>
                <input
                  type="text"
                  {...register('receiverName')}
                  placeholder="Consignee company / person"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                {errors.receiverName && <p className="text-xs text-red-600 mt-1">{errors.receiverName.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                <input
                  type="tel"
                  {...register('receiverPhone')}
                  placeholder="9820011223"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
                {errors.receiverPhone && <p className="text-xs text-red-600 mt-1">{errors.receiverPhone.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Address</label>
                <input
                  type="text"
                  {...register('receiverAddress')}
                  placeholder="Warehouse / Industrial Estate address"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                {errors.receiverAddress && (
                  <p className="text-xs text-red-600 mt-1">{errors.receiverAddress.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                <input
                  type="text"
                  {...register('receiverCity')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50"
                />
                {errors.receiverCity && <p className="text-xs text-red-600 mt-1">{errors.receiverCity.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pincode</label>
                <input
                  type="text"
                  {...register('receiverPincode')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums bg-slate-50"
                />
                {errors.receiverPincode && <p className="text-xs text-red-600 mt-1">{errors.receiverPincode.message}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Parcel Specification */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">4. Parcel Dimensions & Weight</h2>
            <button
              type="button"
              onClick={handleCalculateQuotes}
              disabled={calculating}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <Calculator className="w-4 h-4" />
              <span>{calculating ? 'Calculating...' : 'Calculate Transporter Quotes'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="sm:col-span-3 lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Goods Description</label>
              <input
                type="text"
                {...register('description')}
                placeholder="Industrial valves, cartons..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Actual Wt (kg)</label>
              <input
                type="number"
                step="0.1"
                {...register('actualWeightKg', { valueAsNumber: true })}
                placeholder="50"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
              {errors.actualWeightKg && (
                <p className="text-xs text-red-600 mt-1">{errors.actualWeightKg.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Length (cm)</label>
              <input
                type="number"
                step="1"
                {...register('lengthCm', { valueAsNumber: true })}
                placeholder="60"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
              {errors.lengthCm && <p className="text-xs text-red-600 mt-1">{errors.lengthCm.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Width (cm)</label>
              <input
                type="number"
                step="1"
                {...register('widthCm', { valueAsNumber: true })}
                placeholder="45"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
              {errors.widthCm && <p className="text-xs text-red-600 mt-1">{errors.widthCm.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Height (cm)</label>
              <input
                type="number"
                step="1"
                {...register('heightCm', { valueAsNumber: true })}
                placeholder="40"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
              {errors.heightCm && <p className="text-xs text-red-600 mt-1">{errors.heightCm.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Packages</label>
              <input
                type="number"
                step="1"
                {...register('numberOfPackages', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
              {errors.numberOfPackages && (
                <p className="text-xs text-red-600 mt-1">{errors.numberOfPackages.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                E-Way Bill No. (12 digits, Optional)
              </label>
              <input
                type="text"
                maxLength={12}
                {...register('ewayBillNumber')}
                placeholder="271009887766"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
              {errors.ewayBillNumber && (
                <p className="text-xs text-red-600 mt-1">{errors.ewayBillNumber.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                E-Way Bill Valid Upto (Optional)
              </label>
              <input
                type="date"
                {...register('ewayBillValidUpto')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
          </div>
        </div>

        {quoteError && <ErrorBanner message={quoteError} />}

        {/* Transporter Quotes */}
        {quotes !== null && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">5. Select Transporter & Confirm Booking</h2>
            {quotes.length === 0 ? (
              <p className="text-sm text-slate-600">
                No active transporter rates configured for this route yet. Ask an administrator to add a rate.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quotes.map((q) => {
                    const isSelected = selectedQuote?.rateId === q.rateId;
                    return (
                      <button
                        key={q.rateId}
                        type="button"
                        onClick={() => setSelectedQuote(q)}
                        className={`text-left border rounded-xl p-4 transition-colors ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="font-semibold text-slate-900 text-sm">
                              {q.transporterName}
                            </span>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                        </div>

                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                          <span>ETA: {q.estimatedDeliveryTime}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            Chargeable: {formatWeight(q.breakdown.chargeableWeightKg)}
                          </span>
                          {q.isSampleData && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Sample Rate</span>
                            </>
                          )}
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-y-1 text-xs">
                          <span className="text-slate-500">Base Freight</span>
                          <span className="text-right font-mono tabular-nums text-slate-800">
                            {formatINR(q.breakdown.baseFreight)}
                          </span>
                          <span className="text-slate-500">Additional + GST</span>
                          <span className="text-right font-mono tabular-nums text-slate-800">
                            {formatINR(q.breakdown.additionalCharges + q.breakdown.taxAmount)}
                          </span>
                          <span className="text-slate-500">RTO (if returned)</span>
                          <span className="text-right font-mono tabular-nums text-slate-600">
                            {formatINR(q.breakdown.rtoCharges)}
                          </span>
                          <span className="font-semibold text-slate-900 pt-1">Total Payable</span>
                          <span className="text-right font-mono tabular-nums font-bold text-blue-600 text-sm pt-1">
                            {formatINR(q.breakdown.finalAmount)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-medium text-slate-600">Payment Mode</span>
                    <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setPaymentMode('WALLET')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                          paymentMode === 'WALLET'
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Wallet className="w-3.5 h-3.5 shrink-0" />
                        <span>Wallet</span>
                        <span className="font-mono tabular-nums">
                          ({formatINR(Number(sellerProfile?.walletBalance ?? 0))})
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode('INVOICE')}
                        className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                          paymentMode === 'INVOICE'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        B2B Invoice
                      </button>
                    </div>
                    {paymentMode === 'WALLET' &&
                      selectedQuote &&
                      Number(sellerProfile?.walletBalance ?? 0) < selectedQuote.breakdown.finalAmount && (
                        <button
                          type="button"
                          onClick={() => window.dispatchEvent(new Event('zipit:open-wallet-modal'))}
                          className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline whitespace-nowrap"
                        >
                          Insufficient balance — Recharge Wallet
                        </button>
                      )}
                  </div>

                  <button
                    type="submit"
                    disabled={bookingSubmitting || !selectedQuote}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {bookingSubmitting
                      ? 'Creating Booking & Generating LR...'
                      : `Confirm Booking (${formatINR(selectedQuote?.breakdown.finalAmount)})`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
