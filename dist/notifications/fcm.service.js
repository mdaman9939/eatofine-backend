"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var FcmService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FcmService = void 0;
const common_1 = require("@nestjs/common");
const admin = __importStar(require("firebase-admin"));
let FcmService = FcmService_1 = class FcmService {
    logger = new common_1.Logger(FcmService_1.name);
    app = null;
    initialized = false;
    disabled = false;
    ensureApp() {
        if (this.initialized)
            return this.app;
        this.initialized = true;
        const credential = this.loadCredential();
        if (!credential) {
            this.disabled = true;
            this.logger.warn('FCM disabled — set FIREBASE_SERVICE_ACCOUNT (or FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY) to enable real-time push.');
            return null;
        }
        try {
            this.app = admin.apps.length
                ? admin.app()
                : admin.initializeApp({ credential });
            this.logger.log('FCM initialized — real-time push enabled.');
            return this.app;
        }
        catch (err) {
            this.disabled = true;
            this.logger.error(`FCM init failed: ${err.message}`);
            return null;
        }
    }
    loadCredential() {
        const json = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (json && json.trim()) {
            try {
                const parsed = JSON.parse(json);
                if (typeof parsed.private_key === 'string') {
                    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
                }
                return admin.credential.cert(parsed);
            }
            catch (err) {
                this.logger.error(`FIREBASE_SERVICE_ACCOUNT is not valid JSON: ${err.message}`);
                return null;
            }
        }
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        if (projectId && clientEmail && privateKey) {
            privateKey = privateKey.replace(/\\n/g, '\n');
            return admin.credential.cert({ projectId, clientEmail, privateKey });
        }
        return null;
    }
    isEnabled() {
        return this.ensureApp() !== null && !this.disabled;
    }
    async sendToToken(token, notification, data = {}) {
        if (!token || !token.trim())
            return false;
        const app = this.ensureApp();
        if (!app)
            return false;
        const stringData = {};
        for (const [k, v] of Object.entries(data)) {
            if (v !== null && v !== undefined)
                stringData[k] = String(v);
        }
        try {
            await admin.messaging(app).send({
                token,
                notification: { title: notification.title, body: notification.body },
                data: stringData,
                android: {
                    priority: 'high',
                    notification: { sound: 'default', channelId: 'default' },
                },
                apns: {
                    headers: { 'apns-priority': '10' },
                    payload: { aps: { sound: 'default', contentAvailable: true } },
                },
            });
            return true;
        }
        catch (err) {
            this.logger.warn(`FCM send failed: ${err.message}`);
            return false;
        }
    }
};
exports.FcmService = FcmService;
exports.FcmService = FcmService = FcmService_1 = __decorate([
    (0, common_1.Injectable)()
], FcmService);
//# sourceMappingURL=fcm.service.js.map