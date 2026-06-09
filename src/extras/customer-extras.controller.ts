import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards, UseInterceptors, HttpCode } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { AuthGuard, RequireAuth } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { storageFullUrl } from '../common/storage-url';

interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

// Where uploaded profile images land on disk. Matches the resolution
// used by main.ts so static serving + writes target the same folder.
const STORAGE_ROOT = (() => {
  if (process.env.STORAGE_ROOT) return process.env.STORAGE_ROOT;
  const fs = require('fs') as typeof import('fs');
  const repoLocal = path.resolve(__dirname, '../../storage/app/public');
  const monorepo = path.resolve(__dirname, '../../../../storage/app/public');
  return fs.existsSync(repoLocal) ? repoLocal : monorepo;
})();

// Local Mongo doc shapes for the collections we touch here. Only the
// fields actually referenced are declared.
interface MongoNotificationDoc {
  mysql_id: number;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  status?: boolean | null;
  created_at?: Date | string | null;
}

interface MongoFoodDoc {
  mysql_id: number;
  name?: string | null;
  description?: string | null;
  image?: string | null;
  price?: number | string | null;
  tax?: number | string | null;
  discount?: number | string | null;
  mysql_restaurant_id?: number | null;
  mysql_category_id?: number | null;
  status?: boolean | null;
  avg_rating?: number | null;
  legacy?: Record<string, unknown>;
}

interface MongoOrderDoc {
  mysql_id: number;
  mysql_user_id?: number | null;
  mysql_restaurant_id?: number | null;
  order_status?: string | null;
  order_amount?: number | string | null;
  legacy?: Record<string, unknown>;
}

interface MongoOrderDetailDoc {
  mysql_id: number;
  mysql_order_id?: number | null;
  mysql_food_id?: number | null;
  price?: number | string | null;
  tax_amount?: number | string | null;
  total_add_on_price?: number | string | null;
  mysql_item_campaign_id?: number | null;
  discount_on_food?: number | string | null;
  legacy?: Record<string, unknown>;
}

interface MongoRefundReasonDoc {
  mysql_id: number;
  reason?: string | null;
  status?: boolean | null;
}

interface MongoAddressDoc {
  mysql_id: number;
  mysql_user_id?: number | null;
  user_id?: number | null;
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  return Number(v) || 0;
};

