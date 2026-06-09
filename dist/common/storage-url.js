"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageContext = void 0;
exports.storageBaseUrl = storageBaseUrl;
exports.storageFullUrl = storageFullUrl;
const async_hooks_1 = require("async_hooks");
exports.storageContext = new async_hooks_1.AsyncLocalStorage();
function storageBaseUrl() {
    const fromReq = exports.storageContext.getStore()?.baseUrl;
    const base = fromReq || process.env.STORAGE_BASE_URL || 'http://127.0.0.1:3000/storage';
    return base.replace(/\/$/, '');
}
function storageFullUrl(folder, file) {
    if (!file || !String(file).trim())
        return null;
    const f = String(file);
    if (/^https?:\/\//i.test(f))
        return f;
    return `${storageBaseUrl()}/${folder}/${f}`;
}
//# sourceMappingURL=storage-url.js.map