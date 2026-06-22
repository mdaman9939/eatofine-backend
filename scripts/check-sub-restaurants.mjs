import { MongoClient } from 'mongodb';
const HOSTS=['ac-wwhajfd-shard-00-00.5kgahgx.mongodb.net:27017','ac-wwhajfd-shard-00-01.5kgahgx.mongodb.net:27017','ac-wwhajfd-shard-00-02.5kgahgx.mongodb.net:27017'].join(',');
const url=`mongodb://${HOSTS}/eatofine?ssl=true&replicaSet=atlas-fv6e0i-shard-0&authSource=admin`;
const c=new MongoClient(url,{auth:{username:'aman_admin',password:'Aman%40123456'}});
await c.connect();const db=c.db('eatofine');
const aman=await db.collection('restaurants').findOne({mysql_id:35},{projection:{name:1,restaurant_model:1,subscription_id:1}});
console.log('Aman Ji:',JSON.stringify(aman));
const subs=await db.collection('restaurants').find({$or:[{restaurant_model:'subscription'},{subscription_id:{$gt:0}}]},{projection:{mysql_id:1,name:1,restaurant_model:1,subscription_id:1}}).limit(20).toArray();
console.log('subscription restaurants:',subs.length);
for(const r of subs){const fc=await db.collection('foods').countDocuments({$or:[{mysql_restaurant_id:r.mysql_id},{restaurant_id:r.mysql_id}]});console.log(`  id=${r.mysql_id} ${JSON.stringify(r.name)} model=${r.restaurant_model} sub_id=${r.subscription_id} foods=${fc}`);}
await c.close();
