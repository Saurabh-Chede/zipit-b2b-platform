import { TransportRoute } from '../../models/TransportRoute.ts';
import { AppError } from '../../utils/AppError.ts';
import { EntityStatus } from '../../utils/constants.ts';
import { buildPaginatedResponse, parsePagination } from '../../utils/pagination.ts';
import { escapeRegex } from '../../utils/sanitize.ts';
import type { z } from 'zod';
import type { createRouteSchema, updateRouteSchema } from './routes.validator.ts';

export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;

export async function createRoute(input: CreateRouteInput) {
  if (input.originPincode === input.destinationPincode) {
    throw new AppError(
      'Origin and destination pincodes must be different.',
      400,
      'INVALID_ROUTE_PINCODES'
    );
  }

  const existing = await TransportRoute.findOne({
    originPincode: input.originPincode,
    destinationPincode: input.destinationPincode,
  }).lean();

  if (existing) {
    throw new AppError(
      `Route from ${input.originPincode} to ${input.destinationPincode} already exists.`,
      409,
      'ROUTE_ALREADY_EXISTS'
    );
  }

  return TransportRoute.create(input);
}

export async function listRoutes(query: Record<string, unknown>, forceActiveOnly = false) {
  const pagination = parsePagination(query, 50, 100);
  const filter: Record<string, unknown> = {};

  if (forceActiveOnly) {
    filter.status = EntityStatus.ACTIVE;
  } else if (query.status && Object.values(EntityStatus).includes(query.status as EntityStatus)) {
    filter.status = query.status;
  }

  if (typeof query.search === 'string' && query.search.trim()) {
    const regex = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [
      { originCity: regex },
      { originPincode: regex },
      { destinationCity: regex },
      { destinationPincode: regex },
    ];
  }

  const [items, total] = await Promise.all([
    TransportRoute.find(filter)
      .sort({ originCity: 1, destinationCity: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    TransportRoute.countDocuments(filter),
  ]);

  return buildPaginatedResponse(items, total, pagination);
}

export async function updateRoute(id: string, input: UpdateRouteInput) {
  const route = await TransportRoute.findById(id);
  if (!route) {
    throw new AppError('Transport route not found.', 404, 'ROUTE_NOT_FOUND');
  }

  const nextOrigin = input.originPincode ?? route.originPincode;
  const nextDest = input.destinationPincode ?? route.destinationPincode;
  if (nextOrigin === nextDest) {
    throw new AppError('Origin and destination pincodes must be different.', 400, 'INVALID_ROUTE_PINCODES');
  }

  Object.assign(route, input);
  await route.save();
  return route;
}
