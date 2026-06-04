import { Injectable, Logger } from '@nestjs/common';
import { MongoDataService } from './mongo-data.service';
import * as bcrypt from 'bcrypt';

export interface SeedReport {
  started_at: string;
  finished_at: string;
  duration_ms: number;
  collections: Record<string, number>;
}

/** Generates realistic Indian-context demo data across all admin collections. */
@Injectable()
export class SeedService {
  private readonly log = new Logger('Seed');

  constructor(private readonly mongo: MongoDataService) {}

  private indianFirstNames = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv',
    'Saanvi', 'Aanya', 'Aadya', 'Diya', 'Pari', 'Ananya', 'Ishita', 'Kavya', 'Riya', 'Anika',
    'Aryan', 'Karthik', 'Rahul', 'Rohan', 'Siddharth', 'Aakash', 'Nikhil', 'Pranav', 'Tanmay', 'Yash',
    'Priya', 'Neha', 'Pooja', 'Sneha', 'Divya', 'Kavita', 'Sonia', 'Meera', 'Rashmi', 'Anjali',
  ];

  private indianLastNames = [
    'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Patel', 'Shah', 'Mehta', 'Joshi', 'Reddy',
    'Iyer', 'Menon', 'Pillai', 'Nair', 'Khan', 'Ali', 'Ahmed', 'Khanna', 'Kapoor', 'Malhotra',
    'Chopra', 'Bedi', 'Bansal', 'Goel', 'Jain', 'Agrawal', 'Arora', 'Sinha', 'Mishra', 'Chaudhary',
  ];

  private restaurantNames = [
    'Spice Junction', 'Tandoor House', 'Curry Leaves', 'Biryani Express', 'Punjabi Dhaba',
    'South Spice', 'Chinese Wok', 'Pizza Paradise', 'Burger Palace', 'Coffee Cup',
    'Sweet Tooth', 'Royal Kitchen', 'Maharaja Restaurant', 'Cafe Mocha', 'Annapurna Bhojanalay',
    'Mumbai Tiffin', 'Hyderabad Biryani House', 'Bombay Street Food', 'Delhi Chaat Corner',
    'Bangalore Cafe', 'Kerala Spice Garden', 'Bengali Sweets', 'Saffron Restaurant',
    'Tandoori Nights', 'Veg Treat',
  ];

  private foodNames = [
    'Butter Chicken', 'Paneer Tikka', 'Chicken Biryani', 'Veg Biryani', 'Masala Dosa', 'Idli Sambar',
    'Tandoori Chicken', 'Dal Makhani', 'Palak Paneer', 'Aloo Paratha', 'Chole Bhature', 'Samosa',
    'Pav Bhaji', 'Vada Pav', 'Pani Puri', 'Bhel Puri', 'Veg Pulao', 'Chicken Curry', 'Fish Fry',
    'Mutton Rogan Josh', 'Veg Manchurian', 'Hakka Noodles', 'Fried Rice', 'Chow Mein', 'Spring Rolls',
    'Margherita Pizza', 'Veg Burger', 'Chicken Burger', 'French Fries', 'Pasta Alfredo',
    'Cappuccino', 'Cold Coffee', 'Mango Lassi', 'Sweet Lassi', 'Masala Chai', 'Filter Coffee',
    'Gulab Jamun', 'Rasgulla', 'Jalebi', 'Kulfi', 'Ice Cream', 'Brownie',
    'Veg Thali', 'Chicken Thali', 'South Indian Thali', 'Gujarati Thali',
    'Chicken 65', 'Mutton Pepper Fry', 'Egg Bhurji', 'Veg Sandwich', 'Grilled Sandwich',
    'Schezwan Noodles', 'Manchurian Rice', 'Veg Momos', 'Chicken Momos', 'Tandoori Momos',
    'Garlic Bread', 'Cheese Garlic Bread', 'Veg Wrap', 'Chicken Wrap', 'Falafel Wrap',
    'Hyderabadi Biryani', 'Lucknowi Biryani', 'Kolkata Biryani', 'Mughlai Biryani',
    'Paneer Butter Masala', 'Kadai Paneer', 'Shahi Paneer', 'Matar Paneer', 'Chilli Paneer',
    'Dal Tadka', 'Dal Fry', 'Yellow Dal', 'Rajma Chawal', 'Kadhi Chawal',
    'Veg Hakka Noodles', 'Triple Schezwan Rice', 'Manchurian Gravy', 'American Chopsuey',
    'Plain Naan', 'Garlic Naan', 'Butter Naan', 'Cheese Naan', 'Tandoori Roti',
  ];

  private cities = [
    { city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
    { city: 'Delhi', state: 'Delhi', lat: 28.7041, lng: 77.1025 },
    { city: 'Bangalore', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
    { city: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867 },
    { city: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
    { city: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
    { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
    { city: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
    { city: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
    { city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
  ];

  private random<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private indianPhone(): string {
    const prefixes = ['98', '97', '99', '96', '95', '90', '91', '92', '93', '94'];
    return `+91${this.random(prefixes)}${this.randomInt(10000000, 99999999)}`;
  }

  private daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  /** Main seed runner — populates all the major demo collections. */
  /** Add 60 more orders with the full status mix without touching existing
   *  data. Useful for topping up demo dashboards that have stale 0-counts
   *  for refunded / payment_failed / cooking / picked_up / scheduled. */
  async topUpOrders(count = 60): Promise<{ orders: number; details: number }> {
    return this.seedOrders(count);
  }

  async seedAll(): Promise<SeedReport> {
    const started = new Date();
    const collections: Record<string, number> = {};

    // Common bcrypt password "12345678" (matches existing demo logins).
    const demoPasswordHash = (await bcrypt.hash('12345678', 10)).replace(/^\$2b\$/, '$2y$');

    // 1. Customers (50)
    collections.users = await this.seedUsers(50, demoPasswordHash);

    // 2. Vendors (15)
    collections.vendors = await this.seedVendors(15, demoPasswordHash);

    // 3. Restaurants (25)
    collections.restaurants = await this.seedRestaurants(25);

    // 4. Delivery men (15)
    collections.delivery_men = await this.seedDeliveryMen(15, demoPasswordHash);

    // 5. Foods (80)
    collections.foods = await this.seedFoods(80);

    // 6. Orders (150) + order_details
    const orderResult = await this.seedOrders(150);
    collections.orders = orderResult.orders;
    collections.order_details = orderResult.details;

    // 7. Reviews (30)
    collections.reviews = await this.seedReviews(30);

    // 8. Delivery man reviews (20)
    collections.d_m_reviews = await this.seedDMReviews(20);

    // 9. Notifications (25)
    collections.notifications = await this.seedNotifications(25);

    // 10. Coupons (8)
    collections.coupons = await this.seedCoupons(8);

    // 11. Campaigns (5)
    collections.campaigns = await this.seedCampaigns(5);

    // 12. Wallet transactions (60)
    collections.wallet_transactions = await this.seedWalletTransactions(60);

    // 13. Account transactions (40)
    collections.account_transactions = await this.seedAccountTransactions(40);

    // 14. Disbursements (15)
    collections.disbursements = await this.seedDisbursements(15);

    // 15. Withdraw requests (20)
    collections.withdraw_requests = await this.seedWithdrawRequests(20);

    // 16. Contact messages (15)
    collections.contact_messages = await this.seedContactMessages(15);

    // 17. Refunds (12)
    collections.refunds = await this.seedRefunds(12);

    // 18. Customer addresses (60)
    collections.customer_addresses = await this.seedAddresses(60);

    // 19. Wishlists (30)
    collections.wishlists = await this.seedWishlists(30);

    // 20. Subscriptions (10)
    collections.subscriptions = await this.seedSubscriptions(10);

    // 21. Cash back histories (25)
    collections.cash_back_histories = await this.seedCashbackHistories(25);

    // 22. Loyalty point transactions (30)
    collections.loyalty_point_transactions = await this.seedLoyaltyPoints(30);

    // 23. Vendor invoices (10)
    collections.vendor_invoices = await this.seedVendorInvoices(10);

    // 24. Credit notes (8)
    collections.credit_notes = await this.seedCreditNotes(8);

    // 25. Fraud flags (5)
    collections.fraud_flags = await this.seedFraudFlags(5);

    // 26. Vendor promotions (6)
    collections.vendor_promotions = await this.seedVendorPromotions(6);

    // 27. Submitted documents (20)
    collections.submitted_documents = await this.seedSubmittedDocuments(20);

    // 28. Advertisements (8)
    collections.advertisements = await this.seedAdvertisements(8);

    const finished = new Date();
    return {
      started_at: started.toISOString(),
      finished_at: finished.toISOString(),
      duration_ms: finished.getTime() - started.getTime(),
      collections,
    };
  }

  private async seedUsers(n: number, passwordHash: string): Promise<number> {
    let next = await this.mongo.nextMysqlId('users');
    let inserted = 0;
    for (let i = 0; i < n; i++) {
      const f = this.random(this.indianFirstNames);
      const l = this.random(this.indianLastNames);
      try {
        await this.mongo.insertOne('users', {
          mysql_id: next++,
          f_name: f,
          l_name: l,
          email: `${f.toLowerCase()}.${l.toLowerCase()}${this.randomInt(1, 999)}@example.com`,
          phone: this.indianPhone(),
          password: passwordHash,
          status: true,
          is_phone_verified: true,
          is_email_verified: Math.random() > 0.3,
          image: null,
          ref_code: `REF${this.randomInt(100000, 999999)}`,
          legacy: {
            wallet_balance: this.randomInt(0, 5000),
            loyalty_point: this.randomInt(0, 500),
            login_medium: 'manual',
            created_at: this.daysAgo(this.randomInt(1, 180)),
          },
        });
        inserted++;
      } catch {
        // unique conflict on email — skip
      }
    }
    return inserted;
  }

  private async seedVendors(n: number, passwordHash: string): Promise<number> {
    let next = await this.mongo.nextMysqlId('vendors');
    let inserted = 0;
    for (let i = 0; i < n; i++) {
      const f = this.random(this.indianFirstNames);
      const l = this.random(this.indianLastNames);
      try {
        await this.mongo.insertOne('vendors', {
          mysql_id: next++,
          f_name: f,
          l_name: l,
          email: `vendor.${f.toLowerCase()}.${l.toLowerCase()}${this.randomInt(1, 999)}@example.com`,
          phone: this.indianPhone(),
          password: passwordHash,
          status: true,
          image: null,
          legacy: { created_at: this.daysAgo(this.randomInt(1, 365)) },
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedRestaurants(n: number): Promise<number> {
    // Get available vendors
    const vendors = await this.mongo.findMany<{ mysql_id: number }>('vendors', {}, { limit: 100 });
    if (vendors.length === 0) return 0;

    let next = await this.mongo.nextMysqlId('restaurants');
    let inserted = 0;
    for (let i = 0; i < n; i++) {
      const city = this.random(this.cities);
      const vendor = this.random(vendors);
      const model = this.random(['commission', 'subscription', 'commission', 'commission']);
      try {
        await this.mongo.insertOne('restaurants', {
          mysql_id: next++,
          name: `${this.random(this.restaurantNames)} - ${city.city}`,
          email: `restaurant${next}@example.com`,
          phone: this.indianPhone(),
          address: `Shop ${this.randomInt(1, 200)}, ${city.city}, ${city.state}`,
          latitude: city.lat + (Math.random() - 0.5) * 0.1,
          longitude: city.lng + (Math.random() - 0.5) * 0.1,
          mysql_vendor_id: vendor.mysql_id,
          mysql_zone_id: 1,
          logo: null,
          cover_photo: null,
          comission: model === 'commission' ? this.randomInt(8, 18) : 0,
          minimum_order: this.randomInt(99, 299),
          restaurant_model: model,
          status: true,
          active: Math.random() > 0.2,
          order_count: this.randomInt(0, 100),
          legacy: { created_at: this.daysAgo(this.randomInt(1, 365)) },
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedDeliveryMen(n: number, passwordHash: string): Promise<number> {
    let next = await this.mongo.nextMysqlId('delivery_men');
    let inserted = 0;
    for (let i = 0; i < n; i++) {
      const f = this.random(this.indianFirstNames);
      const l = this.random(this.indianLastNames);
      const applicationStatus = this.random(['approved', 'approved', 'approved', 'pending', 'denied']);
      try {
        await this.mongo.insertOne('delivery_men', {
          mysql_id: next++,
          f_name: f,
          l_name: l,
          email: `dm.${f.toLowerCase()}.${l.toLowerCase()}${this.randomInt(1, 999)}@example.com`,
          phone: this.indianPhone(),
          password: passwordHash,
          status: applicationStatus === 'approved',
          image: null,
          application_status: applicationStatus,
          mysql_zone_id: 1,
          legacy: { created_at: this.daysAgo(this.randomInt(1, 200)) },
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedFoods(n: number): Promise<number> {
    const restaurants = await this.mongo.findMany<{ mysql_id: number }>('restaurants', {}, { limit: 100 });
    if (restaurants.length === 0) return 0;
    const categories = await this.mongo.findMany<{ mysql_id: number }>('categories', {}, { limit: 50 });

    let next = await this.mongo.nextMysqlId('foods');
    let inserted = 0;
    for (let i = 0; i < n; i++) {
      const r = this.random(restaurants);
      const cat = categories.length > 0 ? this.random(categories) : null;
      try {
        await this.mongo.insertOne('foods', {
          mysql_id: next++,
          name: this.random(this.foodNames),
          description: 'Freshly prepared. Authentic taste. Hygienic kitchen.',
          image: null,
          mysql_restaurant_id: r.mysql_id,
          mysql_category_id: cat?.mysql_id ?? 1,
          price: this.randomInt(60, 599),
          discount: Math.random() > 0.6 ? this.randomInt(5, 20) : 0,
          discount_type: 'percent',
          veg: Math.random() > 0.5,
          status: true,
          recommended: Math.random() > 0.7,
          avg_rating: +(3.5 + Math.random() * 1.5).toFixed(1),
          order_count: this.randomInt(0, 200),
          item_stock: this.randomInt(10, 100),
          stock_type: 'unlimited',
          legacy: { created_at: this.daysAgo(this.randomInt(1, 200)) },
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedOrders(n: number): Promise<{ orders: number; details: number }> {
    const users = await this.mongo.findMany<{ mysql_id: number }>('users', {}, { limit: 200 });
    const restaurants = await this.mongo.findMany<{ mysql_id: number }>('restaurants', {}, { limit: 100 });
    const dms = await this.mongo.findMany<{ mysql_id: number }>('delivery_men', { application_status: 'approved' }, { limit: 50 });
    const foods = await this.mongo.findMany<{ mysql_id: number; price?: number; name?: string }>('foods', {}, { limit: 200 });

    if (users.length === 0 || restaurants.length === 0 || foods.length === 0) return { orders: 0, details: 0 };

    let nextOrder = await this.mongo.nextMysqlId('orders');
    let nextDetail = await this.mongo.nextMysqlId('order_details');
    let ordersInserted = 0;
    let detailsInserted = 0;

    // Weighted distribution — most orders are delivered, but every other
    // status appears with enough volume that the filter chips and the
    // dashboard "Refunded / Payment failed / Cooking / Picked up" stat tiles
    // render real numbers instead of zeros.
    const statuses = [
      'delivered', 'delivered', 'delivered', 'delivered', 'delivered',
      'pending', 'pending',
      'confirmed',
      'processing', 'processing',           // "cooking in kitchen"
      'handover',
      'picked_up', 'picked_up',
      'canceled',
      'refunded',                           // refund engine output
      'failed',                             // payment_failed bucket
      'scheduled',                          // scheduled future orders
    ];
    const paymentMethods = ['cash_on_delivery', 'digital_payment', 'wallet', 'cash_on_delivery', 'offline_payment'];

    for (let i = 0; i < n; i++) {
      const user = this.random(users);
      const restaurant = this.random(restaurants);
      const status = this.random(statuses);
      const dmAssignedStatuses = ['delivered', 'handover', 'picked_up', 'refunded'];
      const dm = dmAssignedStatuses.includes(status) && dms.length > 0 ? this.random(dms) : null;
      const paymentMethod = this.random(paymentMethods);
      const isPaid = status === 'failed'
        ? false
        : (paymentMethod !== 'cash_on_delivery' || status === 'delivered');
      const daysOld = this.randomInt(0, 60);

      // Pick 1-4 food items
      const itemCount = this.randomInt(1, 4);
      const items: Array<{ mysql_food_id: number; quantity: number; price: number; tax: number }> = [];
      let subtotal = 0;
      for (let j = 0; j < itemCount; j++) {
        const food = this.random(foods);
        const qty = this.randomInt(1, 3);
        const price = Number(food.price ?? this.randomInt(80, 400));
        const tax = +(price * qty * 0.05).toFixed(2);
        items.push({ mysql_food_id: food.mysql_id, quantity: qty, price, tax });
        subtotal += price * qty;
      }
      const totalTax = +(subtotal * 0.05).toFixed(2);
      const delivery = this.randomInt(20, 60);
      const couponDiscount = Math.random() > 0.7 ? this.randomInt(20, 100) : 0;
      const orderAmount = +(subtotal + totalTax + delivery - couponDiscount).toFixed(2);

      // payment_status flag for the "payment_failed" bucket — the orders page
      // filter uses order_status='failed', and the dashboard tile we wire
      // counts that same status.
      const paymentStatus = status === 'failed'
        ? 'failed'
        : (status === 'refunded' ? 'refunded' : (isPaid ? 'paid' : 'unpaid'));
      // Scheduled orders also get a future schedule_at + scheduled=true flag,
      // so a separate scheduled-orders view (if added) can pick them up.
      const scheduleAt = status === 'scheduled' ? new Date(Date.now() + this.randomInt(1, 14) * 86_400_000) : null;

      try {
        await this.mongo.insertOne('orders', {
          mysql_id: nextOrder,
          mysql_user_id: user.mysql_id,
          mysql_restaurant_id: restaurant.mysql_id,
          mysql_delivery_man_id: dm?.mysql_id ?? null,
          mysql_zone_id: 1,
          order_status: status,
          payment_status: paymentStatus,
          payment_method: paymentMethod,
          order_type: 'delivery',
          order_amount: orderAmount,
          total_tax_amount: totalTax,
          delivery_charge: delivery,
          coupon_discount_amount: couponDiscount,
          additional_charge: 0,
          restaurant_discount_amount: 0,
          scheduled: status === 'scheduled',
          schedule_at: scheduleAt,
          items,
          delivered: status === 'delivered' ? this.daysAgo(daysOld) : null,
          picked_up: status === 'picked_up' || status === 'delivered' ? this.daysAgo(daysOld) : null,
          processing: ['processing', 'handover', 'picked_up', 'delivered'].includes(status) ? this.daysAgo(daysOld) : null,
          refunded: status === 'refunded' ? this.daysAgo(daysOld) : null,
          failed: status === 'failed' ? this.daysAgo(daysOld) : null,
          canceled: status === 'canceled' ? this.daysAgo(daysOld) : null,
          created_at_legacy: this.daysAgo(daysOld),
        });
        ordersInserted++;

        // Insert order_details for each item
        for (const item of items) {
          await this.mongo.insertOne('order_details', {
            mysql_id: nextDetail++,
            order_id: nextOrder,
            mysql_food_id: item.mysql_food_id,
            food_details: { name: `Food #${item.mysql_food_id}` },
            quantity: item.quantity,
            price: item.price,
            discount_on_food: 0,
            discount_type: 'percent',
            tax_amount: item.tax,
          });
          detailsInserted++;
        }
        nextOrder++;
      } catch {
        // skip
      }
    }
    return { orders: ordersInserted, details: detailsInserted };
  }

  private async seedReviews(n: number): Promise<number> {
    const users = await this.mongo.findMany<{ mysql_id: number }>('users', {}, { limit: 100 });
    const foods = await this.mongo.findMany<{ mysql_id: number }>('foods', {}, { limit: 100 });
    const restaurants = await this.mongo.findMany<{ mysql_id: number }>('restaurants', {}, { limit: 50 });
    if (users.length === 0 || foods.length === 0) return 0;

    let next = await this.mongo.nextMysqlId('reviews');
    let inserted = 0;
    const comments = [
      'Amazing taste, will order again!', 'Fast delivery and hot food.', 'Loved the packaging.',
      'Could be better. Food was lukewarm.', 'Excellent quality!', 'Best biryani in town.',
      'Average. Nothing special.', 'Spicy and flavorful.', 'Delicious and authentic.',
      'Portions were small.', 'Worth the price!', 'Highly recommended.',
    ];

    for (let i = 0; i < n; i++) {
      const user = this.random(users);
      const food = this.random(foods);
      const restaurant = restaurants.length > 0 ? this.random(restaurants) : null;
      try {
        await this.mongo.insertOne('reviews', {
          mysql_id: next++,
          mysql_user_id: user.mysql_id,
          mysql_food_id: food.mysql_id,
          mysql_restaurant_id: restaurant?.mysql_id,
          comment: this.random(comments),
          rating: this.randomInt(3, 5),
          created_at: this.daysAgo(this.randomInt(1, 60)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedDMReviews(n: number): Promise<number> {
    const users = await this.mongo.findMany<{ mysql_id: number }>('users', {}, { limit: 100 });
    const dms = await this.mongo.findMany<{ mysql_id: number }>('delivery_men', {}, { limit: 50 });
    if (users.length === 0 || dms.length === 0) return 0;

    let next = await this.mongo.nextMysqlId('d_m_reviews');
    let inserted = 0;
    const comments = [
      'Polite and on time.', 'Friendly delivery!', 'Food arrived hot.', 'Late by 15 minutes.',
      'Professional service.', 'Good communication.', 'Could not find address.',
      'Excellent rider!', 'Helpful and quick.',
    ];

    for (let i = 0; i < n; i++) {
      try {
        await this.mongo.insertOne('d_m_reviews', {
          mysql_id: next++,
          mysql_user_id: this.random(users).mysql_id,
          mysql_delivery_man_id: this.random(dms).mysql_id,
          comment: this.random(comments),
          rating: this.randomInt(3, 5),
          created_at: this.daysAgo(this.randomInt(1, 30)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedNotifications(n: number): Promise<number> {
    let next = await this.mongo.nextMysqlId('notifications');
    let inserted = 0;
    const titles = [
      'Flat 50% Off This Weekend!', 'New Restaurant Added Near You', 'Order Tracking Live Now',
      'Refer & Earn ₹100', 'Free Delivery On Your Next Order', 'Limited Time Offer',
      'Festival Special Menu', 'Wallet Cashback Available', 'Try Our New App Features',
    ];
    for (let i = 0; i < n; i++) {
      try {
        await this.mongo.insertOne('notifications', {
          mysql_id: next++,
          title: this.random(titles),
          description: 'Tap to know more details about this exclusive offer.',
          image: null,
          status: Math.random() > 0.2,
          created_at: this.daysAgo(this.randomInt(0, 30)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedCoupons(n: number): Promise<number> {
    let next = await this.mongo.nextMysqlId('coupons');
    let inserted = 0;
    const coupons = [
      { code: 'WELCOME50', discount: 50, type: 'percent', title: 'Welcome offer 50% off' },
      { code: 'FLAT100', discount: 100, type: 'amount', title: 'Flat ₹100 off' },
      { code: 'WEEKEND20', discount: 20, type: 'percent', title: 'Weekend 20% off' },
      { code: 'DIWALI500', discount: 500, type: 'amount', title: 'Diwali ₹500 off' },
      { code: 'NEWUSER', discount: 30, type: 'percent', title: 'New user discount' },
      { code: 'FREESHIP', discount: 50, type: 'amount', title: 'Free shipping' },
      { code: 'BIRTHDAY', discount: 25, type: 'percent', title: 'Birthday treat' },
      { code: 'LUNCH199', discount: 199, type: 'amount', title: 'Lunch deal' },
    ];
    for (let i = 0; i < Math.min(n, coupons.length); i++) {
      const c = coupons[i];
      try {
        await this.mongo.insertOne('coupons', {
          mysql_id: next++,
          title: c.title,
          code: c.code,
          discount: c.discount,
          discount_type: c.type,
          coupon_type: 'default',
          min_purchase: 199,
          max_discount: 500,
          start_date: this.daysAgo(30),
          expire_date: this.daysAgo(-90),
          status: true,
          total_uses: this.randomInt(0, 50),
          limit: 5,
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedCampaigns(n: number): Promise<number> {
    let next = await this.mongo.nextMysqlId('campaigns');
    let inserted = 0;
    const titles = ['Diwali Bonanza', 'Republic Day Sale', 'Monsoon Special', 'Festive Feast', 'Year End Sale'];
    for (let i = 0; i < n; i++) {
      try {
        await this.mongo.insertOne('campaigns', {
          mysql_id: next++,
          title: titles[i % titles.length],
          description: 'Promotional campaign with attractive offers.',
          start_date: this.daysAgo(10),
          end_date: this.daysAgo(-30),
          status: true,
          type: 'basic',
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedWalletTransactions(n: number): Promise<number> {
    const users = await this.mongo.findMany<{ mysql_id: number }>('users', {}, { limit: 100 });
    if (users.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('wallet_transactions');
    let inserted = 0;
    const types = ['add_fund', 'refund', 'cashback', 'order_payment'];
    for (let i = 0; i < n; i++) {
      const isDebit = Math.random() > 0.5;
      const amount = this.randomInt(50, 1000);
      try {
        await this.mongo.insertOne('wallet_transactions', {
          mysql_id: next++,
          mysql_user_id: this.random(users).mysql_id,
          transaction_id: `TXN${this.randomInt(100000, 999999)}`,
          credit: isDebit ? 0 : amount,
          debit: isDebit ? amount : 0,
          balance: this.randomInt(0, 5000),
          transaction_type: this.random(types),
          created_at: this.daysAgo(this.randomInt(0, 60)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedAccountTransactions(n: number): Promise<number> {
    let next = await this.mongo.nextMysqlId('account_transactions');
    let inserted = 0;
    const types = ['order', 'commission', 'disbursement', 'refund', 'tip'];
    for (let i = 0; i < n; i++) {
      try {
        await this.mongo.insertOne('account_transactions', {
          mysql_id: next++,
          type: this.random(types),
          ref: `REF${this.randomInt(1000, 9999)}`,
          amount: this.randomInt(100, 5000),
          created_at: this.daysAgo(this.randomInt(0, 90)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedDisbursements(n: number): Promise<number> {
    const vendors = await this.mongo.findMany<{ mysql_id: number }>('vendors', {}, { limit: 50 });
    if (vendors.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('disbursements');
    let inserted = 0;
    const statuses = ['pending', 'processing', 'disbursed', 'disbursed', 'disbursed'];
    for (let i = 0; i < n; i++) {
      try {
        await this.mongo.insertOne('disbursements', {
          mysql_id: next++,
          mysql_vendor_id: this.random(vendors).mysql_id,
          total_amount: this.randomInt(2000, 50000),
          status: this.random(statuses),
          disbursement_id: `DSB${this.randomInt(10000, 99999)}`,
          created_at: this.daysAgo(this.randomInt(0, 60)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedWithdrawRequests(n: number): Promise<number> {
    const vendors = await this.mongo.findMany<{ mysql_id: number }>('vendors', {}, { limit: 50 });
    const dms = await this.mongo.findMany<{ mysql_id: number }>('delivery_men', {}, { limit: 50 });
    if (vendors.length === 0 && dms.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('withdraw_requests');
    let inserted = 0;
    for (let i = 0; i < n; i++) {
      const isVendor = vendors.length > 0 && Math.random() > 0.4;
      try {
        await this.mongo.insertOne('withdraw_requests', {
          mysql_id: next++,
          mysql_vendor_id: isVendor ? this.random(vendors).mysql_id : null,
          mysql_delivery_man_id: !isVendor && dms.length > 0 ? this.random(dms).mysql_id : null,
          amount: this.randomInt(500, 10000),
          approved: Math.random() > 0.5,
          transaction_note: Math.random() > 0.5 ? 'Bank transfer initiated' : null,
          type: isVendor ? 'vendor' : 'delivery_man',
          created_at: this.daysAgo(this.randomInt(0, 30)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedContactMessages(n: number): Promise<number> {
    let next = await this.mongo.nextMysqlId('contact_messages');
    let inserted = 0;
    const subjects = [
      'Need help with my order', 'Refund request', 'App not working', 'Restaurant inquiry',
      'Become a partner', 'Delivery feedback', 'Payment issue', 'Account problem',
    ];
    for (let i = 0; i < n; i++) {
      const f = this.random(this.indianFirstNames);
      const l = this.random(this.indianLastNames);
      try {
        await this.mongo.insertOne('contact_messages', {
          mysql_id: next++,
          name: `${f} ${l}`,
          email: `${f.toLowerCase()}@example.com`,
          subject: this.random(subjects),
          message: 'Please assist me with this matter at the earliest. Thank you.',
          replied: Math.random() > 0.4,
          created_at: this.daysAgo(this.randomInt(0, 30)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedRefunds(n: number): Promise<number> {
    const orders = await this.mongo.findMany<{ mysql_id: number; mysql_user_id?: number }>('orders', { order_status: 'delivered' }, { limit: 50 });
    if (orders.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('refunds');
    let inserted = 0;
    const reasons = ['Wrong item delivered', 'Quality issue', 'Missing items', 'Order delayed', 'Food cold'];
    const statuses = ['pending', 'approved', 'completed', 'rejected'];
    const methods = ['wallet', 'bank', 'upi'];
    for (let i = 0; i < n; i++) {
      const order = this.random(orders);
      try {
        await this.mongo.insertOne('refunds', {
          mysql_id: next++,
          order_id: order.mysql_id,
          user_id: order.mysql_user_id ?? null,
          customer_reason: this.random(reasons),
          customer_note: 'Please process my refund quickly.',
          refund_amount: this.randomInt(100, 800),
          refund_method: this.random(methods),
          refund_status: this.random(statuses),
          created_at: this.daysAgo(this.randomInt(0, 30)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedAddresses(n: number): Promise<number> {
    const users = await this.mongo.findMany<{ mysql_id: number }>('users', {}, { limit: 100 });
    if (users.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('customer_addresses');
    let inserted = 0;
    const types = ['home', 'work', 'other'];
    for (let i = 0; i < n; i++) {
      const city = this.random(this.cities);
      try {
        await this.mongo.insertOne('customer_addresses', {
          mysql_id: next++,
          user_id: this.random(users).mysql_id,
          address_type: this.random(types),
          address: `${this.randomInt(1, 999)}, ${city.city}`,
          contact_person_name: this.random(this.indianFirstNames),
          contact_person_number: this.indianPhone(),
          latitude: city.lat,
          longitude: city.lng,
          is_default: i % 5 === 0,
          mysql_zone_id: 1,
          created_at: this.daysAgo(this.randomInt(0, 200)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedWishlists(n: number): Promise<number> {
    const users = await this.mongo.findMany<{ mysql_id: number }>('users', {}, { limit: 100 });
    const foods = await this.mongo.findMany<{ mysql_id: number }>('foods', {}, { limit: 100 });
    if (users.length === 0 || foods.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('wishlists');
    let inserted = 0;
    for (let i = 0; i < n; i++) {
      try {
        await this.mongo.insertOne('wishlists', {
          mysql_id: next++,
          user_id: this.random(users).mysql_id,
          food_id: this.random(foods).mysql_id,
          created_at: this.daysAgo(this.randomInt(0, 60)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedSubscriptions(n: number): Promise<number> {
    const vendors = await this.mongo.findMany<{ mysql_id: number }>('vendors', {}, { limit: 50 });
    const packages = await this.mongo.findMany<{ mysql_id: number; price?: number }>('subscription_packages', {}, { limit: 20 });
    if (vendors.length === 0 || packages.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('subscriptions');
    let inserted = 0;
    for (let i = 0; i < n; i++) {
      const pkg = this.random(packages);
      try {
        await this.mongo.insertOne('subscriptions', {
          mysql_id: next++,
          vendor_id: this.random(vendors).mysql_id,
          package_id: pkg.mysql_id,
          amount: Number(pkg.price ?? 999),
          status: 'active',
          started_at: this.daysAgo(this.randomInt(0, 60)),
          expires_at: this.daysAgo(-30),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedCashbackHistories(n: number): Promise<number> {
    const users = await this.mongo.findMany<{ mysql_id: number }>('users', {}, { limit: 100 });
    if (users.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('cash_back_histories');
    let inserted = 0;
    for (let i = 0; i < n; i++) {
      try {
        await this.mongo.insertOne('cash_back_histories', {
          mysql_id: next++,
          user_id: this.random(users).mysql_id,
          calculated_amount: this.randomInt(20, 200),
          created_at: this.daysAgo(this.randomInt(0, 90)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedLoyaltyPoints(n: number): Promise<number> {
    const users = await this.mongo.findMany<{ mysql_id: number }>('users', {}, { limit: 100 });
    if (users.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('loyalty_point_transactions');
    let inserted = 0;
    for (let i = 0; i < n; i++) {
      const isCredit = Math.random() > 0.4;
      const points = this.randomInt(10, 100);
      try {
        await this.mongo.insertOne('loyalty_point_transactions', {
          mysql_id: next++,
          user_id: this.random(users).mysql_id,
          credit: isCredit ? points : 0,
          debit: isCredit ? 0 : points,
          balance: this.randomInt(100, 1000),
          transaction_id: `LP${this.randomInt(10000, 99999)}`,
          created_at: this.daysAgo(this.randomInt(0, 60)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedVendorInvoices(n: number): Promise<number> {
    const vendors = await this.mongo.findMany<{ mysql_id: number }>('vendors', {}, { limit: 50 });
    const restaurants = await this.mongo.findMany<{ mysql_id: number; mysql_vendor_id?: number }>('restaurants', {}, { limit: 50 });
    if (vendors.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('vendor_invoices');
    let inserted = 0;
    const statuses = ['issued', 'paid', 'paid', 'paid', 'cancelled'];
    for (let i = 0; i < n; i++) {
      const vendor = this.random(vendors);
      const restaurant = restaurants.find((r) => r.mysql_vendor_id === vendor.mysql_id) ?? restaurants[0];
      const gross = this.randomInt(5000, 100000);
      const commission = +(gross * 0.10).toFixed(2);
      const cgst = +(commission * 0.09).toFixed(2);
      const sgst = +(commission * 0.09).toFixed(2);
      const total = +(commission + cgst + sgst).toFixed(2);
      try {
        const period = new Date();
        period.setDate(1);
        const periodStart = new Date(period.getFullYear(), period.getMonth() - 1, 1);
        const periodEnd = new Date(period.getFullYear(), period.getMonth(), 0);
        await this.mongo.insertOne('vendor_invoices', {
          mysql_id: next,
          invoice_number: `INV-2026-${String(next).padStart(5, '0')}`,
          vendor_id: vendor.mysql_id,
          restaurant_id: restaurant?.mysql_id ?? null,
          plan_type: 'commission',
          period_start: periodStart,
          period_end: periodEnd,
          gross_sales: gross,
          order_count: this.randomInt(20, 100),
          commission_base: commission,
          ppo_base: 0,
          subscription_fee: 0,
          taxable_amount: commission,
          cgst,
          sgst,
          igst: 0,
          total_amount: total,
          tds_amount: +(total * 0.01).toFixed(2),
          net_payable: +(gross - total - total * 0.01).toFixed(2),
          status: this.random(statuses),
          issued_at: this.daysAgo(this.randomInt(0, 60)),
          created_at: this.daysAgo(this.randomInt(0, 60)),
        });
        inserted++;
        next++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedCreditNotes(n: number): Promise<number> {
    const orders = await this.mongo.findMany<{ mysql_id: number; mysql_user_id?: number; mysql_restaurant_id?: number }>('orders', { order_status: 'delivered' }, { limit: 30 });
    if (orders.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('credit_notes');
    let inserted = 0;
    const reasons = ['Customer complaint resolved', 'Wrong item delivered', 'Order quality issue', 'Missing items'];
    for (let i = 0; i < n; i++) {
      const order = this.random(orders);
      const refund = this.randomInt(100, 800);
      const tax = +(refund * 0.05).toFixed(2);
      const delivery = this.randomInt(20, 50);
      try {
        await this.mongo.insertOne('credit_notes', {
          mysql_id: next,
          credit_note_number: `CN-2026-${String(next).padStart(5, '0')}`,
          order_id: order.mysql_id,
          customer_id: order.mysql_user_id ?? null,
          restaurant_id: order.mysql_restaurant_id ?? null,
          reason: this.random(reasons),
          refund_amount: refund,
          tax_reversed: tax,
          delivery_reversed: delivery,
          total_credit: refund + tax + delivery,
          status: 'issued',
          notes: 'Auto-generated for verified refund.',
          created_at: this.daysAgo(this.randomInt(0, 45)),
        });
        inserted++;
        next++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedFraudFlags(n: number): Promise<number> {
    const dms = await this.mongo.findMany<{ mysql_id: number }>('delivery_men', {}, { limit: 30 });
    let next = await this.mongo.nextMysqlId('fraud_flags');
    let inserted = 0;
    const types = ['excessive_rejections', 'payment_fraud_suspected', 'fake_delivery_complaint'];
    const severities = ['low', 'medium', 'high', 'critical'];
    const statuses = ['open', 'investigating', 'resolved', 'open'];
    for (let i = 0; i < n; i++) {
      if (dms.length === 0) break;
      try {
        await this.mongo.insertOne('fraud_flags', {
          mysql_id: next++,
          subject_type: 'delivery_man',
          subject_id: this.random(dms).mysql_id,
          flag_type: this.random(types),
          severity: this.random(severities),
          description: 'Automated detection flagged this account for review.',
          auto_triggered: true,
          status: this.random(statuses),
          created_at: this.daysAgo(this.randomInt(0, 30)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedVendorPromotions(n: number): Promise<number> {
    const vendors = await this.mongo.findMany<{ mysql_id: number }>('vendors', {}, { limit: 30 });
    const restaurants = await this.mongo.findMany<{ mysql_id: number; mysql_vendor_id?: number }>('restaurants', {}, { limit: 30 });
    if (vendors.length === 0 || restaurants.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('vendor_promotions');
    let inserted = 0;
    const titles = ['Weekend Special', 'Buy 1 Get 1', 'Festive Discount', 'New Item Launch', 'Combo Deal', 'Happy Hour'];
    const statuses = ['pending', 'approved', 'live', 'pending', 'rejected'];
    for (let i = 0; i < n; i++) {
      const vendor = this.random(vendors);
      const restaurant = restaurants.find((r) => r.mysql_vendor_id === vendor.mysql_id) ?? restaurants[0];
      try {
        await this.mongo.insertOne('vendor_promotions', {
          mysql_id: next++,
          vendor_id: vendor.mysql_id,
          restaurant_id: restaurant.mysql_id,
          title: this.random(titles),
          description: 'Special promotional offer to attract more customers.',
          promo_type: 'discount',
          discount_type: 'percentage',
          discount_value: this.randomInt(10, 30),
          min_order_value: 199,
          max_discount: 200,
          start_date: this.daysAgo(7),
          end_date: this.daysAgo(-30),
          target_audience: 'all',
          status: this.random(statuses),
          total_uses: this.randomInt(0, 30),
          created_at: this.daysAgo(this.randomInt(0, 15)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedSubmittedDocuments(n: number): Promise<number> {
    const categories = await this.mongo.findMany<{ mysql_id: number; target_role?: string }>('document_categories', {}, { limit: 30 });
    const vendors = await this.mongo.findMany<{ mysql_id: number }>('vendors', {}, { limit: 20 });
    const dms = await this.mongo.findMany<{ mysql_id: number }>('delivery_men', {}, { limit: 20 });
    if (categories.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('submitted_documents');
    let inserted = 0;
    const statuses = ['pending', 'pending', 'approved', 'approved', 'rejected'];
    for (let i = 0; i < n; i++) {
      const cat = this.random(categories);
      const isVendor = cat.target_role === 'vendor';
      const owner = isVendor ? (vendors.length > 0 ? this.random(vendors) : null) : (dms.length > 0 ? this.random(dms) : null);
      if (!owner) continue;
      try {
        await this.mongo.insertOne('submitted_documents', {
          mysql_id: next++,
          category_id: cat.mysql_id,
          owner_type: isVendor ? 'vendor' : 'delivery_man',
          owner_id: owner.mysql_id,
          file_path: `documents/sample-${next}.pdf`,
          original_name: `${cat.mysql_id}-document.pdf`,
          mime_type: 'application/pdf',
          file_size_bytes: this.randomInt(100000, 5000000),
          status: this.random(statuses),
          remarks: Math.random() > 0.6 ? 'Looks good. Approved.' : null,
          created_at: this.daysAgo(this.randomInt(0, 60)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }

  private async seedAdvertisements(n: number): Promise<number> {
    const restaurants = await this.mongo.findMany<{ mysql_id: number }>('restaurants', {}, { limit: 30 });
    if (restaurants.length === 0) return 0;
    let next = await this.mongo.nextMysqlId('advertisements');
    let inserted = 0;
    const titles = ['Try our Special Thali!', 'New Branch Open Now', 'Free Delivery This Week', 'Combo Meal Launch', 'Festive Menu'];
    const statuses = ['approved', 'approved', 'pending', 'rejected'];
    for (let i = 0; i < n; i++) {
      try {
        await this.mongo.insertOne('advertisements', {
          mysql_id: next++,
          title: this.random(titles),
          description: 'Eye-catching advertisement to drive customers.',
          mysql_restaurant_id: this.random(restaurants).mysql_id,
          status: this.random(statuses),
          start_date: this.daysAgo(7),
          end_date: this.daysAgo(-30),
          created_at: this.daysAgo(this.randomInt(0, 30)),
        });
        inserted++;
      } catch {
        // skip
      }
    }
    return inserted;
  }
}
