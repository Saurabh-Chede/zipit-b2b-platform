import { Router } from 'express';
import {
  listTransporterBookingsController,
  scanGlobalCartonController,
} from '../bookings/bookings.controller.ts';
import {
  addMyServiceAreaController,
  getMyEarningsController,
  getMyProfileController,
  importMyServiceAreasController,
  removeMyServiceAreaController,
  updateMyProfileController,
} from './transporters.controller.ts';
import { authenticate } from '../../middleware/auth.ts';
import { authorizeRoles } from '../../middleware/rbac.ts';
import { validateRequest } from '../../middleware/validate.ts';
import {
  globalScanCartonSchema,
  listBookingsQuerySchema,
} from '../bookings/bookings.validator.ts';
import {
  addServiceAreaSchema,
  deleteServiceAreaSchema,
  importServiceAreasSchema,
  updateOwnTransporterProfileSchema,
} from './transporters.validator.ts';
import { UserRole } from '../../utils/constants.ts';

const transporterOpsRouter = Router();

transporterOpsRouter.use(authenticate, authorizeRoles(UserRole.TRANSPORTER));

transporterOpsRouter.get(
  '/bookings',
  validateRequest({ query: listBookingsQuerySchema }),
  listTransporterBookingsController
);

transporterOpsRouter.post(
  '/cartons/scan',
  validateRequest({ body: globalScanCartonSchema }),
  scanGlobalCartonController
);

transporterOpsRouter.get('/profile', getMyProfileController);
transporterOpsRouter.patch(
  '/profile',
  validateRequest({ body: updateOwnTransporterProfileSchema }),
  updateMyProfileController
);

transporterOpsRouter.post(
  '/service-areas',
  validateRequest({ body: addServiceAreaSchema }),
  addMyServiceAreaController
);
transporterOpsRouter.post(
  '/service-areas/import',
  validateRequest({ body: importServiceAreasSchema }),
  importMyServiceAreasController
);
transporterOpsRouter.delete(
  '/service-areas',
  validateRequest({ body: deleteServiceAreaSchema }),
  removeMyServiceAreaController
);

transporterOpsRouter.get('/earnings', getMyEarningsController);

export { transporterOpsRouter };

