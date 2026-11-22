import { Router } from 'express';
import {
  createTransporterController,
  getTransporterByIdController,
  listTransportersController,
  updateTransporterController,
} from './transporters.controller.ts';
import { authenticate } from '../../middleware/auth.ts';
import { authorizeRoles } from '../../middleware/rbac.ts';
import { validateRequest } from '../../middleware/validate.ts';
import {
  createTransporterSchema,
  listTransportersQuerySchema,
  transporterIdParamSchema,
  updateTransporterSchema,
} from './transporters.validator.ts';
import { UserRole } from '../../utils/constants.ts';

const transportersRouter = Router();

transportersRouter.use(authenticate);

transportersRouter.post(
  '/',
  authorizeRoles(UserRole.ADMIN),
  validateRequest({ body: createTransporterSchema }),
  createTransporterController
);

transportersRouter.get(
  '/',
  authorizeRoles(UserRole.ADMIN, UserRole.SELLER),
  validateRequest({ query: listTransportersQuerySchema }),
  listTransportersController
);

transportersRouter.get(
  '/:id',
  authorizeRoles(UserRole.ADMIN, UserRole.SELLER),
  validateRequest({ params: transporterIdParamSchema }),
  getTransporterByIdController
);

transportersRouter.patch(
  '/:id',
  authorizeRoles(UserRole.ADMIN),
  validateRequest({ params: transporterIdParamSchema, body: updateTransporterSchema }),
  updateTransporterController
);

export { transportersRouter };
