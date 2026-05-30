"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancementsModule = void 0;
const common_1 = require("@nestjs/common");
const enhancements_controller_1 = require("./enhancements.controller");
const enhancements_service_1 = require("./enhancements.service");
const dm_charges_service_1 = require("./dm-charges.service");
const user_delivery_charges_service_1 = require("./user-delivery-charges.service");
let EnhancementsModule = class EnhancementsModule {
};
exports.EnhancementsModule = EnhancementsModule;
exports.EnhancementsModule = EnhancementsModule = __decorate([
    (0, common_1.Module)({
        controllers: [enhancements_controller_1.EnhancementsController],
        providers: [enhancements_service_1.EnhancementsService, dm_charges_service_1.DmChargesService, user_delivery_charges_service_1.UserDeliveryChargesService],
    })
], EnhancementsModule);
//# sourceMappingURL=enhancements.module.js.map