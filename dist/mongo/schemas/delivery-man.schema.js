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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryManSchema = exports.DeliveryMan = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let DeliveryMan = class DeliveryMan {
    mysql_id;
    f_name;
    l_name;
    email;
    phone;
    password;
    status;
    image;
    application_status;
    mysql_zone_id;
    legacy;
};
exports.DeliveryMan = DeliveryMan;
__decorate([
    (0, mongoose_1.Prop)({ index: true, unique: true }),
    __metadata("design:type", Number)
], DeliveryMan.prototype, "mysql_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], DeliveryMan.prototype, "f_name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true }),
    __metadata("design:type", String)
], DeliveryMan.prototype, "l_name", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, lowercase: true, index: true }),
    __metadata("design:type", String)
], DeliveryMan.prototype, "email", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, index: true }),
    __metadata("design:type", String)
], DeliveryMan.prototype, "phone", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DeliveryMan.prototype, "password", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], DeliveryMan.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DeliveryMan.prototype, "image", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], DeliveryMan.prototype, "application_status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: true }),
    __metadata("design:type", Number)
], DeliveryMan.prototype, "mysql_zone_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], DeliveryMan.prototype, "legacy", void 0);
exports.DeliveryMan = DeliveryMan = __decorate([
    (0, mongoose_1.Schema)({ collection: 'delivery_men', timestamps: true })
], DeliveryMan);
exports.DeliveryManSchema = mongoose_1.SchemaFactory.createForClass(DeliveryMan);
//# sourceMappingURL=delivery-man.schema.js.map