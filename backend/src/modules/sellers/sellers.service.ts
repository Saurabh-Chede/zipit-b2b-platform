import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../../models/User.ts';
import { SellerProfile } from '../../models/SellerProfile.ts';
import {
  WalletPaymentMethod,
  WalletTransaction,
  WalletTransactionType,
} from '../../models/WalletTransaction.ts';
import { runInTransaction } from '../../config/database.ts';
import { AppError } from '../../utils/AppError.ts';
import { SellerApprovalStatus, UserRole } from '../../utils/constants.ts';
import { buildPaginatedResponse, parsePagination } from '../../utils/pagination.ts';
import { escapeRegex } from '../../utils/sanitize.ts';
import { NotificationCategory } from '../../models/Notification.ts';
import {
  createAndPushNotification,
  notifyAllAdmins,
} from '../notifications/notifications.service.ts';
import type { z } from 'zod';
import type {
  adjustSellerWalletSchema,
  createSavedAddressSchema,
  registerSellerSchema,
} from './sellers.validator.ts';

export type RegisterSellerInput = z.infer<typeof registerSellerSchema>;
export type AdjustSellerWalletInput = z.infer<typeof adjustSellerWalletSchema>;
export type CreateSavedAddressInput = z.infer<typeof createSavedAddressSchema>;

export async function registerSeller(input: RegisterSellerInput) {
  const existingUser = await User.findOne({ email: input.email }).lean();
  if (existingUser) {
    throw new AppError('An account with this email already exists.', 409, 'EMAIL_ALREADY_EXISTS');
  }

  const existingGst = await SellerProfile.findOne({ gstNumber: input.gstNumber }).lean();
  if (existingGst) {
    throw new AppError('A seller profile with this GSTIN already exists.', 409, 'GST_ALREADY_REGISTERED');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const created = await runInTransaction(async (session) => {
    const [user] = await User.create(
      [
        {
          name: input.ownerName,
          email: input.email,
          passwordHash,
          role: UserRole.SELLER,
          isActive: true,
        },
      ],
      session ? { session } : undefined
    );

    const [sellerProfile] = await SellerProfile.create(
      [
        {
          userId: user._id,
          businessName: input.businessName,
          ownerName: input.ownerName,
          email: input.email,
          phone: input.phone,
          gstNumber: input.gstNumber,
          businessAddress: input.businessAddress,
          city: input.city,
          pincode: input.pincode,
          approvalStatus: SellerApprovalStatus.PENDING,
        },
      ],
      session ? { session } : undefined
    );

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
      sellerProfile,
    };
  });

  void notifyAllAdmins({
    category: NotificationCategory.SELLER_KYC,
    title: `New Seller Application: ${input.businessName}`,
    message: `${input.ownerName} (${input.city}, GST ${input.gstNumber}) applied for seller approval.`,
    link: '/admin/sellers',
    entityType: 'SellerProfile',
    entityId: created.sellerProfile._id.toString(),
  });

  return created;
}

export async function listSellers(query: Record<string, unknown>) {
  const pagination = parsePagination(query);
  const filter: Record<string, unknown> = {};

  if (query.status && Object.values(SellerApprovalStatus).includes(query.status as SellerApprovalStatus)) {
    filter.approvalStatus = query.status;
  }

  if (typeof query.search === 'string' && query.search.trim()) {
    const regex = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [
      { businessName: regex },
      { ownerName: regex },
      { email: regex },
      { gstNumber: regex },
      { city: regex },
    ];
  }

  const [items, total] = await Promise.all([
    SellerProfile.find(filter)
      .select('-kyc.documents.storageKey')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    SellerProfile.countDocuments(filter),
  ]);

  return buildPaginatedResponse(items, total, pagination);
}

export async function listPendingSellers(query: Record<string, unknown>) {
  return listSellers({ ...query, status: SellerApprovalStatus.PENDING });
}

export async function getSellerById(sellerId: string) {
  const seller = await SellerProfile.findById(sellerId).select('-kyc.documents.storageKey').lean();
  if (!seller) {
    throw new AppError('Seller profile not found.', 404, 'SELLER_NOT_FOUND');
  }
  return seller;
}

export async function getSellerByUserId(userId: string) {
  const seller = await SellerProfile.findOne({ userId }).select('-kyc.documents.storageKey').lean();
  if (!seller) {
    throw new AppError('Seller profile not found.', 404, 'SELLER_NOT_FOUND');
  }
  return seller;
}

