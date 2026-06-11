"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slotForType = slotForType;
exports.typeForSlot = typeForSlot;
exports.resolveParticipant = resolveParticipant;
exports.findOrCreateConversation = findOrCreateConversation;
exports.participantProfile = participantProfile;
function slotForType(type) {
    const t = String(type ?? '').toLowerCase();
    if (t === 'user' || t === 'customer')
        return 'user_id';
    if (t === 'vendor' || t === 'restaurant')
        return 'vendor_id';
    if (t === 'delivery_man' || t === 'deliveryman' || t === 'delivery-man')
        return 'delivery_man_id';
    return null;
}
function typeForSlot(slot) {
    return slot === 'user_id' ? 'user' : slot === 'vendor_id' ? 'vendor' : 'delivery_man';
}
async function resolveParticipant(mongo, type, id) {
    const slot = slotForType(type);
    if (!slot || !id)
        return null;
    if (slot === 'vendor_id') {
        const rest = await mongo.findOne('restaurants', { $or: [{ mysql_id: id }, { mysql_vendor_id: id }] });
        return { slot, id: rest?.mysql_vendor_id != null ? Number(rest.mysql_vendor_id) : id };
    }
    return { slot, id };
}
async function findOrCreateConversation(mongo, a, b, lastMessage) {
    const slots = { user_id: null, vendor_id: null, delivery_man_id: null };
    slots[a.slot] = a.id;
    slots[b.slot] = b.id;
    const existing = await mongo.findOne('conversations', {
        [a.slot]: a.id,
        [b.slot]: b.id,
    });
    if (existing)
        return Number(existing.mysql_id);
    const convId = await mongo.nextMysqlId('conversations');
    await mongo.insertOne('conversations', {
        mysql_id: convId,
        user_id: slots.user_id,
        vendor_id: slots.vendor_id,
        delivery_man_id: slots.delivery_man_id,
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
async function participantProfile(mongo, slot, id, storageFullUrl) {
    if (!id)
        return { id, f_name: 'Unknown', l_name: '', image_full_url: null };
    if (slot === 'user_id') {
        const u = await mongo.findByMysqlId('users', id);
        return { id, f_name: u?.f_name ?? 'Customer', l_name: u?.l_name ?? '', phone: u?.phone ?? null, email: u?.email ?? null, image_full_url: storageFullUrl('profile', u?.image ?? null), user_id: id };
    }
    if (slot === 'vendor_id') {
        const r = await mongo.findOne('restaurants', { mysql_vendor_id: id });
        return { id, f_name: r?.name ?? 'Restaurant', l_name: '', phone: r?.phone ?? null, email: null, image_full_url: storageFullUrl('restaurant', r?.logo ?? null), vendor_id: id };
    }
    const dm = await mongo.findByMysqlId('delivery_men', id);
    return { id, f_name: dm?.f_name ?? 'Delivery Man', l_name: dm?.l_name ?? '', phone: dm?.phone ?? null, email: dm?.email ?? null, image_full_url: storageFullUrl('delivery-man', dm?.image ?? null), deliveryman_id: id };
}
//# sourceMappingURL=messaging.helper.js.map