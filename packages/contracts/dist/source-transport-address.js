"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceTransportAddressClassSchema = exports.sourceTransportAddressClassValues = void 0;
const zod_1 = require("zod");
exports.sourceTransportAddressClassValues = [
    'public',
    'private',
    'loopback',
    'link_local',
    'metadata',
    'multicast',
    'unspecified',
    'documentation',
    'reserved',
    'invalid',
];
exports.SourceTransportAddressClassSchema = zod_1.z.enum(exports.sourceTransportAddressClassValues);
//# sourceMappingURL=source-transport-address.js.map