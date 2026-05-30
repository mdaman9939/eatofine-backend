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
exports.DocumentsController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const documents_service_1 = require("./documents.service");
let DocumentsController = class DocumentsController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    listCategories(role) {
        return this.svc.listCategories(role);
    }
    createCategory(body) {
        return this.svc.createCategory(body);
    }
    updateCategory(id, body) {
        return this.svc.updateCategory(id, body);
    }
    toggleCategory(id, body) {
        return this.svc.toggleCategoryStatus(id, body.status);
    }
    deleteCategory(id) {
        return this.svc.deleteCategory(id);
    }
    listSubmitted(status, ownerType, ownerId, limit) {
        return this.svc.listSubmitted({
            status,
            ownerType,
            ownerId: ownerId ? parseInt(ownerId, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }
    stats() {
        return this.svc.getStats();
    }
    approve(req, id, body) {
        const reviewer = Number(req.actor?.id ?? 0);
        return this.svc.approveDocument(id, reviewer, body.remarks);
    }
    reject(req, id, body) {
        const reviewer = Number(req.actor?.id ?? 0);
        return this.svc.rejectDocument(id, reviewer, body.remarks);
    }
    deleteSubmitted(id) {
        return this.svc.deleteSubmitted(id);
    }
};
exports.DocumentsController = DocumentsController;
__decorate([
    (0, common_1.Get)('document-categories'),
    __param(0, (0, common_1.Query)('target_role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "listCategories", null);
__decorate([
    (0, common_1.Post)('document-categories'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Patch)('document-categories/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "updateCategory", null);
__decorate([
    (0, common_1.Patch)('document-categories/:id/status'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "toggleCategory", null);
__decorate([
    (0, common_1.Delete)('document-categories/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "deleteCategory", null);
__decorate([
    (0, common_1.Get)('submitted-documents'),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('owner_type')),
    __param(2, (0, common_1.Query)('owner_id')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "listSubmitted", null);
__decorate([
    (0, common_1.Get)('submitted-documents/stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "stats", null);
__decorate([
    (0, common_1.Patch)('submitted-documents/:id/approve'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "approve", null);
__decorate([
    (0, common_1.Patch)('submitted-documents/:id/reject'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "reject", null);
__decorate([
    (0, common_1.Delete)('submitted-documents/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "deleteSubmitted", null);
exports.DocumentsController = DocumentsController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, auth_guard_1.RequireAuth)('admin'),
    __metadata("design:paramtypes", [documents_service_1.DocumentsService])
], DocumentsController);
//# sourceMappingURL=documents.controller.js.map