import { MongoDataService } from '../mongo/mongo-data.service';

/**
 * Unified cross-app conversation model.
 *
 * A conversation is between exactly TWO of: customer (user), restaurant
 * (vendor), delivery man. We store all three participant slots on every
 * conversation doc — the two involved are set, the third is null:
 *
 *   { user_id, vendor_id, delivery_man_id, last_message, last_message_at, ... }
 *
 * Every send writes these slots (plus the legacy counterpart and party fields
 * for backward compat). Every list queries "my slot = me AND counterpart slot
 * != null", so all three apps see the same conversation. Restaurant ids are
 * normalised to the owning VENDOR id, because the vendor app authenticates as
 * the vendor — not the restaurant.
 */

export type PartySlot = 'user_id' | 'vendor_id' | 'delivery_man_id';

/** Map a wire type string to its participant slot. */
export function slotForType(type: string | null | undefined): PartySlot | null {
  const t = String(type ?? '').toLowerCase();
  if (t === 'user' || t === 'customer') return 'user_id';
  if (t === 'vendor' || t === 'restaurant') return 'vendor_id';
  if (t === 'delivery_man' || t === 'deliveryman' || t === 'delivery-man') return 'delivery_man_id';
  return null;
}

/** The wire `*_type` value the apps expect for each slot. */
export function typeForSlot(slot: PartySlot): string {
  return slot === 'user_id' ? 'user' : slot === 'vendor_id' ? 'vendor' : 'delivery_man';
}

/** Resolve a (type, id) reference to its canonical { slot, id }. A restaurant
 *  reference is converted to the owning vendor id so the vendor app matches. */
export async function resolveParticipant(
  mongo: MongoDataService,
  type: string | null | undefined,
  id: number,
): Promise<{ slot: PartySlot; id: number } | null> {
  const slot = slotForType(type);
  if (!slot || !id) return null;
  if (slot === 'vendor_id') {
    // The id might be a restaurant id OR already a vendor id — normalise to vendor.
    const rest = await mongo.findOne<{ mysql_id: number; mysql_vendor_id?: number }>(
      'restaurants',
      { $or: [{ mysql_id: id }, { mysql_vendor_id: id }] },
    );
    return { slot, id: rest?.mysql_vendor_id != null ? Number(rest.mysql_vendor_id) : id };
  }
  return { slot, id };
}

/** Find (or create) the unique conversation between two participants. */
export async function findOrCreateConversation(
  mongo: MongoDataService,
  a: { slot: PartySlot; id: number },
  b: { slot: PartySlot; id: number },
  lastMessage: string,
): Promise<number> {
  const slots: Record<PartySlot, number | null> = { user_id: null, vendor_id: null, delivery_man_id: null };
  slots[a.slot] = a.id;
  slots[b.slot] = b.id;

  const existing = await mongo.findOne<{ mysql_id: number }>('conversations', {
    [a.slot]: a.id,
    [b.slot]: b.id,
  });
  if (existing) return Number(existing.mysql_id);

  const convId = await mongo.nextMysqlId('conversations');
  await mongo.insertOne('conversations', {
    mysql_id: convId,
    user_id: slots.user_id,
    vendor_id: slots.vendor_id,
    delivery_man_id: slots.delivery_man_id,
    // Legacy fields kept so any un-migrated reader still works.
    counterpart_type: typeForSlot(b.slot),
    counterpart_id: b.id,
    party_type: typeForSlot(a.slot) === 'vendor' ? 'vendor' : typeForSlot(a.slot),
    party_id: a.id,
    last_message: lastMessage,
    last_message_at: new Date(),
    unread: 0,
    created_at: new Date(),
    updated_at: new Date(),
  });
  return convId;
}

/** Lightweight display profile for a participant, by slot. */
export async function participantProfile(
  mongo: MongoDataService,
  slot: PartySlot,
  id: number,
  storageFullUrl: (folder: string, file?: string | null) => string | null,
): Promise<Record<string, unknown>> {
  if (!id) return { id, f_name: 'Unknown', l_name: '', image_full_url: null };
  if (slot === 'user_id') {
    const u = await mongo.findByMysqlId<{ mysql_id: number; f_name?: string; l_name?: string; phone?: string; email?: string; image?: string }>('users', id);
    return { id, f_name: u?.f_name ?? 'Customer', l_name: u?.l_name ?? '', phone: u?.phone ?? null, email: u?.email ?? null, image_full_url: storageFullUrl('profile', u?.image ?? null), user_id: id };
  }
  if (slot === 'vendor_id') {
    const r = await mongo.findOne<{ mysql_id: number; name?: string; logo?: string; phone?: string; mysql_vendor_id?: number }>('restaurants', { mysql_vendor_id: id });
    return { id, f_name: r?.name ?? 'Restaurant', l_name: '', phone: r?.phone ?? null, email: null, image_full_url: storageFullUrl('restaurant', r?.logo ?? null), vendor_id: id };
  }
  const dm = await mongo.findByMysqlId<{ mysql_id: number; f_name?: string; l_name?: string; phone?: string; email?: string; image?: string }>('delivery_men', id);
  return { id, f_name: dm?.f_name ?? 'Delivery Man', l_name: dm?.l_name ?? '', phone: dm?.phone ?? null, email: dm?.email ?? null, image_full_url: storageFullUrl('delivery-man', dm?.image ?? null), deliveryman_id: id };
}
