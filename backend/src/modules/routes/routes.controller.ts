import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.ts';
import { createRoute, listRoutes, updateRoute } from './routes.service.ts';
import { UserRole } from '../../utils/constants.ts';
import { logger } from '../../config/logger.ts';

export const createRouteController = asyncHandler(async (req: Request, res: Response) => {
  const route = await createRoute(req.body);
  logger.info({
    requestId: req.requestId,
    module: 'routes',
    action: 'route_created',
    meta: { routeId: route._id.toString() },
  });
  res.status(201).json({
    success: true,
    message: 'Transport route created successfully.',
    data: route,
  });
});

export const listRoutesController = asyncHandler(async (req: Request, res: Response) => {
  const forceActiveOnly = req.user?.role !== UserRole.ADMIN;
  const data = await listRoutes(req.query as Record<string, unknown>, forceActiveOnly);
  res.status(200).json({ success: true, data });
});

export const updateRouteController = asyncHandler(async (req: Request, res: Response) => {
  const route = await updateRoute(req.params.id, req.body);
  logger.info({
    requestId: req.requestId,
    module: 'routes',
    action: 'route_updated',
    meta: { routeId: req.params.id },
  });
  res.status(200).json({
    success: true,
    message: 'Transport route updated successfully.',
    data: route,
  });
});
