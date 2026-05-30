"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtrasModule = void 0;
const common_1 = require("@nestjs/common");
const static_pages_controller_1 = require("./static-pages.controller");
const customer_extras_controller_1 = require("./customer-extras.controller");
const catalog_extras_controller_1 = require("./catalog-extras.controller");
const vendor_extras_controller_1 = require("./vendor-extras.controller");
const delivery_extras_controller_1 = require("./delivery-extras.controller");
const auth_extras_controller_1 = require("./auth-extras.controller");
let ExtrasModule = class ExtrasModule {
};
exports.ExtrasModule = ExtrasModule;
exports.ExtrasModule = ExtrasModule = __decorate([
    (0, common_1.Module)({
        controllers: [
            static_pages_controller_1.StaticPagesController,
            auth_extras_controller_1.AuthExtrasController,
            customer_extras_controller_1.CustomerExtrasController,
            catalog_extras_controller_1.CatalogExtrasController,
            vendor_extras_controller_1.VendorExtrasController,
            delivery_extras_controller_1.DeliveryExtrasController,
        ],
    })
], ExtrasModule);
//# sourceMappingURL=extras.module.js.map