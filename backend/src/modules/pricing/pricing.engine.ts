import { AppError } from '../../utils/AppError.ts';

export interface ParcelCalculationInput {
  actualWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface RateCalculationConfig {
  minimumFreight: number;
  ratePerKg: number;
  volumetricDivisor: number;
  rtoCharges: number;
  additionalCharges: number;
  gstApplicable: boolean;
  gstRatePercent: number;
}

export interface CalculatedFreightBreakdown {
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  volumetricDivisor: number;
  minimumFreight: number;
  ratePerKg: number;
  baseFreight: number;
  additionalCharges: number;
  rtoCharges: number;
  gstApplicable: boolean;
  gstRatePercent: number;
  taxAmount: number;
  finalAmount: number;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Pure deterministic freight pricing engine.
 * Formula:
 * - Volumetric Weight = (Length * Width * Height) / Volumetric Divisor
 * - Chargeable Weight = Max(Actual Weight, Volumetric Weight)
 * - Freight = Max(Minimum Freight, Chargeable Weight * Rate Per Kg)
 * - GST = gstApplicable ? (Freight + Additional Charges) * (gstRatePercent / 100) : 0
 * - Final Amount = Freight + Additional Charges + GST
 * - RTO Charges returned separately
 */
export function calculateFreightBreakdown(
  parcel: ParcelCalculationInput,
  rate: RateCalculationConfig
): CalculatedFreightBreakdown {
  const { actualWeightKg, lengthCm, widthCm, heightCm } = parcel;

  if (!Number.isFinite(actualWeightKg) || actualWeightKg <= 0) {
    throw new AppError('Actual weight must be a positive number.', 400, 'INVALID_WEIGHT');
  }
  if (
    !Number.isFinite(lengthCm) ||
    lengthCm <= 0 ||
    !Number.isFinite(widthCm) ||
    widthCm <= 0 ||
    !Number.isFinite(heightCm) ||
    heightCm <= 0
  ) {
    throw new AppError('Parcel dimensions (length, width, height) must be positive numbers.', 400, 'INVALID_DIMENSIONS');
  }
  if (!Number.isFinite(rate.volumetricDivisor) || rate.volumetricDivisor <= 0) {
    throw new AppError('Volumetric divisor must be positive.', 400, 'INVALID_RATE_CONFIGURATION');
  }
  if (!Number.isFinite(rate.ratePerKg) || rate.ratePerKg <= 0 || rate.minimumFreight < 0) {
    throw new AppError('Invalid transporter rate configuration.', 400, 'INVALID_RATE_CONFIGURATION');
  }

  const volumetricWeightKg = round2((lengthCm * widthCm * heightCm) / rate.volumetricDivisor);
  const chargeableWeightKg = round2(Math.max(actualWeightKg, volumetricWeightKg));
  const calculatedWeightFreight = chargeableWeightKg * rate.ratePerKg;
  const baseFreight = round2(Math.max(rate.minimumFreight, calculatedWeightFreight));
  const additionalCharges = round2(rate.additionalCharges);
  const taxableSubtotal = round2(baseFreight + additionalCharges);
  const taxAmount = rate.gstApplicable ? round2(taxableSubtotal * (rate.gstRatePercent / 100)) : 0;
  const finalAmount = round2(taxableSubtotal + taxAmount);
  const rtoCharges = round2(rate.rtoCharges);

  return {
    actualWeightKg: round2(actualWeightKg),
    volumetricWeightKg,
    chargeableWeightKg,
    volumetricDivisor: rate.volumetricDivisor,
    minimumFreight: round2(rate.minimumFreight),
    ratePerKg: round2(rate.ratePerKg),
    baseFreight,
    additionalCharges,
    rtoCharges,
    gstApplicable: rate.gstApplicable,
    gstRatePercent: rate.gstApplicable ? rate.gstRatePercent : 0,
    taxAmount,
    finalAmount,
  };
}
