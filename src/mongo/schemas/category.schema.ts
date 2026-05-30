import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ collection: 'categories', timestamps: true })
export class Category {
  @Prop({ index: true, unique: true })
  mysql_id?: number;

  @Prop({ trim: true, index: true }) name?: string;
  @Prop() image?: string;
  @Prop({ index: true }) parent_id?: number; // 0 = top-level
  @Prop({ index: true }) position?: number;
  @Prop() priority?: number;
  @Prop({ default: true }) status?: boolean;
  @Prop({ type: Object }) legacy?: Record<string, unknown>;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
