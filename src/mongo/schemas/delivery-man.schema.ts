import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DeliveryManDocument = HydratedDocument<DeliveryMan>;

@Schema({ collection: 'delivery_men', timestamps: true })
export class DeliveryMan {
  @Prop({ index: true, unique: true })
  mysql_id?: number;

  @Prop({ trim: true }) f_name?: string;
  @Prop({ trim: true }) l_name?: string;
  @Prop({ trim: true, lowercase: true, index: true }) email?: string;
  @Prop({ trim: true, index: true }) phone?: string;
  @Prop() password?: string;
  @Prop({ default: true }) status?: boolean;
  @Prop() image?: string;
  @Prop() application_status?: string; // approved / pending / denied
  @Prop({ index: true }) mysql_zone_id?: number;
  @Prop({ type: Object }) legacy?: Record<string, unknown>;
}

export const DeliveryManSchema = SchemaFactory.createForClass(DeliveryMan);
