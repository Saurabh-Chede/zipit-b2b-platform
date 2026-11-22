import { z } from 'zod';
import { EntityStatus } from '../../utils/constants.ts';

export const createRouteSchema = z.object({
  originCity: z.string().min(2).max(100).trim(),
  originPincode: z.string().regex(/^\d{6}$/, 'Origin pincode must be 6 digits'),
  destinationCity: z.string().min(2).max(100).trim(),
  destinationPincode: z.string().regex(/^\d{6}$/, 'Destination pincode must be 6 digits'),
  distanceKm: z.coerce.number().positive().optional(),
  status: z.nativeEnum(EntityStatus).optional().default(EntityStatus.ACTIVE),
});

export const updateRouteSchema = z.object({
  originCity: z.string().min(2).max(100).trim().optional(),
  originPincode: z.string().regex(/^\d{6}$/).optional(),
  destinationCity: z.string().min(2).max(100).trim().optional(),
  destinationPincode: z.string().regex(/^\d{6}$/).optional(),
  distanceKm: z.coerce.number().positive().optional(),
  status: z.nativeEnum(EntityStatus).optional(),
});

export const listRoutesQuerySchema = z.object({
  status: z.nativeEnum(EntityStatus).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const routeIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid route ID'),
});
