import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FoodDocument = HydratedDocument<Food>;

@Schema({ collection: 'foods', timestamps: true })
export class Food {
  @Prop({ index: true, unique: true })
  mysql_id?: number;

  @Prop({ trim: true, index: true }) name?: string;
  @Prop() description?: string;
  @Prop() image?: string;

  @Prop({ index: true }) mysql_restaurant_id?: number;
  @Prop({ index: true }) mysql_category_id?: number;

  @Prop() price?: number;
  @Prop() discount?: number;
  @Prop() discount_type?: string;
  @Prop() veg?: boolean;
  @Prop({ default: true }) status?: boolean;
  @Prop({ default: false }) recommended?: boolean;
  @Prop() avg_rating?: number;
  @Prop() order_count?: number;
  @Prop() item_stock?: number;
  @Prop() stock_type?: string;

  // The MySQL design stores variations/add-ons as JSON columns. Mirror that.
  @Prop({ type: Object }) variations?: unknown;
  @Prop({ type: Object }) add_ons?: unknown;
  @Prop({ type: Object }) legacy?: Record<string, unknown>;
}

export const FoodSchema = SchemaFactory.createForClass(Food);
