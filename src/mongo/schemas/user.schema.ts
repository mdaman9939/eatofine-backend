import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: 'users', timestamps: true })
export class User {
  // Keep the original MySQL id so we can cross-reference during the
  // transition period when both DBs run in parallel.
  @Prop({ index: true, unique: true })
  mysql_id?: number;

  @Prop({ trim: true }) f_name?: string;
  @Prop({ trim: true }) l_name?: string;
  @Prop({ trim: true, lowercase: true, index: true }) email?: string;
  @Prop({ trim: true, index: true }) phone?: string;
  @Prop() password?: string;
  @Prop({ default: true }) status?: boolean;
  @Prop() image?: string;
  @Prop() ref_code?: string;
  @Prop() is_phone_verified?: boolean;
  @Prop() is_email_verified?: boolean;
  @Prop({ type: Date }) last_login_at?: Date;
  // Raw JSON dump of less-used MySQL columns so nothing is lost during migration.
  @Prop({ type: Object }) legacy?: Record<string, unknown>;
}

export const UserSchema = SchemaFactory.createForClass(User);
