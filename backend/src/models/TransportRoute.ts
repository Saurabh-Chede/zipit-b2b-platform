import mongoose, { Schema, Document } from 'mongoose';
import { EntityStatus } from '../utils/constants.ts';

export interface ITransportRoute extends Document {
  _id: mongoose.Types.ObjectId;
  originCity: string;
  originPincode: string;
  destinationCity: string;
  destinationPincode: string;
  distanceKm?: number;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
}

const transportRouteSchema = new Schema<ITransportRoute>(
  {
    originCity: {
      type: String,
      required: [true, 'Origin city is required'],
      trim: true,
      maxlength: 100,
    },
    originPincode: {
      type: String,
      required: [true, 'Origin pincode is required'],
      trim: true,
      match: [/^\d{6}$/, 'Origin pincode must be 6 digits'],
    },
    destinationCity: {
      type: String,
      required: [true, 'Destination city is required'],
      trim: true,
      maxlength: 100,
    },
    destinationPincode: {
      type: String,
      required: [true, 'Destination pincode is required'],
      trim: true,
      match: [/^\d{6}$/, 'Destination pincode must be 6 digits'],
    },
    distanceKm: {
      type: Number,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(EntityStatus),
      default: EntityStatus.ACTIVE,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

transportRouteSchema.index({ originPincode: 1, destinationPincode: 1 }, { unique: true });
transportRouteSchema.index({ status: 1, originCity: 1, destinationCity: 1 });

export const TransportRoute = mongoose.model<ITransportRoute>('TransportRoute', transportRouteSchema);
