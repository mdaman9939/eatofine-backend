import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RestaurantDocument = HydratedDocument<Restaurant>;

@Schema({ collection: 'restaurants', timestamps: true })
export class Restaurant {
  @Prop({ index: true, unique: true })
  mysql_id?: number;

  @Prop({ trim: true, index: true }) name?: string;
  @Prop({ trim: true, lowercase: true }) email?: string;
  @Prop({ trim: true }) phone?: string;
  @Prop() address?: string;
  @Prop() latitude?: number;
  @Prop() longitude?: number;

  // The MySQL design has vendor_id + zone_id pointing to other tables. We keep
  // those numeric ids here (mysql_*) plus an optional `ObjectId` ref that gets
  // populated when the related collection is migrated.
  @Prop({ index: true }) mysql_vendor_id?: number;
  @Prop({ index: true }) mysql_zone_id?: number;

  @Prop() logo?: string;
  @Prop() cover_photo?: string;
  @Prop() comission?: number;
  @Prop() minimum_order?: number;
  @Prop() restaurant_model?: string; // commission / subscription / unset
  @Prop({ default: true }) status?: boolean;
  @Prop({ default: true }) active?: boolean;
  @Prop() order_count?: number;
  @Prop({ type: Object }) legacy?: Record<string, unknown>;
}

export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);
