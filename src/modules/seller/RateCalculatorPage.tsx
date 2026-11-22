import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Info,
  KeyRound,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { apiClient, extractErrorMessage } from '../../services/api.ts';
import { formatINR, formatWeight } from '../../utils/formatters.ts';
import { ErrorBanner, LoadingSkeleton } from '../../components/ui/States.tsx';
import type { PaginatedResponse, RateQuote, TransportRoute } from '../../types/index.ts';

const BRAND = '#745BE7';
const MAX_INSURANCE = 100000;
const OTP_BASE_FEE = 5;
const OTP_GST_FEE = 0.9;

type ShipmentType = 'forward' | 'return';
type PaymentType = 'prepaid' | 'cod';

interface CalculatedRouteInfo {
  id: string;
  originCity: string;
  originPincode: string;
  destinationCity: string;
  destinationPincode: string;
  distanceKm?: number;
}

interface CalcResultState {
  route: CalculatedRouteInfo;
  quotes: RateQuote[];
  shipment: ShipmentType;
  payment: PaymentType;
  insuranceDeclared: number;
  insuranceFeeExclGst: number;
  insuranceGst: number;
  otpEnabled: boolean;
  otpFeeTotal: number;
}

function Header({ title }: { title: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
      <h1 className="flex items-center gap-2 text-lg font-bold sm:text-xl text-slate-900">
        {title} <Info size={15} className="text-slate-400" />
      </h1>
    </header>
  );
}

/* ---------- form building blocks ---------- */

const inputBase =
  'w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#745BE7] focus:outline-none focus:ring-1 focus:ring-[#745BE7]';

function Tip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <Info size={14} className="cursor-help text-slate-400" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 bg-slate-900 px-3 py-2 text-xs font-normal leading-snug text-white group-hover:block">
        {text}
      </span>
    </span>
  );
}

function Label({
  children,
  required,
  tip,
  icon: Icon,
}: {
  children: React.ReactNode;
  required?: boolean;
  tip?: string;
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
}) {
  return (
    <span className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-900">
      {Icon && <Icon size={15} style={{ color: BRAND }} />}
      {children}
      {required && <span className="text-red-500">*</span>}
      {tip && <Tip text={tip} />}
    </span>
  );
}

function RadioGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-3">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            style={
              on
                ? {
                    borderColor: BRAND,
                    color: BRAND,
                    backgroundColor: `${BRAND}0D`,
                  }
                : undefined
            }
            className={`flex items-center gap-2 border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#745BE7] whitespace-nowrap ${
              on
                ? ''
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
            }`}
          >
            <span
              style={on ? { borderColor: BRAND } : undefined}
              className={`flex h-4 w-4 items-center justify-center border-2 ${on ? '' : 'border-slate-400'}`}
            >
              {on && <span style={{ backgroundColor: BRAND }} className="h-2 w-2" />}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm font-medium text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#745BE7] focus-visible:ring-offset-2"
    >
      <span
        style={checked ? { backgroundColor: BRAND, borderColor: BRAND } : undefined}
        className={`flex h-5 w-5 items-center justify-center border-2 transition-colors ${
          checked ? '' : 'border-slate-400 bg-white'
        }`}
      >
        {checked && <Check size={14} strokeWidth={3} className="text-white" />}
      </span>
      {children}
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={checked ? { backgroundColor: BRAND } : undefined}
      className={`relative h-5 w-10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#745BE7] focus-visible:ring-offset-2 ${
        checked ? '' : 'bg-slate-300'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  );
}

function computeInsuranceCharges(declaredValue: number): { baseFee: number; gst: number } {
  if (declaredValue <= 0) return { baseFee: 0, gst: 0 };
  const baseFee = declaredValue <= 200 ? 5 : Number((5 + (declaredValue - 200) * 0.016).toFixed(2));
  const gst = Number((baseFee * 0.18).toFixed(2));
  return { baseFee, gst };
}

export function RateCalculatorPage() {
  const navigate = useNavigate();

  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  const [shipment, setShipment] = useState<ShipmentType>('forward');
  const [payment, setPayment] = useState<PaymentType>('prepaid');
  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [weight, setWeight] = useState('0.5');
  const [dims, setDims] = useState({ l: '20', w: '15', h: '10' });
  const [insured, setInsured] = useState(false);
  const [insurance, setInsurance] = useState('');
  const [otp, setOtp] = useState(false);

  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalcResultState | null>(null);

  useEffect(() => {
    let active = true;
    apiClient
      .get<{ success: boolean; data: PaginatedResponse<TransportRoute> }>('/routes')
      .then((res) => {
        if (!active) return;
        const loaded = res.data.data.items;
        setRoutes(loaded);
        if (loaded.length > 0) {
          setPickup((prev) => prev || loaded[0].originPincode);
          setDelivery((prev) => prev || loaded[0].destinationPincode);
        }
      })
      .catch(() => {
        // Pincodes can still be typed manually
      })
      .finally(() => {
        if (active) setLoadingRoutes(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

  const setDim = (k: 'l' | 'w' | 'h') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDims((d) => ({ ...d, [k]: e.target.value.replace(/[^\d.]/g, '') }));

  const chargeable = useMemo(() => {
    const vol = ((Number(dims.l) || 0) * (Number(dims.w) || 0) * (Number(dims.h) || 0)) / 5000;
    return Number(Math.max(vol, Number(weight) || 0).toFixed(2));
  }, [dims, weight]);

  const toggleInsured = (on: boolean) => {
    setInsured(on);
    if (!on) setInsurance('');
  };

  const onInsuranceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(digits(e.target.value, 7));
    setInsurance(n ? String(Math.min(n, MAX_INSURANCE)) : '');
  };

  const valid =
    pickup.length === 6 &&
    delivery.length === 6 &&
    Number(weight) > 0 &&
    Number(dims.l) > 0 &&
    Number(dims.w) > 0 &&
    Number(dims.h) > 0 &&
    (!insured || Number(insurance) > 0);

  const matchedRoute = useMemo(
    () =>
      routes.find(
        (r) =>
          (shipment === 'forward' &&
            r.originPincode === pickup &&
            r.destinationPincode === delivery) ||
          (shipment === 'return' &&
            r.originPincode === delivery &&
            r.destinationPincode === pickup)
      ) || null,
    [routes, pickup, delivery, shipment]
  );

  const reset = () => {
    setShipment('forward');
    setPayment('prepaid');
    setPickup(routes[0]?.originPincode || '');
    setDelivery(routes[0]?.destinationPincode || '');
    setWeight('0.5');
    setDims({ l: '20', w: '15', h: '10' });
    setInsured(false);
    setInsurance('');
    setOtp(false);
    setError(null);
    setResult(null);
  };

  const handleQuickSelectRoute = (route: TransportRoute) => {
    if (shipment === 'return') {
      setPickup(route.destinationPincode);
      setDelivery(route.originPincode);
    } else {
      setPickup(route.originPincode);
      setDelivery(route.destinationPincode);
    }
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;

    setCalculating(true);
    setError(null);
    try {
      const originPincode = shipment === 'return' ? delivery : pickup;
      const destinationPincode = shipment === 'return' ? pickup : delivery;

      const res = await apiClient.post<{
        success: boolean;
        data: { route: CalculatedRouteInfo; quotes: RateQuote[] };
      }>('/rates/calculate', {
        originPincode,
        destinationPincode,
        actualWeightKg: Number(weight),
        lengthCm: Number(dims.l),
        widthCm: Number(dims.w),
        heightCm: Number(dims.h),
        numberOfPackages: 1,
      });

      const declared = insured ? Number(insurance) || 0 : 0;
      const ins = computeInsuranceCharges(declared);
      const otpFeeTotal = otp ? Number((OTP_BASE_FEE + OTP_GST_FEE).toFixed(2)) : 0;

      setResult({
        route: res.data.data.route,
        quotes: res.data.data.quotes,
        shipment,
        payment,
        insuranceDeclared: declared,
        insuranceFeeExclGst: ins.baseFee,
        insuranceGst: ins.gst,
        otpEnabled: otp,
        otpFeeTotal,
      });
    } catch (err) {
      setResult(null);
      setError(extractErrorMessage(err, 'Failed to calculate shipping rates.'));
    } finally {
      setCalculating(false);
    }
  };

  if (loadingRoutes) return <LoadingSkeleton rows={4} />;

  return (
    <>
      <style>{`
        .zipit-rates, .zipit-rates * { border-radius: 0 !important; }
      `}</style>

      <div className="zipit-rates w-full bg-slate-50 text-left space-y-5">
        <div className="min-w-0 w-full border border-slate-200 bg-white">
          <Header title="Shipping rate calculator" />

          {routes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 sm:px-6">
              <span className="text-xs font-medium text-slate-600 mr-1">Active Lanes:</span>
              {routes.map((r) => {
                const isSelected =
                  (shipment === 'forward' &&
                    r.originPincode === pickup &&
                    r.destinationPincode === delivery) ||
                  (shipment === 'return' &&
                    r.originPincode === delivery &&
                    r.destinationPincode === pickup);
                return (
                  <button
                    key={r._id}
                    type="button"
                    onClick={() => handleQuickSelectRoute(r)}
                    style={
                      isSelected
                        ? {
                            borderColor: BRAND,
                            color: BRAND,
                            backgroundColor: `${BRAND}0D`,
                          }
                        : undefined
                    }
                    className={`border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      isSelected
                        ? ''
                        : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {r.originCity} ({r.originPincode}) → {r.destinationCity} ({r.destinationPincode})
                  </button>
                );
              })}
            </div>
          )}

          <form onSubmit={submit} className="bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  Provide the required inputs for rate calculation
                </h2>
                <Tip text="Fill in pickup, delivery, weight and dimensions to get instant rates." />
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-600">
                Est. Chargeable Weight: <strong className="text-slate-900">{formatWeight(chargeable)}</strong>
              </span>
            </div>

            <div className="space-y-6 p-4 sm:p-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label tip="Forward: you ship to a customer. Return: customer ships back to you.">
                    Shipment Type
                  </Label>
                  <RadioGroup
                    value={shipment}
                    onChange={setShipment}
                    options={[
                      { value: 'forward', label: 'Forward' },
                      { value: 'return', label: 'Return' },
                    ]}
                  />
                </div>

                <div>
                  <Label tip="Prepaid: wallet or advance payment. Cash on delivery: collect payment at delivery.">
                    Payment Type
                  </Label>
                  <RadioGroup
                    value={payment}
                    onChange={setPayment}
                    options={[
                      { value: 'prepaid', label: 'Prepaid' },
                      { value: 'cod', label: 'Cash on delivery' },
                    ]}
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <label className="block">
                  <Label required tip="6-digit pincode where the parcel is picked up.">
                    Pickup Pincode
                  </Label>
                  <input
                    inputMode="numeric"
                    list="zipit-origin-pincodes"
                    value={pickup}
                    onChange={(e) => setPickup(digits(e.target.value, 6))}
                    placeholder="411026"
                    className={`${inputBase} font-mono tabular-nums`}
                  />
                </label>

                <label className="block">
                  <Label required tip="6-digit pincode where the parcel is delivered.">
                    Delivery Pincode
                  </Label>
                  <input
                    inputMode="numeric"
                    list="zipit-dest-pincodes"
                    value={delivery}
                    onChange={(e) => setDelivery(digits(e.target.value, 6))}
                    placeholder="400013"
                    className={`${inputBase} font-mono tabular-nums`}
                  />
                </label>

                <datalist id="zipit-origin-pincodes">
                  {Array.from(new Set(routes.map((r) => r.originPincode))).map((pin) => (
                    <option key={pin} value={pin} />
                  ))}
                </datalist>
                <datalist id="zipit-dest-pincodes">
                  {Array.from(new Set(routes.map((r) => r.destinationPincode))).map((pin) => (
                    <option key={pin} value={pin} />
                  ))}
                </datalist>

                <label className="block">
                  <Label required tip="Actual weight of the packed parcel in kilograms.">
                    Actual Weight (Kg)
                  </Label>
                  <input
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ''))}
                    className={`${inputBase} font-mono tabular-nums`}
                  />
                </label>

                <div>
                  <Label
                    required
                    tip="Length, width and height of the packed parcel in centimetres."
                  >
                    Dimensions (cm)
                  </Label>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {(
                      [
                        ['l', 'Length (cm)'],
                        ['w', 'Width (cm)'],
                        ['h', 'Height (cm)'],
                      ] as const
                    ).map(([k, name]) => (
                      <label key={k} className="block">
                        <span className="mb-1 block text-xs text-slate-500">{name}</span>
                        <input
                          inputMode="decimal"
                          value={dims[k]}
                          onChange={setDim(k)}
                          className={`${inputBase} font-mono tabular-nums`}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:col-span-2">
                  <div className="h-full min-w-0 border border-slate-200 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Checkbox checked={insured} onChange={toggleInsured}>
                        <ShieldCheck size={15} style={{ color: BRAND }} />
                        Add insurance cover
                      </Checkbox>
                      <Tip text="Covers loss or damage up to the declared value." />
                    </div>

                    {insured && (
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                          ₹
                        </span>
                        <input
                          autoFocus
                          inputMode="numeric"
                          value={insurance}
                          onChange={onInsuranceChange}
                          placeholder="Enter declared value"
                          aria-label="Insurance cover amount in rupees"
                          className={`${inputBase} pl-7 font-mono tabular-nums`}
                        />
                      </div>
                    )}

                    <p className="mt-2 text-xs text-slate-500">
                      Optional · Maximum ₹1,00,000. ₹5 up to ₹200; then 1.6% above ₹200 + GST.
                    </p>
                  </div>

                  <div className="h-full min-w-0 border border-slate-200 p-4">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                        <KeyRound size={15} style={{ color: BRAND }} /> OTP delivery
                      </span>
                      <Toggle checked={otp} onChange={setOtp} />
                    </div>

                    <p className="text-xs text-slate-500">₹5 + ₹0.90 GST per parcel</p>
                  </div>
                </div>
              </div>

              {matchedRoute && (
                <div className="text-xs text-slate-600 border-t border-slate-100 pt-3">
                  Matched Lane:{' '}
                  <strong className="text-slate-900">
                    {matchedRoute.originCity} ({matchedRoute.originPincode}) →{' '}
                    {matchedRoute.destinationCity} ({matchedRoute.destinationPincode})
                  </strong>
                  {matchedRoute.distanceKm ? ` · ${matchedRoute.distanceKm} km` : ''}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-4 py-4 sm:px-6">
              <p className="text-xs text-slate-500">
                Fields marked <span className="text-red-500">*</span> are required. Hover the{' '}
                <Info size={12} className="inline align-text-bottom" /> icon for a quick explanation.
              </p>

              <div className="flex w-full gap-3 sm:w-auto">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold uppercase sm:flex-none text-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#745BE7] whitespace-nowrap"
                >
                  Reset
                </button>

                <button
                  type="submit"
                  disabled={!valid || calculating}
                  style={{ backgroundColor: BRAND }}
                  className="flex-1 px-5 py-2.5 text-sm font-semibold uppercase text-white sm:flex-none transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#745BE7] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                >
                  {calculating ? 'Calculating...' : 'Calculate'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {error && <ErrorBanner message={error} />}

        {result && (
          <div className="border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Calculated Transporter Quotes ({result.quotes.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {result.route.originCity} ({result.route.originPincode}) →{' '}
                  {result.route.destinationCity} ({result.route.destinationPincode}) ·{' '}
                  {result.shipment === 'forward' ? 'Forward' : 'Return'} ·{' '}
                  {result.payment === 'prepaid' ? 'Prepaid' : 'Cash on Delivery'}
                </p>
              </div>
              {result.route.distanceKm && (
                <span className="text-xs font-mono tabular-nums text-slate-600">
                  Distance: {result.route.distanceKm} km
                </span>
              )}
            </div>

            {result.quotes.length === 0 ? (
              <div className="p-6 text-sm text-slate-600">
                No active transporter rates configured for this pincode lane yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-6">
                {result.quotes.map((q) => {
                  const insTotal = Number(
                    (result.insuranceFeeExclGst + result.insuranceGst).toFixed(2)
                  );
                  const returnFee = result.shipment === 'return' ? q.breakdown.rtoCharges : 0;
                  const grandTotal = Number(
                    (q.breakdown.finalAmount + insTotal + result.otpFeeTotal + returnFee).toFixed(2)
                  );

                  return (
                    <div
                      key={q.rateId}
                      className="border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <Truck size={18} style={{ color: BRAND }} className="mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <h4 className="font-semibold text-slate-900 truncate">
                                {q.transporterName}
                              </h4>
                              <p className="text-xs text-slate-500">
                                ETA: {q.estimatedDeliveryTime}
                                {q.isSampleData ? ' · Sample Rate' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="block text-[11px] text-slate-500">Estimated Total</span>
                            <span
                              style={{ color: BRAND }}
                              className="text-lg font-bold font-mono tabular-nums"
                            >
                              {formatINR(grandTotal)}
                            </span>
                          </div>
                        </div>

                        <dl className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-y-1.5 text-xs">
                          <dt className="text-slate-500">Actual / Volumetric Wt</dt>
                          <dd className="text-right font-mono tabular-nums text-slate-800">
                            {formatWeight(q.breakdown.actualWeightKg)} /{' '}
                            {formatWeight(q.breakdown.volumetricWeightKg)}
                          </dd>
                          <dt className="text-slate-500">Chargeable Weight</dt>
                          <dd className="text-right font-mono tabular-nums font-medium text-slate-900">
                            {formatWeight(q.breakdown.chargeableWeightKg)}
                          </dd>
                          <dt className="text-slate-500">Rate / kg (Min Freight)</dt>
                          <dd className="text-right font-mono tabular-nums text-slate-800">
                            {formatINR(q.breakdown.ratePerKg)} ({formatINR(q.breakdown.minimumFreight)})
                          </dd>
                          <dt className="text-slate-500">Base Freight</dt>
                          <dd className="text-right font-mono tabular-nums text-slate-900">
                            {formatINR(q.breakdown.baseFreight)}
                          </dd>
                          <dt className="text-slate-500">Additional Charges</dt>
                          <dd className="text-right font-mono tabular-nums text-slate-800">
                            {formatINR(q.breakdown.additionalCharges)}
                          </dd>
                          <dt className="text-slate-500">
                            Freight GST ({q.breakdown.gstApplicable ? `${q.breakdown.gstRatePercent}%` : 'Exempt'})
                          </dt>
                          <dd className="text-right font-mono tabular-nums text-slate-800">
                            {formatINR(q.breakdown.taxAmount)}
                          </dd>

                          {result.insuranceDeclared > 0 && (
                            <>
                              <dt className="text-slate-500">
                                Insurance ({formatINR(result.insuranceDeclared)} cover + GST)
                              </dt>
                              <dd className="text-right font-mono tabular-nums text-slate-800">
                                {formatINR(insTotal)}
                              </dd>
                            </>
                          )}

                          {result.otpEnabled && (
                            <>
                              <dt className="text-slate-500">OTP Delivery (₹5 + ₹0.90 GST)</dt>
                              <dd className="text-right font-mono tabular-nums text-slate-800">
                                {formatINR(result.otpFeeTotal)}
                              </dd>
                            </>
                          )}

                          <dt className="text-slate-500">
                            {result.shipment === 'return'
                              ? 'Return / RTO Charge (Included)'
                              : 'RTO Charges (If returned)'}
                          </dt>
                          <dd className="text-right font-mono tabular-nums text-slate-700">
                            {formatINR(q.breakdown.rtoCharges)}
                          </dd>
                        </dl>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            navigate('/seller/create-booking', {
                              state: {
                                routeId: result.route.id,
                                actualWeightKg: weight,
                                lengthCm: dims.l,
                                widthCm: dims.w,
                                heightCm: dims.h,
                                paymentMode: result.payment === 'prepaid' ? 'WALLET' : 'INVOICE',
                              },
                            })
                          }
                          style={{ backgroundColor: BRAND }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase text-white hover:opacity-90 transition-opacity whitespace-nowrap"
                        >
                          <span>Create Booking</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
