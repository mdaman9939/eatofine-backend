import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CuisineDocument = HydratedDocument<Cuisine>;

@Schema({ collection: 'cuisines', timestamps: true })
export class Cuisine {
  @Prop({ index: true, unique: true })
  mysql_id?: number;

  @Prop({ trim: true, index: true }) name?: string;
  @Prop() image?: string;
  @Prop({ default: true }) status?: boolean;
  @Prop({ type: Object }) legacy?: Record<string, unknown>;
}

export const CuisineSchema = SchemaFactory.createForClass(Cuisine);
