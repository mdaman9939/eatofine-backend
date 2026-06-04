"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCENARIOS = void 0;
exports.listScenarios = listScenarios;
exports.getScenario = getScenario;
exports.applicableScenarios = applicableScenarios;
const r2 = (n) => Math.round(n * 100) / 100;
function netted(net, baseNote) {
    const abs = Math.abs(net);
    if (abs < 0.01)
        return { direction: 'none', amount: 0, note: `${baseNote} (net ₹0)` };
    return {
        direction: net > 0 ? 'credit' : 'debit',
        amount: Math.round(abs * 100) / 100,
        note: `${baseNote} (net ₹${net > 0 ? '+' : '-'}${abs.toFixed(2)})`,
    };
}
exports.SCENARIOS = {
    USER_BEFORE_ACCEPT: {
        key: 'USER_BEFORE_ACCEPT',
        cancelled_by: 'user',
        label: 'User cancelled before restaurant accepted',
        allowsStage: (s) => !s.is_delivered && (s.status === 'pending' || s.status === 'failed'),
        decide: (m) => ({
            refund_amount: r2(m.grand_total),
            refund_to_user: true,
            generate_invoice: false,
            generate_credit_note: false,
            penalty: { target: null, amount: 0, components: [] },
            restaurant_wallet: { direction: 'none', amount: 0, note: 'order never accepted' },
            deliveryman_wallet: { direction: 'none', amount: 0, note: 'no DM assigned' },
            final_order_status: 'canceled',
            summary: 'Full refund to user. No invoice. No party is penalised.',
        }),
    },
    USER_AFTER_ACCEPT_NO_DM: {
        key: 'USER_AFTER_ACCEPT_NO_DM',
        cancelled_by: 'user',
        label: 'User cancelled after restaurant accepted (no DM assigned)',
        allowsStage: (s) => !s.is_delivered && (s.status === 'confirmed' || s.status === 'processing') && !s.has_delivery_man,
        decide: (m) => ({
            refund_amount: 0,
            refund_to_user: false,
            generate_invoice: true,
            generate_credit_note: false,
            penalty: { target: null, amount: 0, components: [] },
            restaurant_wallet: { direction: 'credit', amount: r2(m.item_total - m.admin_commission), note: 'Normal cycle — order accepted by restaurant before cancel' },
            deliveryman_wallet: { direction: 'none', amount: 0, note: 'no DM was assigned' },
            final_order_status: 'canceled',
            summary: 'Zero refund. Restaurant earns the item value (normal cycle). Invoice raised.',
        }),
    },
    USER_AFTER_ACCEPT_WITH_DM: {
        key: 'USER_AFTER_ACCEPT_WITH_DM',
        cancelled_by: 'user',
        label: 'User cancelled after restaurant accepted (DM already assigned)',
        allowsStage: (s) => !s.is_delivered && s.has_delivery_man && (s.status === 'confirmed' || s.status === 'processing' || s.status === 'handover'),
        decide: (m) => ({
            refund_amount: 0,
            refund_to_user: false,
            generate_invoice: true,
            generate_credit_note: false,
            penalty: { target: null, amount: 0, components: [] },
            restaurant_wallet: { direction: 'credit', amount: r2(m.item_total - m.admin_commission), note: 'Normal cycle — accepted before cancel' },
            deliveryman_wallet: { direction: 'credit', amount: r2(m.delivery_charge), note: 'Normal cycle — DM was already dispatched' },
            final_order_status: 'canceled',
            summary: 'Zero refund. Restaurant + DM both earn (normal cycle). Invoice raised.',
        }),
    },
    ADMIN_USER_UNREACHABLE: {
        key: 'ADMIN_USER_UNREACHABLE',
        cancelled_by: 'admin',
        label: 'Admin cancel — DM reached but user not contactable',
        allowsStage: (s) => !s.is_delivered && s.has_delivery_man,
        decide: (m) => ({
            refund_amount: 0,
            refund_to_user: false,
            generate_invoice: true,
            generate_credit_note: false,
            penalty: { target: null, amount: 0, components: [] },
            restaurant_wallet: { direction: 'credit', amount: r2(m.item_total - m.admin_commission), note: 'Normal cycle — restaurant fulfilled its side' },
            deliveryman_wallet: { direction: 'credit', amount: r2(m.delivery_charge), note: 'Normal cycle — DM reached delivery address' },
            final_order_status: 'canceled',
            summary: 'Zero refund. Both restaurant + DM earn since both did their job.',
        }),
    },
    ADMIN_WRONG_ITEM_RESTAURANT: {
        key: 'ADMIN_WRONG_ITEM_RESTAURANT',
        cancelled_by: 'admin',
        label: 'Admin — wrong / missing item (restaurant fault)',
        allowsStage: () => true,
        decide: (m) => {
            const refund = r2(m.item_total + m.tax);
            const restNet = r2((m.item_total - m.admin_commission) - refund);
            return {
                refund_amount: refund,
                refund_to_user: true,
                generate_invoice: true,
                generate_credit_note: true,
                penalty: { target: 'restaurant', amount: refund, components: ['Item cost', 'GST'] },
                restaurant_wallet: netted(restNet, 'Normal cycle item earnings, refund-source debited'),
                deliveryman_wallet: { direction: 'credit', amount: r2(m.delivery_charge), note: 'Normal cycle — DM delivered fine' },
                final_order_status: 'refunded',
                summary: `Partial refund (item + GST = ₹${refund}). Sourced from restaurant wallet.`,
            };
        },
    },
    ADMIN_MISSING_PACKET_DM: {
        key: 'ADMIN_MISSING_PACKET_DM',
        cancelled_by: 'admin',
        label: 'Admin — number of missing packets (DM fault)',
        allowsStage: (s) => s.has_delivery_man,
        decide: (m) => {
            const refund = r2(m.item_total + m.tax);
            const dmNet = r2(m.delivery_charge - refund);
            return {
                refund_amount: refund,
                refund_to_user: true,
                generate_invoice: true,
                generate_credit_note: true,
                penalty: { target: 'deliveryman', amount: refund, components: ['Item cost', 'GST'] },
                restaurant_wallet: { direction: 'credit', amount: r2(m.item_total - m.admin_commission), note: 'Normal cycle — restaurant prepared the order correctly' },
                deliveryman_wallet: netted(dmNet, 'Normal delivery credit minus refund-source'),
                final_order_status: 'refunded',
                summary: `Partial refund (item + GST = ₹${refund}). Sourced from DM wallet.`,
            };
        },
    },
    ADMIN_RESTAURANT_FAULT_AFTER_DELIVERY: {
        key: 'ADMIN_RESTAURANT_FAULT_AFTER_DELIVERY',
        cancelled_by: 'admin',
        label: 'Admin (after delivery) — wrong/damaged/packaging/veg-nonveg (restaurant fault)',
        allowsStage: (s) => s.is_delivered,
        decide: (m) => {
            const penaltyAmt = r2(m.additional_charge + m.packaging_amount + m.delivery_charge + m.tax);
            const restNet = r2((m.item_total - m.admin_commission) - (m.item_total + penaltyAmt));
            return {
                refund_amount: r2(m.grand_total),
                refund_to_user: true,
                generate_invoice: true,
                generate_credit_note: true,
                penalty: {
                    target: 'restaurant',
                    amount: penaltyAmt,
                    components: ['Platform charge', 'Packaging fee', 'Delivery fee', 'GST'],
                },
                restaurant_wallet: netted(restNet, `Normal cycle credit reversed + penalty ₹${penaltyAmt}`),
                deliveryman_wallet: { direction: 'credit', amount: r2(m.delivery_charge), note: 'Normal cycle — DM delivered as instructed' },
                final_order_status: 'refunded',
                summary: `Full refund to user. Restaurant debited normal credit + penalty of ₹${penaltyAmt}.`,
            };
        },
    },
    ADMIN_RESTAURANT_FAULT_BEFORE_DELIVERY: {
        key: 'ADMIN_RESTAURANT_FAULT_BEFORE_DELIVERY',
        cancelled_by: 'admin',
        label: 'Admin (before delivery) — wrong/damaged/packaging/veg-nonveg (restaurant fault)',
        allowsStage: (s) => !s.is_delivered,
        decide: (m) => {
            const penaltyAmt = r2(m.admin_commission + m.additional_charge + m.packaging_amount + m.delivery_charge + m.tax);
            return {
                refund_amount: r2(m.grand_total),
                refund_to_user: true,
                generate_invoice: false,
                generate_credit_note: false,
                penalty: {
                    target: 'restaurant',
                    amount: penaltyAmt,
                    components: ['PPO charge', 'Platform charge', 'Packaging fee', 'Delivery fee', 'GST'],
                },
                restaurant_wallet: { direction: 'debit', amount: penaltyAmt, note: `Penalty ₹${penaltyAmt} for restaurant fault before delivery` },
                deliveryman_wallet: { direction: 'credit', amount: r2(m.delivery_charge), note: 'Normal cycle — DM was already on the way' },
                final_order_status: 'canceled',
                summary: `Full refund to user. No invoice. Restaurant penalty ₹${penaltyAmt}.`,
            };
        },
    },
    ADMIN_DM_FAULT_AFTER_DELIVERY: {
        key: 'ADMIN_DM_FAULT_AFTER_DELIVERY',
        cancelled_by: 'admin',
        label: 'Admin (after delivery) — DM ran away / not delivered / damaged',
        allowsStage: (s) => s.is_delivered && s.has_delivery_man,
        decide: (m) => {
            const dmNet = r2(m.delivery_charge - m.grand_total);
            return {
                refund_amount: r2(m.grand_total),
                refund_to_user: true,
                generate_invoice: true,
                generate_credit_note: true,
                penalty: { target: 'deliveryman', amount: r2(m.grand_total), components: ['Total order cost'] },
                restaurant_wallet: { direction: 'credit', amount: r2(m.item_total - m.admin_commission), note: 'Normal cycle — restaurant fulfilled its side' },
                deliveryman_wallet: netted(dmNet, `Normal delivery credit minus total order cost ₹${r2(m.grand_total)}`),
                final_order_status: 'refunded',
                summary: `Full refund. DM debited full order cost ₹${r2(m.grand_total)}.`,
            };
        },
    },
    ADMIN_DM_FAULT_BEFORE_DELIVERY: {
        key: 'ADMIN_DM_FAULT_BEFORE_DELIVERY',
        cancelled_by: 'admin',
        label: 'Admin (before delivery) — DM ran away / not delivered / damaged',
        allowsStage: (s) => !s.is_delivered && s.has_delivery_man,
        decide: (m) => ({
            refund_amount: r2(m.grand_total),
            refund_to_user: true,
            generate_invoice: false,
            generate_credit_note: false,
            penalty: { target: 'deliveryman', amount: r2(m.grand_total), components: ['Total order cost'] },
            restaurant_wallet: { direction: 'credit', amount: r2(m.item_total - m.admin_commission), note: 'Normal cycle — restaurant prepared as ordered' },
            deliveryman_wallet: { direction: 'debit', amount: r2(m.grand_total), note: 'Penalty only — no normal-cycle credit' },
            final_order_status: 'canceled',
            summary: `Full refund. No invoice. DM penalised the entire ₹${r2(m.grand_total)} order cost.`,
        }),
    },
    RESTAURANT_REJECT_BEFORE_ACCEPT: {
        key: 'RESTAURANT_REJECT_BEFORE_ACCEPT',
        cancelled_by: 'restaurant',
        label: 'Restaurant rejected before accepting',
        allowsStage: (s) => s.status === 'pending',
        decide: (m) => ({
            refund_amount: r2(m.grand_total),
            refund_to_user: true,
            generate_invoice: false,
            generate_credit_note: false,
            penalty: { target: null, amount: 0, components: [] },
            restaurant_wallet: { direction: 'none', amount: 0, note: 'No penalty — rejected before acceptance' },
            deliveryman_wallet: { direction: 'none', amount: 0, note: 'no DM was involved' },
            final_order_status: 'canceled',
            summary: 'Full refund. No penalty. Order never entered the restaurant\'s queue.',
        }),
    },
    RESTAURANT_REJECT_AFTER_ACCEPT_NO_DM: {
        key: 'RESTAURANT_REJECT_AFTER_ACCEPT_NO_DM',
        cancelled_by: 'restaurant',
        label: 'Restaurant rejected after accepting (no DM assigned)',
        allowsStage: (s) => (s.status === 'confirmed' || s.status === 'processing') && !s.has_delivery_man,
        decide: (m) => {
            const penaltyAmt = r2(m.admin_commission + m.additional_charge + m.tax);
            return {
                refund_amount: r2(m.grand_total),
                refund_to_user: true,
                generate_invoice: false,
                generate_credit_note: false,
                penalty: {
                    target: 'restaurant',
                    amount: penaltyAmt,
                    components: ['Admin charge (PPO/Commission)', 'GST'],
                },
                restaurant_wallet: { direction: 'debit', amount: penaltyAmt, note: `Penalty ₹${penaltyAmt} for rejecting after accepting` },
                deliveryman_wallet: { direction: 'none', amount: 0, note: 'no DM was involved' },
                final_order_status: 'canceled',
                summary: `Full refund. Restaurant penalty ₹${penaltyAmt} (admin charge + GST).`,
            };
        },
    },
    RESTAURANT_REJECT_AFTER_ACCEPT_WITH_DM: {
        key: 'RESTAURANT_REJECT_AFTER_ACCEPT_WITH_DM',
        cancelled_by: 'restaurant',
        label: 'Restaurant rejected after accepting (DM already assigned)',
        allowsStage: (s) => s.has_delivery_man && !s.is_delivered && (s.status === 'confirmed' || s.status === 'processing' || s.status === 'handover'),
        decide: (m) => {
            const penaltyAmt = r2(m.admin_commission + m.additional_charge + m.delivery_charge + m.tax);
            return {
                refund_amount: r2(m.grand_total),
                refund_to_user: true,
                generate_invoice: false,
                generate_credit_note: false,
                penalty: {
                    target: 'restaurant',
                    amount: penaltyAmt,
                    components: ['Admin charge (PPO/Commission)', 'Delivery charges', 'GST'],
                },
                restaurant_wallet: { direction: 'debit', amount: penaltyAmt, note: `Penalty ₹${penaltyAmt} including DM dispatch cost` },
                deliveryman_wallet: { direction: 'credit', amount: r2(m.delivery_charge), note: 'Compensated for dispatch — restaurant pays' },
                final_order_status: 'canceled',
                summary: `Full refund. Restaurant penalty ₹${penaltyAmt}, DM credited delivery fee.`,
            };
        },
    },
};
function listScenarios() {
    return Object.values(exports.SCENARIOS).map((s) => ({ key: s.key, cancelled_by: s.cancelled_by, label: s.label }));
}
function getScenario(key) {
    return exports.SCENARIOS[key] ?? null;
}
function applicableScenarios(stage) {
    return Object.values(exports.SCENARIOS)
        .filter((s) => s.allowsStage(stage))
        .map((s) => ({ key: s.key, cancelled_by: s.cancelled_by, label: s.label }));
}
//# sourceMappingURL=refund-policy.js.map