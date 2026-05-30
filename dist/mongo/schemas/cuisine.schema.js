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
exports.CuisineSchema = exports.Cuisine = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let Cuisine = class Cuisine {
    mysql_id;
    name;
    image;
    status;
    legacy;
};
exports.Cuisine = Cuisine;
__decorate([
    (0, mongoose_1.Prop)({ index: true, unique: true }),
    __metadata("design:type", Number)
], Cuisine.prototype, "mysql_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ trim: true, index: true }),
    __metadata("design:type", String)
], Cuisine.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Cuisine.prototype, "image", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], Cuisine.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Cuisine.prototype, "legacy", void 0);
exports.Cuisine = Cuisine = __decorate([
    (0, mongoose_1.Schema)({ collection: 'cuisines', timestamps: true })
], Cuisine);
exports.CuisineSchema = mongoose_1.SchemaFactory.createForClass(Cuisine);
//# sourceMappingURL=cuisine.schema.js.map