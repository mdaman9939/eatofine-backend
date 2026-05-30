import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ collection: 'orders', timestamps: true })
export class Order {
  @Prop({ index: true, unique: true })
  mysql_id?: number;

  @Prop({ index: true }) mysql_user_id?: number;
  @Prop({ index: true }) mysql_restaurant_id?: number;
  @Prop({ index: true }) mysql_delivery_man_id?: number;
  @Prop({ index: true }) mysql_zone_id?: number;

  @Prop({ index: true }) order_status?: string;
  @Prop() payment_status?: string;
  @Prop() payment_method?: string;
  @Prop() order_type?: string;

  @Prop() order_amount?: number;
  @Prop() total_tax_amount?: number;
  @Prop() delivery_charge?: number;
  @Prop() coupon_discount_amount?: number;
  @Prop() additional_charge?: number;
  @Prop() restaurant_discount_amount?: number;

  // The line items live in a separate MySQL table (order_details). For now we
  // embed them on the order document — MongoDB document model lets us avoid
  // the JOIN entirely.
  @Prop({ type: [Object], default: [] })
  items?: Array<Record<string, unknown>>;

  @Prop({ type: Date }) created_at_legacy?: Date;
  @Prop({ type: Date }) delivered?: Date;
  @Prop({ type: Object }) legacy?: Record<string, unknown>;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ order_status: 1, mysql_restaurant_id: 1 });
