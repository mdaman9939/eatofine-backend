"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoDataService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let MongoDataService = class MongoDataService {
    connection;
    constructor(connection) {
        this.connection = connection;
    }
    coll(name) {
        if (!this.connection.db) {
            throw new Error('MongoDB connection not ready');
        }
        return this.connection.db.collection(name);
    }
    async findMany(collection, filter = {}, options = {}) {
        const findOpts = {};
        if (options.limit !== undefined)
            findOpts.limit = options.limit;
        if (options.skip !== undefined)
            findOpts.skip = options.skip;
        if (options.sort)
            findOpts.sort = options.sort;
        if (options.projection)
            findOpts.projection = options.projection;
        const cursor = this.coll(collection).find(filter, findOpts);
        return (await cursor.toArray());
    }
    async findOne(collection, filter) {
        const doc = await this.coll(collection).findOne(filter);
        return doc;
    }
    async findByMysqlId(collection, mysqlId) {
        return this.findOne(collection, { mysql_id: Number(mysqlId) });
    }
    async count(collection, filter = {}) {
        return this.coll(collection).countDocuments(filter);
    }
    async insertOne(collection, doc) {
        const res = await this.coll(collection).insertOne(doc);
        return { ...doc, _id: res.insertedId };
    }
    async updateOne(collection, filter, set) {
        const res = await this.coll(collection).updateOne(filter, { $set: set });
        return { matchedCount: res.matchedCount, modifiedCount: res.modifiedCount };
    }
    async updateMany(collection, filter, set) {
        const res = await this.coll(collection).updateMany(filter, { $set: set });
        return { matchedCount: res.matchedCount, modifiedCount: res.modifiedCount };
    }
    async deleteOne(collection, filter) {
        const res = await this.coll(collection).deleteOne(filter);
        return { deletedCount: res.deletedCount };
    }
    async deleteMany(collection, filter) {
        const res = await this.coll(collection).deleteMany(filter);
        return res.deletedCount ?? 0;
    }
    async aggregate(collection, pipeline) {
        return this.coll(collection).aggregate(pipeline).toArray();
    }
    async nextMysqlId(collection) {
        const top = await this.coll(collection)
            .find({}, { projection: { mysql_id: 1 }, sort: { mysql_id: -1 }, limit: 1 })
            .toArray();
        const cur = top[0] ? Number(top[0].mysql_id ?? 0) : 0;
        return cur + 1;
    }
};
exports.MongoDataService = MongoDataService;
exports.MongoDataService = MongoDataService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectConnection)()),
    __metadata("design:paramtypes", [mongoose_2.Connection])
], MongoDataService);
//# sourceMappingURL=mongo-data.service.js.map