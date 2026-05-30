"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
function buildMongoUri() {
    const user = process.env.MONGO_USER;
    const password = process.env.MONGO_PASSWORD;
    const database = process.env.MONGO_DATABASE ?? 'eatofine';
    const hosts = process.env.MONGO_HOSTS;
    const replicaSet = process.env.MONGO_REPLICA_SET;
    const authSource = process.env.MONGO_AUTH_SOURCE ?? 'admin';
    if (!user || !password || !hosts) {
        throw new Error('MongoDB env vars missing: MONGO_USER, MONGO_PASSWORD, MONGO_HOSTS are required.');
    }
    const encUser = encodeURIComponent(user);
    const encPassword = encodeURIComponent(password);
    const params = new URLSearchParams({
        ssl: 'true',
        authSource,
        retryWrites: 'true',
        w: 'majority',
    });
    if (replicaSet)
        params.set('replicaSet', replicaSet);
    return `mongodb://${encUser}:${encPassword}@${hosts}/${database}?${params.toString()}`;
}
let MongoModule = class MongoModule {
};
exports.MongoModule = MongoModule;
exports.MongoModule = MongoModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forRootAsync({
                useFactory: () => ({
                    uri: buildMongoUri(),
                    serverSelectionTimeoutMS: 15000,
                    connectionFactory: (connection) => {
                        connection.on('connected', () => console.log('[mongo] Connected to Atlas: %s', connection.name));
                        connection.on('disconnected', () => console.warn('[mongo] Disconnected from Atlas'));
                        connection.on('error', (err) => console.error('[mongo] Error:', err.message));
                        return connection;
                    },
                }),
            }),
        ],
        exports: [mongoose_1.MongooseModule],
    })
], MongoModule);
//# sourceMappingURL=mongo.module.js.map