// Mirrors a handful of customer endpoints that the Flutter app calls on
// idle screens (wish-list, notifications, wallet, etc.). For demo purposes
// these return empty / acknowledged shapes so the app never crashes.
@Controller('customer')
@UseGuards(AuthGuard)
@RequireAuth('customer')
export class CustomerExtrasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
  ) {}

  /** Feature flag — when set, extras read/write Mongo first. */
  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_EXTRAS ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  // ── Wish list ─────────────────────────────────────────────────────
  // Persistent against `wishlists` collection: one doc per (user_id, food_id)
  // and (user_id, restaurant_id) pair. Add is idempotent — duplicate inserts
  // are caught and treated as success so re-tapping the heart icon doesn't
  // surface a spurious error.
  @Get('wish-list')
  async wishList(@Req() req: AuthedRequest) {
    const userId = Number(req.actor!.id);
    const rows = await this.mongo.findMany<{
      mysql_id: number; user_id?: number; food_id?: number | null;
      restaurant_id?: number | null; created_at?: Date;
    }>('wishlists', { user_id: userId });
    const foodIds = rows.map((r) => r.food_id).filter((x): x is number => x != null);
    const restaurantIds = rows.map((r) => r.restaurant_id).filter((x): x is number => x != null);
    const [foods, restaurants] = await Promise.all([
      foodIds.length
        ? this.mongo.findMany<MongoFoodDoc>('foods', { mysql_id: { $in: foodIds } })
        : Promise.resolve([] as MongoFoodDoc[]),
      restaurantIds.length
        ? this.mongo.findMany<{ mysql_id: number; name?: string | null; logo?: string | null; address?: string | null; avg_rating?: number | null }>(
            'restaurants', { mysql_id: { $in: restaurantIds } },
          )
        : Promise.resolve([] as Array<{ mysql_id: number; name?: string | null; logo?: string | null; address?: string | null; avg_rating?: number | null }>),
    ]);
    return {
      product: foods.map((f) => ({
        ...(f.legacy ?? {}),
        ...f,
        id: Number(f.mysql_id),
        price: toNum(f.price),
        discount: toNum(f.discount),
        tax: toNum(f.tax),
        restaurant_id: f.mysql_restaurant_id != null ? Number(f.mysql_restaurant_id) : null,
        category_id: f.mysql_category_id != null ? Number(f.mysql_category_id) : null,
        // The app reads image_full_url for the wishlist card image.
        image_full_url: storageFullUrl('product', (f.image as string | null | undefined) ?? null),
      })),
      restaurant: restaurants.map((r) => ({
        id: Number(r.mysql_id),
        name: r.name ?? null,
        logo: r.logo ?? null,
        logo_full_url: storageFullUrl('restaurant', r.logo ?? null),
        address: r.address ?? null,
        avg_rating: r.avg_rating ?? 0,
      })),
    };
  }

  @HttpCode(200)
  @Post('wish-list/add')
  async wishAdd(@Req() req: AuthedRequest, @Body() body: { food_id?: number; restaurant_id?: number }) {
    const userId = Number(req.actor!.id);
    if (!body.food_id && !body.restaurant_id) {
      return { message: 'food_id or restaurant_id required' };
    }
    const filter: Record<string, unknown> = { user_id: userId };
    if (body.food_id) filter.food_id = Number(body.food_id);
    if (body.restaurant_id) filter.restaurant_id = Number(body.restaurant_id);
    const existing = await this.mongo.findOne<{ mysql_id: number }>('wishlists', filter);
    if (existing) return { message: 'already in wishlist' };
    const id = await this.mongo.nextMysqlId('wishlists');
    await this.mongo.insertOne('wishlists', {
      mysql_id: id,
      user_id: userId,
      food_id: body.food_id ? Number(body.food_id) : null,
      restaurant_id: body.restaurant_id ? Number(body.restaurant_id) : null,
      created_at: new Date(),
    });
    return { message: 'successfully added!' };
  }

  @HttpCode(200)
  @Delete('wish-list/remove')
  async wishRemove(@Req() req: AuthedRequest, @Query('food_id') foodId?: string, @Query('restaurant_id') restaurantId?: string) {
    const userId = Number(req.actor!.id);
    const filter: Record<string, unknown> = { user_id: userId };
    if (foodId) filter.food_id = Number(foodId);
    if (restaurantId) filter.restaurant_id = Number(restaurantId);
    if (!('food_id' in filter) && !('restaurant_id' in filter)) {
      return { message: 'nothing to remove' };
    }
    await this.mongo.deleteMany('wishlists', filter);
    return { message: 'successfully removed!' };
  }

  @HttpCode(200)
  @Delete('wish-list/clear-all')
  async wishClear(@Req() req: AuthedRequest) {
    await this.mongo.deleteMany('wishlists', { user_id: Number(req.actor!.id) });
    return { message: 'cleared' };
  }

  // ── Notifications (in-app inbox) ──────────────────────────────────
  @Get('notifications')
  async notifications() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoNotificationDoc>(
        'notifications',
        { status: true },
        { sort: { mysql_id: -1 }, limit: 50 },
      );
      return rows.map((r) => ({
        id: Number(r.mysql_id),
        title: r.title ?? null,
        description: r.description ?? null,
        image: r.image ?? null,
        created_at: r.created_at ?? null,
      }));
    }
    const rows = await this.prisma.notifications.findMany({
      where: { status: true },
      orderBy: { id: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: Number(r.id),
      title: r.title,
      description: r.description,
      image: r.image,
      created_at: r.created_at,
    }));
  }

  // ── FCM token (no-op for demo) ────────────────────────────────────
  @HttpCode(200)
  @Post('cm-firebase-token')
  fcmToken() {
    return { message: 'token-updated' };
  }

  // ── Zone update (no-op return ok) ─────────────────────────────────
  @Get('update-zone')
  updateZoneGet() {
    return { ok: true };
  }

  @HttpCode(200)
  @Post('update-zone')
  updateZonePost() {
    return { ok: true };
  }

  // ── Profile update ────────────────────────────────────────────────
  // Flutter customer app posts this as multipart/form-data (since it can
  // include a profile picture upload). Without FileInterceptor the body
  // arrives as `undefined` and any field access throws — that was the
  // production 500: "Cannot read properties of undefined (reading 'f_name')".
  //
  // FileInterceptor parses the multipart body, populates @UploadedFile()
  // with the optional `image` file part, and exposes the remaining text
  // fields via @Body(). JSON-encoded requests also work — multer simply
  // doesn't touch them.
  @HttpCode(200)
  @Post('update-profile')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async updateProfile(
    @Req() req: AuthedRequest,
    @UploadedFile() image: MulterFile | undefined,
    @Body() body: { f_name?: string; l_name?: string; email?: string; phone?: string; image?: string } | undefined,
  ) {
    // Multipart with no fields and no file → empty body but never undefined
    // for the JSON path; guard anyway so the call never throws on the
    // happy path of a no-op submit.
    const fields = body ?? {};
    const data: Record<string, unknown> = {};
    if (fields.f_name !== undefined) data.f_name = fields.f_name;
    if (fields.l_name !== undefined) data.l_name = fields.l_name;
    if (fields.email !== undefined) data.email = fields.email;
    if (fields.phone !== undefined) data.phone = fields.phone;

    if (image && image.buffer && image.buffer.length > 0) {
      const ext = (path.extname(image.originalname) || '.jpg').toLowerCase();
      if (!/^\.(png|jpe?g|webp|gif)$/i.test(ext)) {
        return { errors: [{ code: 'ext', message: 'only png/jpg/jpeg/webp/gif allowed' }] };
      }
      const dir = path.join(STORAGE_ROOT, 'profile');
      try {
        fs.mkdirSync(dir, { recursive: true });
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        fs.writeFileSync(path.join(dir, filename), image.buffer);
        data.image = filename;
      } catch (e) {
        // On read-only filesystems (e.g. Render free tier) the write
        // fails — surface a friendly message instead of a 500. Other
        // fields still get saved.
        const msg = (e as Error).message || 'image write failed';
        if (Object.keys(data).length === 0) {
          return { errors: [{ code: 'image', message: msg }] };
        }
      }
    } else if (typeof fields.image === 'string' && fields.image.length > 0) {
      // Caller sent an already-uploaded filename — record it verbatim.
      data.image = fields.image;
    }

    if (this.useMongo()) {
      if (Object.keys(data).length) {
        await this.mongo.updateOne('users', { mysql_id: Number(req.actor!.id) }, data);
      }
      return { message: 'Profile updated successfully', image: data.image ?? null };
    }

    if (Object.keys(data).length) {
      await this.prisma.users.update({ where: { id: req.actor!.id }, data });
    }
    return { message: 'Profile updated successfully', image: data.image ?? null };
  }

  // ── Wallet ────────────────────────────────────────────────────────
  /** Current wallet balance (computed/stored in the `wallets` collection). */
  private async walletBalance(userId: number): Promise<number> {
    const w = await this.mongo.findOne<{ balance?: number }>('wallets', { mysql_user_id: userId });
    return Number(w?.balance ?? 0);
  }
  private async setWalletBalance(userId: number, balance: number) {
    const w = await this.mongo.findOne<{ mysql_id: number }>('wallets', { mysql_user_id: userId });
    if (w) await this.mongo.updateOne('wallets', { mysql_user_id: userId }, { balance, updated_at: new Date() });
    else {
      const id = await this.mongo.nextMysqlId('wallets');
      await this.mongo.insertOne('wallets', { mysql_id: id, mysql_user_id: userId, balance, created_at: new Date(), updated_at: new Date() });
    }
  }

  @Get('wallet/transactions')
  async walletTx(@Req() req: AuthedRequest, @Query('limit') limitStr?: string, @Query('offset') offsetStr?: string) {
    const limit = parseInt(limitStr ?? '25', 10);
    const offset = parseInt(offsetStr ?? '1', 10);
    if (!this.useMongo()) return { data: [], total_size: 0, limit, offset };
    const userId = Number(req.actor!.id);
    const filter = { mysql_user_id: userId };
    const [rows, total] = await Promise.all([
      this.mongo.findMany<Record<string, unknown>>('wallet_transactions', filter, { sort: { mysql_id: -1 }, limit, skip: Math.max(0, (offset - 1) * limit) }),
      this.mongo.count('wallet_transactions', filter),
    ]);
    return {
      data: rows.map((r) => ({
        id: Number(r.mysql_id), credit: Number(r.credit ?? 0), debit: Number(r.debit ?? 0),
        balance: Number(r.balance ?? 0), transaction_type: r.transaction_type ?? null,
        reference: r.reference ?? null, created_at: r.created_at ?? null,
      })),
      total_size: total, limit, offset,
      balance: await this.walletBalance(userId),
    };
  }

  @Get('wallet/bonuses')
  async walletBonuses() {
    if (!this.useMongo()) return [];
    const rows = await this.mongo.findMany<Record<string, unknown>>('wallet_bonuses', { $or: [{ status: true }, { status: 1 }] }, { sort: { mysql_id: -1 } });
    return rows.map((r) => ({ ...r, id: Number(r.mysql_id) }));
  }

  /** Add money to the wallet. No real payment gateway is wired, so the charge
   *  is mocked as successful and the wallet is credited immediately. */
  @HttpCode(200)
  @Post('wallet/add-fund')
  async addFund(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (!this.useMongo()) return { message: 'Not available in demo' };
    const userId = Number(req.actor!.id);
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return { errors: [{ code: 'amount', message: 'Enter a valid amount' }] };
    const newBalance = (await this.walletBalance(userId)) + amount;
    await this.setWalletBalance(userId, newBalance);
    const txId = await this.mongo.nextMysqlId('wallet_transactions');
    await this.mongo.insertOne('wallet_transactions', {
      mysql_id: txId, mysql_user_id: userId, credit: amount, debit: 0, balance: newBalance,
      transaction_type: 'add_fund', reference: String(body.payment_method ?? 'payment'), created_at: new Date(),
    });
    return { message: 'Fund added to wallet', balance: newBalance };
  }

  // ── Loyalty ───────────────────────────────────────────────────────
  @Get('loyalty-point/transactions')
  async loyaltyTx(@Req() req: AuthedRequest, @Query('limit') limitStr?: string, @Query('offset') offsetStr?: string) {
    const limit = parseInt(limitStr ?? '25', 10);
    const offset = parseInt(offsetStr ?? '1', 10);
    if (!this.useMongo()) return { data: [], total_size: 0, limit, offset };
    const userId = Number(req.actor!.id);
    const filter = { mysql_user_id: userId };
    const [rows, total] = await Promise.all([
      this.mongo.findMany<Record<string, unknown>>('loyalty_point_transactions', filter, { sort: { mysql_id: -1 }, limit, skip: Math.max(0, (offset - 1) * limit) }),
      this.mongo.count('loyalty_point_transactions', filter),
    ]);
    return {
      data: rows.map((r) => ({
        id: Number(r.mysql_id), credit: Number(r.credit ?? 0), debit: Number(r.debit ?? 0),
        balance: Number(r.balance ?? 0), transaction_type: r.transaction_type ?? null, created_at: r.created_at ?? null,
      })),
      total_size: total, limit, offset,
    };
  }

  /** Convert loyalty points to wallet money (1 point = ₹1 by default). */
  @HttpCode(200)
  @Post('loyalty-point/point-transfer')
  async pointTransfer(@Req() req: AuthedRequest, @Body() body: Record<string, unknown> = {}) {
    if (!this.useMongo()) return { message: 'Not available in demo' };
    const userId = Number(req.actor!.id);
    const points = Number(body.point ?? body.points ?? 0);
    if (!Number.isFinite(points) || points <= 0) return { errors: [{ code: 'point', message: 'Enter a valid point amount' }] };
    // Current loyalty balance = latest transaction balance.
    const last = await this.mongo.findMany<{ balance?: number }>('loyalty_point_transactions', { mysql_user_id: userId }, { sort: { mysql_id: -1 }, limit: 1 });
    const loyaltyBalance = Number(last[0]?.balance ?? 0);
    if (points > loyaltyBalance) return { errors: [{ code: 'point', message: 'Not enough loyalty points' }] };
    const now = new Date();
    // Debit loyalty points.
    const lpId = await this.mongo.nextMysqlId('loyalty_point_transactions');
    await this.mongo.insertOne('loyalty_point_transactions', {
      mysql_id: lpId, mysql_user_id: userId, credit: 0, debit: points, balance: loyaltyBalance - points,
      transaction_type: 'point_to_wallet', transaction_id: `LP${lpId}`, created_at: now,
    });
    // Credit wallet (1:1).
    const newBalance = (await this.walletBalance(userId)) + points;
    await this.setWalletBalance(userId, newBalance);
    const wtId = await this.mongo.nextMysqlId('wallet_transactions');
    await this.mongo.insertOne('wallet_transactions', {
      mysql_id: wtId, mysql_user_id: userId, credit: points, debit: 0, balance: newBalance,
      transaction_type: 'loyalty_point', reference: 'point_transfer', created_at: now,
    });
    return { message: 'Points transferred to wallet', wallet_balance: newBalance, loyalty_balance: loyaltyBalance - points };
  }

  // ── Messages ──────────────────────────────────────────────────────
  // Backed by the `conversations` + `messages` Mongo collections.
  // Each conversation row stores participant identities (user/restaurant/dm)
  // and a last-message snapshot so the list view doesn't need a second join.
  @Get('message/list')
  async messageList(@Req() req: AuthedRequest, @Query('type') type?: string) {
    const userId = Number(req.actor!.id);
    const filter: Record<string, unknown> = { user_id: userId };
    if (type === 'restaurant' || type === 'delivery_man') filter.counterpart_type = type;
    const rows = await this.mongo.findMany<{
      mysql_id: number; user_id: number; counterpart_type: string;
      counterpart_id: number; counterpart_name?: string | null;
      counterpart_avatar?: string | null; last_message?: string | null;
      last_message_at?: Date | string | null; unread?: number;
    }>('conversations', filter, { sort: { last_message_at: -1 }, limit: 50 });
    return {
      conversations: rows.map((c) => ({
        id: Number(c.mysql_id),
        type: c.counterpart_type,
        counterpart_id: Number(c.counterpart_id),
        name: c.counterpart_name ?? `${c.counterpart_type} #${c.counterpart_id}`,
        avatar: c.counterpart_avatar ?? null,
        last_message: c.last_message ?? null,
        last_message_at: c.last_message_at ?? null,
        unread: c.unread ?? 0,
      })),
      total_size: rows.length,
    };
  }

  @Get('message/details')
  async messageDetails(@Req() req: AuthedRequest, @Query('conversation_id') convId?: string) {
    if (!convId) return { messages: [] };
    const rows = await this.mongo.findMany<{
      mysql_id: number; conversation_id: number; sender_type: string;
      sender_id: number; body: string; created_at?: Date | string | null;
    }>('messages', { conversation_id: Number(convId) }, { sort: { mysql_id: 1 }, limit: 100 });
    return {
      messages: rows.map((m) => ({
        id: Number(m.mysql_id),
        sender_type: m.sender_type,
        sender_id: Number(m.sender_id),
        body: m.body,
        sent_by_me: m.sender_type === 'user' && Number(m.sender_id) === Number(req.actor!.id),
        created_at: m.created_at ?? null,
      })),
    };
  }

  @Get('message/get')
  async messageGet(@Req() req: AuthedRequest, @Query('conversation_id') convId?: string) {
    const d = await this.messageDetails(req, convId);
    return { messages: d.messages, total_size: d.messages.length };
  }

  @Get('message/search-list')
  async messageSearch(@Req() req: AuthedRequest, @Query('search') q?: string) {
    if (!q || !q.trim()) return { conversations: [] };
    const userId = Number(req.actor!.id);
    const rows = await this.mongo.findMany<{
      mysql_id: number; counterpart_type: string; counterpart_id: number;
      counterpart_name?: string | null;
    }>('conversations', {
      user_id: userId,
      counterpart_name: { $regex: q, $options: 'i' },
    }, { limit: 25 });
    return { conversations: rows.map((c) => ({ id: Number(c.mysql_id), name: c.counterpart_name, type: c.counterpart_type })) };
  }

  @HttpCode(200)
  @Post('message/send')
  async messageSend(@Req() req: AuthedRequest, @Body() body: { conversation_id?: number; counterpart_type?: string; counterpart_id?: number; body?: string }) {
    const userId = Number(req.actor!.id);
    if (!body.body || !body.body.trim()) {
      return { message: 'message body required' };
    }
    let convId = body.conversation_id;
    if (!convId && body.counterpart_type && body.counterpart_id) {
      // Find-or-create a conversation row for the (user, counterpart) pair.
      const existing = await this.mongo.findOne<{ mysql_id: number }>('conversations', {
        user_id: userId,
        counterpart_type: body.counterpart_type,
        counterpart_id: Number(body.counterpart_id),
      });
      if (existing) {
        convId = Number(existing.mysql_id);
      } else {
        convId = await this.mongo.nextMysqlId('conversations');
        await this.mongo.insertOne('conversations', {
          mysql_id: convId,
          user_id: userId,
          counterpart_type: body.counterpart_type,
          counterpart_id: Number(body.counterpart_id),
          counterpart_name: null,
          last_message: body.body,
          last_message_at: new Date(),
          unread: 0,
        });
      }
    }
    if (!convId) return { message: 'conversation_id or counterpart required' };
    const msgId = await this.mongo.nextMysqlId('messages');
    await this.mongo.insertOne('messages', {
      mysql_id: msgId,
      conversation_id: convId,
      sender_type: 'user',
      sender_id: userId,
      body: body.body,
      created_at: new Date(),
    });
    await this.mongo.updateOne('conversations', { mysql_id: convId }, {
      last_message: body.body,
      last_message_at: new Date(),
    });
    return { message: 'sent', conversation_id: convId, id: msgId };
  }

  // ── Subscription / interest ───────────────────────────────────────
  // Reads from the `subscriptions` collection keyed on user_id. The admin
  // already shows this data at /dashboard/subscription-orders — same source.
  @Get('subscription')
  async subscription(@Req() req: AuthedRequest) {
    const userId = Number(req.actor!.id);
    const rows = await this.mongo.findMany<{
      mysql_id: number; user_id?: number; mysql_user_id?: number;
      restaurant_id?: number | null; mysql_restaurant_id?: number | null;
      plan_name?: string | null; frequency?: string | null;
      status?: string | null; created_at?: Date | string | null;
    }>('subscriptions', {
      $or: [{ user_id: userId }, { mysql_user_id: userId }],
    }, { sort: { mysql_id: -1 }, limit: 50 });
    return {
      data: rows.map((s) => ({
        id: Number(s.mysql_id),
        restaurant_id: s.restaurant_id ?? s.mysql_restaurant_id ?? null,
        plan_name: s.plan_name ?? null,
        frequency: s.frequency ?? null,
        status: s.status ?? 'active',
        created_at: s.created_at ?? null,
      })),
    };
  }

  @HttpCode(200)
  @Post('update-interest')
  updateInterest() {
    return { ok: true };
  }

  // ── Suggested foods / order-again ─────────────────────────────────
  @Get('suggested-foods')
  async suggestedFoods() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoFoodDoc>(
        'foods',
        { status: true },
        { sort: { avg_rating: -1 }, limit: 10 },
      );
      return {
        products: rows.map((r) => ({
          ...(r.legacy ?? {}),
          ...r,
          id: Number(r.mysql_id),
          price: toNum(r.price),
          discount: toNum(r.discount),
          tax: toNum(r.tax),
          restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : null,
          category_id: r.mysql_category_id !== null && r.mysql_category_id !== undefined ? Number(r.mysql_category_id) : null,
        })),
      };
    }
    const rows = await this.prisma.food.findMany({
      where: { status: true },
      orderBy: { avg_rating: 'desc' },
      take: 10,
    });
    return { products: rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), discount: Number(r.discount), tax: Number(r.tax), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null })) };
  }

  @Get('order-again')
  orderAgain() {
    return [];
  }

  // ── Order extras ──────────────────────────────────────────────────
  @Get('order/running-orders')
  async runningOrders(@Req() req: AuthedRequest) {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoOrderDoc>(
        'orders',
        {
          mysql_user_id: Number(req.actor!.id),
          order_status: { $in: ['pending', 'confirmed', 'accepted', 'processing', 'handover', 'picked_up'] },
        },
        { sort: { mysql_id: -1 }, limit: 25 },
      );
      // Bulk-count items per order so the list shows "N items" instead
      // of "0 Item". Uses embedded `items` array if present (placed via
      // /order/place writes it), else falls back to order_details count.
      const orderIds = rows.map((r) => Number(r.mysql_id));
      const countRows = orderIds.length
        ? await this.mongo.aggregate<{ _id: number; count: number }>(
            'order_details',
            [
              { $match: { order_id: { $in: orderIds } } },
              { $group: { _id: '$order_id', count: { $sum: 1 } } },
            ],
          )
        : [];
      const countMap = new Map(countRows.map((c) => [Number(c._id), c.count]));
      return rows.map((r) => {
        const itemsField = (r as unknown as { items?: unknown[] }).items;
        const embedded = Array.isArray(itemsField) ? itemsField.length : 0;
        const detailsCount = embedded || countMap.get(Number(r.mysql_id)) || 1;
        return {
          ...(r.legacy ?? {}),
          ...r,
          id: Number(r.mysql_id),
          user_id: r.mysql_user_id !== null && r.mysql_user_id !== undefined ? Number(r.mysql_user_id) : null,
          restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
          order_amount: toNum(r.order_amount),
          details_count: detailsCount,
        };
      });
    }
    const rows = await this.prisma.orders.findMany({
      where: {
        user_id: req.actor!.id,
        order_status: { in: ['pending', 'confirmed', 'accepted', 'processing', 'handover', 'picked_up'] },
      },
      orderBy: { id: 'desc' },
      take: 25,
    });
    return rows.map((r) => ({ ...r, id: Number(r.id), user_id: r.user_id ? Number(r.user_id) : null, restaurant_id: Number(r.restaurant_id), order_amount: Number(r.order_amount) }));
  }

  @Get('order/order-subscription-list')
  async orderSubscriptionList(@Req() req: AuthedRequest) {
    const userId = Number(req.actor!.id);
    // Orders flagged as subscription_id != null OR linked via the
    // subscriptions collection. Either gives the user a "running plan" view.
    const orderRows = await this.mongo.findMany<{
      mysql_id: number; mysql_user_id?: number; mysql_restaurant_id?: number | null;
      order_status?: string; order_amount?: number; subscription_id?: number | null;
      schedule_at?: Date | string | null; created_at_legacy?: Date | string | null;
    }>('orders', { mysql_user_id: userId, subscription_id: { $ne: null } }, {
      sort: { mysql_id: -1 }, limit: 25,
    });
    return {
      data: orderRows.map((o) => ({
        id: Number(o.mysql_id),
        restaurant_id: o.mysql_restaurant_id ?? null,
        subscription_id: o.subscription_id ?? null,
        order_status: o.order_status ?? 'pending',
        order_amount: toNum(o.order_amount),
        schedule_at: o.schedule_at ?? null,
        created_at: o.created_at_legacy ?? null,
      })),
      total_size: orderRows.length,
      limit: 25,
      offset: 1,
    };
  }

  @Get('order/details')
  async orderDetails(@Req() req: AuthedRequest, @Query('order_id', ParseIntPipe) orderId: number) {
    // Flutter customer app expects each line item to carry inline restaurant
    // + delivery_address + customer info so its order detail screen can
    // render restaurant name, delivery address and customer name without
    // additional round-trips. Without this, the screen shows "Name: null"
    // and "No restaurant data found".
    const order = await this.mongo.findByMysqlId<{
      mysql_id: number; mysql_user_id?: number | null; mysql_restaurant_id?: number | null;
      mysql_delivery_man_id?: number | null; delivery_address?: string | null;
      delivery_address_legacy?: string | Record<string, unknown> | null;
    }>('orders', Number(orderId));
    const [user, restaurant, deliveryMan, items] = await Promise.all([
      order?.mysql_user_id != null
        ? this.mongo.findByMysqlId<{ mysql_id: number; f_name?: string; l_name?: string; phone?: string; email?: string; image?: string }>('users', Number(order.mysql_user_id))
        : Promise.resolve(null),
      order?.mysql_restaurant_id != null
        ? this.mongo.findByMysqlId<{ mysql_id: number; name?: string; phone?: string; email?: string; address?: string; logo?: string; latitude?: number; longitude?: number }>('restaurants', Number(order.mysql_restaurant_id))
        : Promise.resolve(null),
      order?.mysql_delivery_man_id != null
        ? this.mongo.findByMysqlId<{ mysql_id: number; f_name?: string; l_name?: string; phone?: string }>('delivery_men', Number(order.mysql_delivery_man_id))
        : Promise.resolve(null),
      // The seed uses `order_id` but migration data may use `mysql_order_id`.
      // Accept either field — whichever the collection happens to carry.
      this.mongo.findMany<MongoOrderDetailDoc>('order_details', {
        $or: [{ order_id: Number(orderId) }, { mysql_order_id: Number(orderId) }],
      }),
    ]);

    const customerName = user ? [user.f_name, user.l_name].filter(Boolean).join(' ').trim() || null : null;
    const restaurantPayload = restaurant ? {
      id: Number(restaurant.mysql_id),
      name: restaurant.name ?? null,
      phone: restaurant.phone ?? null,
      email: restaurant.email ?? null,
      address: restaurant.address ?? null,
      logo: restaurant.logo ?? null,
      latitude: restaurant.latitude ?? null,
      longitude: restaurant.longitude ?? null,
    } : null;
    const dmPayload = deliveryMan ? {
      id: Number(deliveryMan.mysql_id),
      f_name: deliveryMan.f_name ?? null,
      l_name: deliveryMan.l_name ?? null,
      phone: deliveryMan.phone ?? null,
    } : null;

    return items.map((it) => ({
      ...(it.legacy ?? {}),
      ...it,
      id: Number(it.mysql_id),
      food_id: it.mysql_food_id != null ? Number(it.mysql_food_id) : null,
      order_id: it.mysql_order_id != null ? Number(it.mysql_order_id) : null,
      price: toNum(it.price),
      tax_amount: toNum(it.tax_amount),
      total_add_on_price: toNum(it.total_add_on_price),
      item_campaign_id: it.mysql_item_campaign_id != null ? Number(it.mysql_item_campaign_id) : null,
      discount_on_food: it.discount_on_food != null ? toNum(it.discount_on_food) : null,
      // Inline join — every line carries the trio of contextual identities
      // so the Flutter detail screen's various widgets each find what they
      // need on the first row they look at.
      customer_name: customerName,
      customer_phone: user?.phone ?? null,
      customer_email: user?.email ?? null,
      delivery_address: order?.delivery_address ?? null,
      restaurant: restaurantPayload,
      delivery_man: dmPayload,
    }));
  }

  @HttpCode(200)
  @Post('order/cancel')
  async cancelOrder(@Req() req: AuthedRequest, @Body() body: { order_id?: number; _method?: string; reason?: string }) {
    const id = body.order_id;
    if (!id) return { message: 'order_id required' };

    if (this.useMongo()) {
      const order = await this.mongo.findOne<MongoOrderDoc>('orders', {
        mysql_id: Number(id),
        mysql_user_id: Number(req.actor!.id),
      });
      if (!order) return { message: 'order not found' };
      await this.mongo.updateOne(
        'orders',
        { mysql_id: order.mysql_id },
        {
          order_status: 'canceled',
          canceled: new Date(),
          canceled_by: 'customer',
          cancellation_reason: body.reason ?? null,
        },
      );
      return { message: 'Order canceled' };
    }

    const order = await this.prisma.orders.findFirst({ where: { id: BigInt(id), user_id: req.actor!.id } });
    if (!order) return { message: 'order not found' };
    await this.prisma.orders.update({
      where: { id: order.id },
      data: {
        order_status: 'canceled',
        canceled: new Date(),
        canceled_by: 'customer',
        cancellation_reason: body.reason ?? null,
      },
    });
    return { message: 'Order canceled' };
  }

  @HttpCode(200)
  @Post('order/payment-method')
  switchPaymentMethod() {
    return { message: 'Payment method updated' };
  }

  @Get('order/refund-reasons')
  async refundReasons() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoRefundReasonDoc>('refund_reasons', { status: true });
      return rows.map((r) => ({ id: Number(r.mysql_id), reason: r.reason ?? null }));
    }
    const rows = await this.prisma.refund_reasons.findMany({ where: { status: true } });
    return rows.map((r) => ({ id: Number(r.id), reason: r.reason }));
  }

  @HttpCode(200)
  @Post('order/refund-request')
  async refundRequest(
    @Req() req: AuthedRequest,
    @Body() body: { order_id?: number; customer_reason?: string; customer_note?: string },
  ) {
    if (!body.order_id) return { message: 'order_id required' };

    if (this.useMongo()) {
      const order = await this.mongo.findOne<MongoOrderDoc>('orders', {
        mysql_id: Number(body.order_id),
        mysql_user_id: Number(req.actor!.id),
      });
      if (!order) return { message: 'order not found' };
      const nextId = await this.mongo.nextMysqlId('refunds');
      const now = new Date();
      await this.mongo.insertOne('refunds', {
        mysql_id: nextId,
        mysql_order_id: order.mysql_id,
        mysql_user_id: Number(req.actor!.id),
        order_status: order.order_status ?? null,
        customer_reason: body.customer_reason ?? null,
        customer_note: body.customer_note ?? null,
        refund_amount: toNum(order.order_amount),
        refund_status: 'pending',
        refund_method: 'wallet',
        created_at: now,
        updated_at: now,
      });
      return { message: 'Refund request submitted' };
    }

    const order = await this.prisma.orders.findFirst({ where: { id: BigInt(body.order_id), user_id: req.actor!.id } });
    if (!order) return { message: 'order not found' };
    await this.prisma.refunds.create({
      data: {
        order_id: order.id,
        user_id: req.actor!.id,
        order_status: order.order_status,
        customer_reason: body.customer_reason ?? null,
        customer_note: body.customer_note ?? null,
        refund_amount: order.order_amount,
        refund_status: 'pending',
        refund_method: 'wallet',
      },
    });
    return { message: 'Refund request submitted' };
  }

  @HttpCode(200)
  @Post('order/get-Tax')
  getOrderTax() {
    return { total_tax_amount: 0, tax_amount: 0 };
  }

  @HttpCode(200)
  @Post('order/send-notification')
  sendNotification() {
    return { ok: true };
  }

  /** Flutter customer app calls this with GET + the order ID in the path
   *  (e.g. /order/send-notification/293) right after placing an order to
   *  fire the FCM push pipeline. Accept it as a no-op ack so the app
   *  doesn't crash on a 404 — actual push delivery lives in the order
   *  service hooks. */
  @Get('order/send-notification/:id')
  sendNotificationById() {
    return { ok: true };
  }

  @HttpCode(200)
  @Post('order/check-restaurant-validation')
  checkRestaurantValidation() {
    return { message: 'valid' };
  }

  @HttpCode(200)
  @Post('order/offline-payment')
  offlinePayment() {
    return { message: 'recorded' };
  }

  @HttpCode(200)
  @Post('order/offline-payment-update')
  offlinePaymentUpdate() {
    return { message: 'recorded' };
  }

  // ── Food list (for cart re-validation etc) ────────────────────────
  @Get('food-list')
  async foodList(@Query('ids') idsStr?: string) {
    const ids = (idsStr ?? '').split(',').map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
    if (!ids.length) return [];

    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoFoodDoc>('foods', { mysql_id: { $in: ids } });
      return rows.map((r) => ({
        ...(r.legacy ?? {}),
        ...r,
        id: Number(r.mysql_id),
        price: toNum(r.price),
        tax: toNum(r.tax),
        discount: toNum(r.discount),
        restaurant_id: r.mysql_restaurant_id !== null && r.mysql_restaurant_id !== undefined ? Number(r.mysql_restaurant_id) : 0,
        category_id: r.mysql_category_id !== null && r.mysql_category_id !== undefined ? Number(r.mysql_category_id) : null,
      }));
    }

    const rows = await this.prisma.food.findMany({ where: { id: { in: ids.map((n) => BigInt(n)) } } });
    return rows.map((r) => ({ ...r, id: Number(r.id), price: Number(r.price), tax: Number(r.tax), discount: Number(r.discount), restaurant_id: Number(r.restaurant_id), category_id: r.category_id ? Number(r.category_id) : null }));
  }

  @HttpCode(200)
  @Post('cart/add-multiple')
  cartAddMultiple() {
    return { message: 'added' };
  }

  // ── Address extras ────────────────────────────────────────────────
  @HttpCode(200)
  @Delete('address/delete')
  async deleteAddress(
    @Req() req: AuthedRequest,
    @Query('address_id', ParseIntPipe) addressId: number,
  ) {
    if (this.useMongo()) {
      // Match either the new `mysql_user_id` convention or legacy `user_id`.
      const doc = await this.mongo.findOne<MongoAddressDoc>('customer_addresses', { mysql_id: Number(addressId) });
      if (doc) {
        const ownerId = (doc.mysql_user_id ?? doc.user_id ?? null);
        if (ownerId !== null && Number(ownerId) === Number(req.actor!.id)) {
          await this.mongo.deleteOne('customer_addresses', { mysql_id: Number(addressId) });
        }
      }
      return { message: 'Address deleted' };
    }
    await this.prisma.customer_addresses.deleteMany({
      where: { id: BigInt(addressId), user_id: req.actor!.id },
    });
    return { message: 'Address deleted' };
  }

  @HttpCode(200)
  @Post('address/update/:id')
  async updateAddress(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthedRequest,
    @Body() body: { address?: string; contact_person_name?: string; contact_person_number?: string; address_type?: string; latitude?: string; longitude?: string },
  ) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined) data[k] = v;
    }

    if (this.useMongo()) {
      const doc = await this.mongo.findOne<MongoAddressDoc>('customer_addresses', { mysql_id: Number(id) });
      if (doc) {
        const ownerId = (doc.mysql_user_id ?? doc.user_id ?? null);
        if (ownerId !== null && Number(ownerId) === Number(req.actor!.id)) {
          await this.mongo.updateOne('customer_addresses', { mysql_id: Number(id) }, { ...data, updated_at: new Date() });
        }
      }
      return { message: 'Address updated' };
    }

    await this.prisma.customer_addresses.updateMany({
      where: { id: BigInt(id), user_id: req.actor!.id },
      data,
    });
    return { message: 'Address updated' };
  }

  @HttpCode(200)
  @Post('address/set-default')
  setDefaultAddress() {
    return { message: 'default set' };
  }

  // ── Account removal (no-op for demo) ──────────────────────────────
  @HttpCode(200)
  @Delete('remove-account')
  removeAccount() {
    return { message: 'Not available in demo' };
  }
}
