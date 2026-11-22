import bcrypt from 'bcryptjs';
import { User } from '../../models/User.ts';
import { Transporter, type IServiceArea } from '../../models/Transporter.ts';
import { Booking } from '../../models/Booking.ts';
import { TransporterSettlement, SettlementStatus } from '../../models/TransporterSettlement.ts';
import { runInTransaction } from '../../config/database.ts';
import { AppError } from '../../utils/AppError.ts';
import { BookingStatus, EntityStatus, UserRole } from '../../utils/constants.ts';
import { buildPaginatedResponse, parsePagination } from '../../utils/pagination.ts';
import { escapeRegex } from '../../utils/sanitize.ts';
import { round2 } from '../pricing/pricing.engine.ts';
import type { z } from 'zod';
import type {
  createTransporterSchema,
  updateOwnTransporterProfileSchema,
  updateTransporterSchema,
} from './transporters.validator.ts';

export type CreateTransporterInput = z.infer<typeof createTransporterSchema>;
export type UpdateTransporterInput = z.infer<typeof updateTransporterSchema>;
export type UpdateOwnTransporterProfileInput = z.infer<typeof updateOwnTransporterProfileSchema>;

const PLATFORM_COMMISSION_RATE = 5; // 5% platform fee on gross freight (before GST)

