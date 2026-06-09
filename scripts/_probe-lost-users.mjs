import 'dotenv/config';
import { MongoClient } from 'mongodb';
const u=process.env.MONGO_USER,p=process.env.MONGO_PASSWORD,h=process.env.MONGO_HOSTS,rs=process.env.MONGO_REPLICA_SET,db_=process.env.MONGO_DATABASE??'eatofine',as=process.env.MONGO_AUTH_SOURCE??'admin';
const pr=new URLSearchParams({ssl:'true',authSource:as,retryWrites:'true',w:'majority'});if(rs)pr.set('replicaSet',rs);
const c=new MongoClient(`mongodb://${encodeURIComponent(u)}:${encodeURIComponent(p)}@${h}/${db_}?${pr}`,{serverSelectionTimeoutMS:15000});await c.connect();const db=c.db(db_);
const users=await db.collection('users').find({image:{$exists:true,$ne:null,$ne:''}}).toArray();
let local=0,lost=0,http=0;
for(const usr of users){const img=usr.image;if(/^https?:\/\//.test(img)){http++;continue;}local++;const up=await db.collection('uploads').findOne({path:`profile/${img}`});if(!up)lost++;}
console.log(`users with image: ${users.length} | http(ok): ${http} | local-file: ${local} | lost(local not in uploads): ${lost}`);
