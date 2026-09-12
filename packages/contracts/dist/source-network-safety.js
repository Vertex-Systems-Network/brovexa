"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideSourceNetworkSafety = decideSourceNetworkSafety;
function decideSourceNetworkSafety(addressClasses) {
    const observedClasses = [...addressClasses];
    if (observedClasses.length === 0) {
        return {
            decision: 'block',
            code: 'NO_RESOLVED_ADDRESSES',
            observedClasses,
        };
    }
    if (observedClasses.some((classification) => classification !== 'public')) {
        return {
            decision: 'block',
            code: 'NON_PUBLIC_ADDRESS_PRESENT',
            observedClasses,
        };
    }
    return {
        decision: 'allow',
        code: 'ALL_ADDRESSES_PUBLIC',
        observedClasses,
    };
}
//# sourceMappingURL=source-network-safety.js.map