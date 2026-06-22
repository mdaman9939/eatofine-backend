import { MongoClient } from 'mongodb';
const HOSTS=['ac-wwhajfd-shard-00-00.5kgahgx.mongodb.net:27017','ac-wwhajfd-shard-00-01.5kgahgx.mongodb.net:27017','ac-wwhajfd-shard-00-02.5kgahgx.mongodb.net:27017'].join(',');
const c=new MongoClient(`mongodb://${HOSTS}/eatofine?ssl=true&replicaSet=atlas-fv6e0i-shard-0&authSource=admin`,{auth:{username:'aman_admin',password:'Aman%40123456'}});
await c.connect();
const pkgs=await c.db('eatofine').collection('subscription_packages').find({},{projection:{mysql_id:1,package_name:1,max_product:1,max_order:1}}).limit(10).toArray();
for(const p of pkgs)console.log(`pkg id=${p.mysql_id} "${p.package_name}" max_product=${JSON.stringify(p.max_product)} max_order=${JSON.stringify(p.max_order)}`);
if(pkgs.length===0)console.log('NO subscription_packages in DB (app uses fallback packages: id1 Starter max_product=50)');
await c.close();
