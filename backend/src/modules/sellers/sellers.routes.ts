import { Router } from 'express';
import {
  addSellerAddressController,
  adjustSellerWalletController,
  approveSellerController,
  deleteSellerAddressController,
  getOwnSellerProfileController,
  getSellerByIdController,
  getSellerWalletAdminController,
  listPendingSellersController,
  listSellerAddressesController,
  listSellersController,
  registerSellerController,
  rejectSellerController,
} from './sellers.controller.ts';
import { authenticate } from '../../middleware/auth.ts';
import { authorizeRoles } from '../../middleware/rbac.ts';
import { validateRequest } from '../../middleware/validate.ts';
import {
  addressIdParamSchema,
  adjustSellerWalletSchema,
  createSavedAddressSchema,
  listSellersQuerySchema,
  registerSellerSchema,
  rejectSellerSchema,
  sellerIdParamSchema,
} from './sellers.validator.ts';
import { UserRole } from '../../utils/constants.ts';

const sellersRouter = Router();

sellersRouter.post('/register', validateRequest({ body: registerSellerSchema }), registerSellerController);

sellersRouter.get('/me', authenticate, authorizeRoles(UserRole.SELLER), getOwnSellerProfileController);
sellersRouter.get(
  '/me/addresses',
  authenticate,
  authorizeRoles(UserRole.SELLER),
  listSellerAddressesController
);
sellersRouter.post(
  '/me/addresses',
  authenticate,
  authorizeRoles(UserRole.SELLER),
  validateRequest({ body: createSavedAddressSchema }),
  addSellerAddressController
);
sellersRouter.delete(
  '/me/addresses/:addressId',
  authenticate,
  authorizeRoles(UserRole.SELLER),
  validateRequest({ params: addressIdParamSchema }),
  deleteSellerAddressController
);

sellersRouter.get(
  '/pending',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  validateRequest({ query: listSellersQuerySchema }),
  listPendingSellersController
);

sellersRouter.get(
  '/',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  validateRequest({ query: listSellersQuerySchema }),
  listSellersController
);

sellersRouter.get(
  '/:id',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  validateRequest({ params: sellerIdParamSchema }),
  getSellerByIdController
);

sellersRouter.patch(
  '/:id/approve',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  validateRequest({ params: sellerIdParamSchema }),
  approveSellerController
);

sellersRouter.patch(
  '/:id/reject',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  validateRequest({ params: sellerIdParamSchema, body: rejectSellerSchema }),
  rejectSellerController
);

sellersRouter.get(
  '/:id/wallet',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  validateRequest({ params: sellerIdParamSchema }),
  getSellerWalletAdminController
);

sellersRouter.post(
  '/:id/wallet-adjust',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  validateRequest({ params: sellerIdParamSchema, body: adjustSellerWalletSchema }),
  adjustSellerWalletController
);

export { sellersRouter };
