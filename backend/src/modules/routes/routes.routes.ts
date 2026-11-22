import { Router } from 'express';
import { createRouteController, listRoutesController, updateRouteController } from './routes.controller.ts';
import { authenticate } from '../../middleware/auth.ts';
import { authorizeRoles } from '../../middleware/rbac.ts';
import { validateRequest } from '../../middleware/validate.ts';
import {
  createRouteSchema,
  listRoutesQuerySchema,
  routeIdParamSchema,
  updateRouteSchema,
} from './routes.validator.ts';
import { UserRole } from '../../utils/constants.ts';

const routesRouter = Router();

routesRouter.use(authenticate);

routesRouter.post(
  '/',
  authorizeRoles(UserRole.ADMIN),
  validateRequest({ body: createRouteSchema }),
  createRouteController
);

routesRouter.get(
  '/',
  authorizeRoles(UserRole.ADMIN, UserRole.SELLER, UserRole.TRANSPORTER),
  validateRequest({ query: listRoutesQuerySchema }),
  listRoutesController
);

routesRouter.patch(
  '/:id',
  authorizeRoles(UserRole.ADMIN),
  validateRequest({ params: routeIdParamSchema, body: updateRouteSchema }),
  updateRouteController
);

export { routesRouter };
