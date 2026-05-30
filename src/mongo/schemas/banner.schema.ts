import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BannerDocument = HydratedDocument<Banner>;

@Schema({ collection: 'banners', timestamps: true })
export class Banner {
  @Prop({ index: true, unique: true })
  mysql_id?: number;

  @Prop({ trim: true }) title?: string;
  @Prop() type?: string;
  @Prop() image?: string;
  @Prop({ type: Object }) data?: unknown;
  @Prop() zone_id?: number;
  @Prop({ default: true }) status?: boolean;
  @Prop({ type: Object }) legacy?: Record<string, unknown>;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);
