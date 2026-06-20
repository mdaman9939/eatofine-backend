"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueCreditNote = issueCreditNote;
function fyCode(dt) {
    const sy = dt.getMonth() + 1 >= 4 ? dt.getFullYear() : dt.getFullYear() - 1;
    return `${String(sy % 100).padStart(2, '0')}${String((sy + 1) % 100).padStart(2, '0')}`;
}
async function ensureInvoiceNumber(mongo, order, field, prefix, fy) {
    const existing = order[field];
    if (existing)
        return existing;
    const seq = (await mongo.count('orders', { [field]: { $regex: `^${prefix}${fy}-` } })) + 1;
    const number = `${prefix}${fy}-${String(seq).padStart(4, '0')}`;
    await mongo.updateOne('orders', { mysql_id: Number(order.mysql_id) }, { [field]: number });
    return number;
}
async function issueCreditNote(mongo, input) {
    const orderId = Number(input.orderId);
    const amount = Number(input.amount);
    if (!orderId || !(amount > 0))
        return { record: null, alreadyExisted: false };
    const dupFilter = input.refundId != null ? { refund_id: Number(input.refundId) } : { order_id: orderId };
    const existing = await mongo.findOne('credit_notes', dupFilter);
    if (existing)
        return { record: existing, alreadyExisted: true };
    const order = await mongo.findByMysqlId('orders', orderId);
    if (!order)
        return { record: null, alreadyExisted: false };
    const invDate = new Date((order.delivered ?? order.created_at_legacy ?? order.created_at) ?? new Date());
    const invFy = fyCode(invDate);
    const refObr = await ensureInvoiceNumber(mongo, order, 'customer_invoice_number', 'OBR', invFy);
    const refEtu = await ensureInvoiceNumber(mongo, order, 'eatofine_invoice_number', 'ETFU', invFy);
    const today = new Date();
    const cnFy = fyCode(today);
    const seq = (await mongo.count('credit_notes', { credit_note_number_obr: { $regex: `^CNOBR${cnFy}-` } })) + 1;
    const nnnn = String(seq).padStart(4, '0');
    const cnObr = `CNOBR${cnFy}-${nnnn}`;
    const cnEtu = `CNETU${cnFy}-${nnnn}`;
    const arn = `ARN${cnFy}${String(seq).padStart(6, '0')}`;
    const record = {
        mysql_id: await mongo.nextMysqlId('credit_notes'),
        credit_note_number: cnObr,
        credit_note_number_obr: cnObr,
        credit_note_number_etu: cnEtu,
        order_id: orderId,
        refund_id: input.refundId != null ? Number(input.refundId) : null,
        customer_id: Number(order.mysql_user_id ?? 0),
        restaurant_id: order.mysql_restaurant_id != null ? Number(order.mysql_restaurant_id) : null,
        reference_invoice_no_obr: refObr,
        reference_invoice_no_etu: refEtu,
        reference_invoice_date: invDate,
        arn,
        reason: input.reason ?? null,
        refund_amount: amount,
        tax_reversed: Number(order.total_tax_amount ?? 0),
        delivery_reversed: Number(order.delivery_charge ?? 0),
        total_credit: amount,
        status: 'issued',
        notes: input.notes ?? null,
        issued_by: input.issuedBy ?? null,
        created_at: today,
        updated_at: today,
    };
    await mongo.insertOne('credit_notes', record);
    return { record, alreadyExisted: false };
}
//# sourceMappingURL=credit-note.util.js.map