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
exports.ReadinessController = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("./database.service");
let ReadinessController = class ReadinessController {
    database;
    constructor(database) {
        this.database = database;
    }
    async getReadiness() {
        const database = await this.database.readiness();
        if (!database.configured) {
            throw new common_1.ServiceUnavailableException({
                code: 'DATABASE_NOT_CONFIGURED',
                message: 'Database readiness is not configured.',
            });
        }
        if (!database.ok) {
            throw new common_1.ServiceUnavailableException({
                code: 'DATABASE_UNAVAILABLE',
                message: 'Database readiness check failed.',
            });
        }
        if (database.probe.serverMajor !== 18 || !database.probe.schemaReady) {
            throw new common_1.ServiceUnavailableException({
                code: 'DATABASE_SCHEMA_NOT_READY',
                message: 'Database schema is not ready for this application version.',
            });
        }
        return {
            status: 'ready',
            database: {
                serverVersion: database.probe.serverVersion,
                serverMajor: database.probe.serverMajor,
                schemaReady: true,
            },
        };
    }
};
exports.ReadinessController = ReadinessController;
__decorate([
    (0, common_1.Get)('ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReadinessController.prototype, "getReadiness", null);
exports.ReadinessController = ReadinessController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], ReadinessController);
//# sourceMappingURL=readiness.controller.js.map