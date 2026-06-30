/**
 * Fill in banners that have a null/empty `image` so the customer-app home
 * carousel stops showing the grey placeholder. Banners with a real image
 * (the other 4 Unsplash URLs) are left untouched.
 *
 * Root cause: banner mysql_id=5 ("Hot Chilli Potato") had image=null, so the
 * API returns image_full_url=null and CustomImageWidget renders its fallback.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const u=process.env.MONGO_USER,p=process.env.MONGO_PASSWORD,h=process.env.MONGO_HOSTS,rs=process.env.MONGO_REPLICA_SET,dbn=process.env.MONGO_DATABASE??'eatofine',as=process.env.MONGO_AUTH_SOURCE??'admin';
const ps=new URLSearchParams({ssl:'true',authSource:as,retryWrites:'true',w:'majority'});if(rs)ps.set('replicaSet',rs);
const uri=`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${dbn}?${ps}`;
const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000});

// Verified 200 OK, sized like the other banners (1200x500).
const FALLBACK = 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=1200&h=500&fit=crop&q=80';

try {
  await client.connect();
  const db = client.db(dbn);
  const col = db.collection('banners');

  const blank = await col.find({
    status: true,
    $or: [{ image: null }, { image: '' }, { image: { $exists: false } }],
  }).toArray();

  console.log(`\nBanners with missing image: ${blank.length}`);
  for (const b of blank) {
    await col.updateOne({ _id: b._id }, { $set: { image: FALLBACK } });
    console.log(`  ✔ #${b.mysql_id} "${b.title?.trim()}" → image set`);
  }

  console.log('\nFinal banner image state:');
  const all = await col.find({ status: true }).sort({ mysql_id: 1 }).toArray();
  for (const b of all) console.log(`  #${b.mysql_id} ${b.image ? 'OK ' : 'NULL'} ${b.title?.trim()}`);
  console.log('\n✅ Done. Pull-to-refresh the home screen to see it.');
} catch (err) { console.error('❌', err.message); process.exit(1); }
finally { await client.close(); }
