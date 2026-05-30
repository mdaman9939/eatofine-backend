import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type VendorDocument = HydratedDocument<Vendor>;

@Schema({ collection: 'vendors', timestamps: true })
export class Vendor {
  @Prop({ index: true, unique: true })
  mysql_id?: number;

  @Prop({ trim: true }) f_name?: string;
  @Prop({ trim: true }) l_name?: string;
  @Prop({ trim: true, lowercase: true, index: true }) email?: string;
  @Prop({ trim: true, index: true }) phone?: string;
  @Prop() password?: string;
  @Prop({ default: true }) status?: boolean;
  @Prop() image?: string;
  @Prop({ type: Date }) last_login_at?: Date;
  @Prop({ type: Object }) legacy?: Record<string, unknown>;
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);