export async function approveSeller(sellerId: string, adminUserId: string) {
  const seller = await SellerProfile.findById(sellerId);
  if (!seller) {
    throw new AppError('Seller application not found.', 404, 'SELLER_NOT_FOUND');
  }

  if (seller.approvalStatus === SellerApprovalStatus.APPROVED) {
    throw new AppError('Seller is already approved.', 400, 'SELLER_ALREADY_APPROVED');
  }

  seller.approvalStatus = SellerApprovalStatus.APPROVED;
  seller.rejectionReason = undefined;
  seller.reviewedBy = adminUserId as unknown as typeof seller.reviewedBy;
  seller.reviewedAt = new Date();
  await seller.save();

  void createAndPushNotification({
    recipientUserId: seller.userId.toString(),
    recipientRole: UserRole.SELLER,
    category: NotificationCategory.SELLER_KYC,
    title: 'Seller Account Approved',
    message: `Your KYC application for ${seller.businessName} is approved. You can now book shipments.`,
    link: '/seller/create-booking',
    entityType: 'SellerProfile',
    entityId: seller._id.toString(),
  });

  return seller;
}

export async function rejectSeller(sellerId: string, adminUserId: string, rejectionReason: string) {
  const seller = await SellerProfile.findById(sellerId);
  if (!seller) {
    throw new AppError('Seller application not found.', 404, 'SELLER_NOT_FOUND');
  }

  seller.approvalStatus = SellerApprovalStatus.REJECTED;
  seller.rejectionReason = rejectionReason;
  seller.reviewedBy = adminUserId as unknown as typeof seller.reviewedBy;
  seller.reviewedAt = new Date();
  await seller.save();

  void createAndPushNotification({
    recipientUserId: seller.userId.toString(),
    recipientRole: UserRole.SELLER,
    category: NotificationCategory.SELLER_KYC,
    title: 'Seller Application Rejected',
    message: `Your application for ${seller.businessName} was rejected: ${rejectionReason}`,
    link: '/seller/profile',
    entityType: 'SellerProfile',
    entityId: seller._id.toString(),
  });

  return seller;
}