export async function createTransporter(input: CreateTransporterInput) {
  const existingUser = await User.findOne({ email: input.email }).lean();
  if (existingUser) {
    throw new AppError('An account with this email already exists.', 409, 'EMAIL_ALREADY_EXISTS');
  }

  const existingGst = await Transporter.findOne({ gstNumber: input.gstNumber }).lean();
  if (existingGst) {
    throw new AppError('A transporter with this GSTIN already exists.', 409, 'GST_ALREADY_REGISTERED');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  return runInTransaction(async (session) => {
    const [user] = await User.create(
      [
        {
          name: input.contactPerson,
          email: input.email,
          passwordHash,
          role: UserRole.TRANSPORTER,
          isActive: input.status === EntityStatus.ACTIVE,
        },
      ],
      session ? { session } : undefined
    );

    const [transporter] = await Transporter.create(
      [
        {
          userId: user._id,
          companyName: input.companyName,
          contactPerson: input.contactPerson,
          email: input.email,
          phone: input.phone,
          gstNumber: input.gstNumber,
          address: input.address,
          serviceAreas: input.serviceAreas,
          status: input.status,
        },
      ],
      session ? { session } : undefined
    );

    return transporter;
  });
}

export async function listTransporters(query: Record<string, unknown>, forceActiveOnly = false) {
  const pagination = parsePagination(query);
  const filter: Record<string, unknown> = {};

  if (forceActiveOnly) {
    filter.status = EntityStatus.ACTIVE;
  } else if (query.status && Object.values(EntityStatus).includes(query.status as EntityStatus)) {
    filter.status = query.status;
  }

  if (typeof query.search === 'string' && query.search.trim()) {
    const regex = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [
      { companyName: regex },
      { contactPerson: regex },
      { email: regex },
      { 'serviceAreas.city': regex },
      { 'serviceAreas.pincode': regex },
    ];
  }

  const [items, total] = await Promise.all([
    Transporter.find(filter)
      .select('-kyc.documents.storageKey')
      .sort({ companyName: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Transporter.countDocuments(filter),
  ]);

  return buildPaginatedResponse(items, total, pagination);
}

export async function getTransporterById(id: string) {
  const transporter = await Transporter.findById(id).select('-kyc.documents.storageKey').lean();
  if (!transporter) {
    throw new AppError('Transporter not found.', 404, 'TRANSPORTER_NOT_FOUND');
  }
  return transporter;
}

export async function updateTransporter(id: string, input: UpdateTransporterInput) {
  const transporter = await Transporter.findById(id);
  if (!transporter) {
    throw new AppError('Transporter not found.', 404, 'TRANSPORTER_NOT_FOUND');
  }

  return runInTransaction(async (session) => {
    if (input.companyName !== undefined) transporter.companyName = input.companyName;
    if (input.contactPerson !== undefined) transporter.contactPerson = input.contactPerson;
    if (input.phone !== undefined) transporter.phone = input.phone;
    if (input.address !== undefined) transporter.address = input.address;
    if (input.serviceAreas !== undefined) transporter.serviceAreas = input.serviceAreas;
    if (input.status !== undefined) transporter.status = input.status;

    await transporter.save(session ? { session } : undefined);

    const userUpdate: Record<string, unknown> = {};
    if (input.contactPerson !== undefined) userUpdate.name = input.contactPerson;
    if (input.status !== undefined) userUpdate.isActive = input.status === EntityStatus.ACTIVE;
    if (input.newPassword) {
      userUpdate.passwordHash = await bcrypt.hash(input.newPassword, 10);
    }

    if (Object.keys(userUpdate).length > 0) {
      await User.findByIdAndUpdate(transporter.userId, userUpdate, session ? { session } : undefined);
    }

    return transporter;
  });
}

function normalizeCity(city: string): string {
  return city.trim().replace(/\s+/g, ' ');
}

function areaKey(area: IServiceArea): string {
  return `${normalizeCity(area.city).toLowerCase()}::${area.pincode.trim()}`;
}

export async function getMyTransporterProfile(userId: string) {
  const transporter = await Transporter.findOne({ userId }).select('-kyc.documents.storageKey').lean();
  if (!transporter) {
    throw new AppError('Transporter profile not found.', 404, 'TRANSPORTER_NOT_FOUND');
  }
  return transporter;
}

export async function updateMyTransporterProfile(
  userId: string,
  input: UpdateOwnTransporterProfileInput
) {
  const transporter = await Transporter.findOne({ userId });
  if (!transporter) {
    throw new AppError('Transporter profile not found.', 404, 'TRANSPORTER_NOT_FOUND');
  }

  return runInTransaction(async (session) => {
    if (input.companyName !== undefined) transporter.companyName = input.companyName;
    if (input.contactPerson !== undefined) transporter.contactPerson = input.contactPerson;
    if (input.phone !== undefined) transporter.phone = input.phone;
    if (input.address !== undefined) transporter.address = input.address;

    await transporter.save(session ? { session } : undefined);

    if (input.contactPerson !== undefined) {
      await User.findByIdAndUpdate(
        transporter.userId,
        { name: input.contactPerson },
        session ? { session } : undefined
      );
    }

    return transporter.toJSON();
  });
}

export async function importMyServiceAreas(userId: string, incoming: IServiceArea[]) {
  const transporter = await Transporter.findOne({ userId });
  if (!transporter) {
    throw new AppError('Transporter profile not found.', 404, 'TRANSPORTER_NOT_FOUND');
  }

  const existingMap = new Map<string, IServiceArea>();
  for (const area of transporter.serviceAreas) {
    existingMap.set(areaKey(area), {
      city: normalizeCity(area.city),
      pincode: area.pincode.trim(),
    });
  }

  let addedCount = 0;
  let duplicateCount = 0;

  for (const item of incoming) {
    const clean: IServiceArea = {
      city: normalizeCity(item.city),
      pincode: item.pincode.trim(),
    };
    const key = areaKey(clean);
    if (existingMap.has(key)) {
      duplicateCount += 1;
      continue;
    }
    existingMap.set(key, clean);
    addedCount += 1;
  }

  transporter.serviceAreas = Array.from(existingMap.values());
  await transporter.save();

  return {
    addedCount,
    duplicateCount,
    totalCount: transporter.serviceAreas.length,
    serviceAreas: transporter.serviceAreas,
  };
}

export async function removeMyServiceArea(userId: string, target: IServiceArea) {
  const transporter = await Transporter.findOne({ userId });
  if (!transporter) {
    throw new AppError('Transporter profile not found.', 404, 'TRANSPORTER_NOT_FOUND');
  }

  if (transporter.serviceAreas.length <= 1) {
    throw new AppError(
      'At least one active service area must remain configured.',
      400,
      'MIN_SERVICE_AREA_REQUIRED'
    );
  }

  const targetKey = areaKey(target);
  const nextAreas = transporter.serviceAreas.filter((a) => areaKey(a) !== targetKey);
  if (nextAreas.length === transporter.serviceAreas.length) {
    throw new AppError('Service area not found.', 404, 'SERVICE_AREA_NOT_FOUND');
  }

  transporter.serviceAreas = nextAreas;
  await transporter.save();

  return {
    totalCount: transporter.serviceAreas.length,
    serviceAreas: transporter.serviceAreas,
  };
}

export async function getMyTransporterEarnings(userId: string) {
  const transporter = await Transporter.findOne({ userId }).lean();
  if (!transporter) {
    throw new AppError('Transporter profile not found.', 404, 'TRANSPORTER_NOT_FOUND');
  }

  const [bookings, settlements] = await Promise.all([
    Booking.find({
      transporterId: transporter._id,
      status: { $nin: [BookingStatus.REJECTED, BookingStatus.CANCELLED] },
    })
      .select('bookingId lrNumber origin destination freight finalAmount tax pricingSnapshot status paymentMode createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean(),
    TransporterSettlement.find({ transporterId: transporter._id })
      .sort({ settledAt: -1 })
      .lean(),
  ]);

  const settledBookingIdSet = new Set<string>();
  let totalSettled = 0;
  for (const st of settlements) {
    if (st.status === SettlementStatus.SETTLED) {
      totalSettled = round2(totalSettled + Number(st.netPayoutAmount || 0));
    }
    for (const id of st.bookingIds || []) {
      settledBookingIdSet.add(id.toString());
    }
  }

  let deliveredGrossFreight = 0;
  let deliveredPlatformFee = 0;
  let deliveredNetEarned = 0;
  let unsettledDeliveredBalance = 0;
  let inTransitPipelineGross = 0;
  let inTransitPipelineNet = 0;

  const shipmentLedger = bookings.map((b) => {
    const grossFreight = round2(
      Number(b.freight || 0) + Number(b.pricingSnapshot?.additionalCharges || 0)
    );
    const platformFee = round2(grossFreight * (PLATFORM_COMMISSION_RATE / 100));
    const netEarning = round2(Math.max(0, grossFreight - platformFee));
    const isDelivered = b.status === BookingStatus.DELIVERED;
    const isSettled = settledBookingIdSet.has(b._id.toString());

    if (isDelivered) {
      deliveredGrossFreight = round2(deliveredGrossFreight + grossFreight);
      deliveredPlatformFee = round2(deliveredPlatformFee + platformFee);
      deliveredNetEarned = round2(deliveredNetEarned + netEarning);
      if (!isSettled) {
        unsettledDeliveredBalance = round2(unsettledDeliveredBalance + netEarning);
      }
    } else if (
      b.status === BookingStatus.ACCEPTED ||
      b.status === BookingStatus.DISPATCHED ||
      b.status === BookingStatus.ARRIVED ||
      b.status === BookingStatus.NDR
    ) {
      inTransitPipelineGross = round2(inTransitPipelineGross + grossFreight);
      inTransitPipelineNet = round2(inTransitPipelineNet + netEarning);
    }

    const isRto =
      b.status === BookingStatus.RTO_INITIATED || b.status === BookingStatus.RTO_DELIVERED;

    return {
      _id: b._id.toString(),
      bookingId: b.bookingId,
      lrNumber: b.lrNumber,
      lane: `${b.origin.city} → ${b.destination.city}`,
      status: b.status,
      paymentMode: b.paymentMode,
      grossFreight,
      gstAmount: round2(Number(b.tax || 0)),
      platformFee,
      netEarning,
      settlementState: isRto
        ? 'RTO_RETURN'
        : !isDelivered
          ? 'AWAITING_DELIVERY'
          : isSettled
            ? 'SETTLED'
            : 'PENDING_PAYOUT',
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  });

  return {
    commissionRatePercent: PLATFORM_COMMISSION_RATE,
    summary: {
      deliveredGrossFreight,
      deliveredPlatformFee,
      deliveredNetEarned,
      totalSettled,
      pendingSettlement: unsettledDeliveredBalance,
      inTransitPipelineGross,
      inTransitPipelineNet,
    },
    settlements,
    shipmentLedger,
  };
}