function generateAdminWalletTxnId(): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ZPT-TXN-${ymd}-${rand}`;
}

export async function getSellerWalletForAdmin(sellerId: string) {
  const seller = await SellerProfile.findById(sellerId)
    .select('businessName ownerName email gstNumber walletBalance approvalStatus')
    .lean();

  if (!seller) {
    throw new AppError('Seller profile not found.', 404, 'SELLER_NOT_FOUND');
  }

  const transactions = await WalletTransaction.find({ sellerId: seller._id })
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();

  return {
    sellerId: seller._id.toString(),
    businessName: seller.businessName,
    ownerName: seller.ownerName,
    email: seller.email,
    gstNumber: seller.gstNumber,
    approvalStatus: seller.approvalStatus,
    walletBalance: Number(seller.walletBalance || 0),
    transactions,
  };
}

export async function adjustSellerWalletByAdmin(
  sellerId: string,
  adminUserId: string,
  adminName: string,
  input: AdjustSellerWalletInput,
  idempotencyKey?: string
) {
  const cleanAmount = Math.round(input.amount * 100) / 100;
  if (cleanAmount <= 0) {
    throw new AppError('Adjustment amount must be greater than zero.', 400, 'INVALID_AMOUNT');
  }

  const cleanIdemKey = idempotencyKey?.trim() || undefined;
  const isCredit = input.type === 'CREDIT';

  const result = await runInTransaction(async (session) => {
    if (cleanIdemKey) {
      const existingTxn = await WalletTransaction.findOne(
        { sellerId, idempotencyKey: cleanIdemKey },
        null,
        session ? { session } : undefined
      ).lean();

      if (existingTxn) {
        const currentSeller = await SellerProfile.findById(
          sellerId,
          'walletBalance',
          session ? { session } : undefined
        ).lean();
        return {
          walletBalance: Number(currentSeller?.walletBalance || existingTxn.balanceAfter),
          transaction: existingTxn,
          sellerUserId: existingTxn.userId.toString(),
          businessName: '',
          idempotentReplay: true,
        };
      }
    }

    const filter = isCredit
      ? { _id: sellerId }
      : { _id: sellerId, walletBalance: { $gte: cleanAmount } };

    const updatedSeller = await SellerProfile.findOneAndUpdate(
      filter,
      { $inc: { walletBalance: isCredit ? cleanAmount : -cleanAmount } },
      { returnDocument: 'after', ...(session ? { session } : {}) }
    ).lean();

    if (!updatedSeller) {
      const exists = await SellerProfile.findById(
        sellerId,
        'walletBalance',
        session ? { session } : undefined
      ).lean();
      if (!exists) {
        throw new AppError('Seller profile not found.', 404, 'SELLER_NOT_FOUND');
      }
      throw new AppError(
        `Insufficient seller wallet balance (Available: INR ${Number(exists.walletBalance || 0).toFixed(2)}).`,
        400,
        'INSUFFICIENT_WALLET_BALANCE'
      );
    }

    const refLabel = input.referenceNote?.trim()
      ? `${input.referenceNote.trim()} (By ${adminName})`
      : `Admin Adjustment (${adminName})`;

    const [txn] = await WalletTransaction.create(
      [
        {
          transactionId: generateAdminWalletTxnId(),
          sellerId: updatedSeller._id,
          userId: updatedSeller.userId,
          type: isCredit ? WalletTransactionType.CREDIT : WalletTransactionType.DEBIT,
          amount: cleanAmount,
          balanceAfter: Number(updatedSeller.walletBalance || 0),
          paymentMethod: WalletPaymentMethod.ADMIN_ADJUSTMENT,
          referenceNote: refLabel.slice(0, 140),
          description: input.reason.trim(),
          ...(cleanIdemKey ? { idempotencyKey: cleanIdemKey } : {}),
        },
      ],
      session ? { session } : undefined
    );

    return {
      walletBalance: Number(updatedSeller.walletBalance || 0),
      transaction: txn.toJSON(),
      sellerUserId: updatedSeller.userId.toString(),
      businessName: updatedSeller.businessName,
      adminUserId,
      idempotentReplay: false,
    };
  });

  if (!result.idempotentReplay) {
    void createAndPushNotification({
      recipientUserId: result.sellerUserId,
      recipientRole: UserRole.SELLER,
      category: NotificationCategory.WALLET,
      title: isCredit
        ? `Admin Wallet Credit: INR ${cleanAmount.toFixed(2)}`
        : `Admin Wallet Debit: INR ${cleanAmount.toFixed(2)}`,
      message: `${input.reason.trim()} — Updated balance: INR ${result.walletBalance.toFixed(2)}.`,
      link: '/seller/profile',
      entityType: 'WalletTransaction',
      entityId: result.transaction.transactionId,
    });
  }

  return {
    walletBalance: result.walletBalance,
    transaction: result.transaction,
    idempotentReplay: result.idempotentReplay,
  };
}

export async function listSellerAddresses(userId: string) {
  const seller = await SellerProfile.findOne({ userId }).select('savedAddresses').lean();
  if (!seller) {
    throw new AppError('Seller profile not found.', 404, 'SELLER_NOT_FOUND');
  }
  return seller.savedAddresses || [];
}

export async function addSellerAddress(userId: string, input: CreateSavedAddressInput) {
  const seller = await SellerProfile.findOne({ userId });
  if (!seller) {
    throw new AppError('Seller profile not found.', 404, 'SELLER_NOT_FOUND');
  }

  const currentList = seller.savedAddresses || [];
  if (currentList.length >= 50) {
    throw new AppError(
      'Maximum of 50 saved addresses reached. Delete an unused address first.',
      400,
      'ADDRESS_LIMIT_REACHED'
    );
  }

  if (input.isDefault) {
    for (const addr of currentList) {
      if (
        addr.addressType === input.addressType ||
        addr.addressType === 'BOTH' ||
        input.addressType === 'BOTH'
      ) {
        addr.isDefault = false;
      }
    }
  }

  currentList.push({
    label: input.label,
    addressType: input.addressType,
    name: input.name,
    phone: input.phone,
    address: input.address,
    city: input.city,
    pincode: input.pincode,
    isDefault: Boolean(input.isDefault),
  } as unknown as (typeof currentList)[number]);

  seller.savedAddresses = currentList;
  await seller.save();

  return seller.savedAddresses;
}

export async function deleteSellerAddress(userId: string, addressId: string) {
  const seller = await SellerProfile.findOne({ userId });
  if (!seller) {
    throw new AppError('Seller profile not found.', 404, 'SELLER_NOT_FOUND');
  }

  const list = seller.savedAddresses || [];
  const nextList = list.filter((addr) => addr._id.toString() !== addressId);
  if (nextList.length === list.length) {
    throw new AppError('Saved address not found.', 404, 'ADDRESS_NOT_FOUND');
  }

  seller.savedAddresses = nextList as typeof seller.savedAddresses;
  await seller.save();

  return seller.savedAddresses;
}


