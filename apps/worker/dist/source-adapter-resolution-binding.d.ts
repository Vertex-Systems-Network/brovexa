export interface SourceAdapterResolutionBindingInput {
    transportRequestId: string;
    canonicalUrl: string;
    hostname: string;
    resolvedAt: string;
    resolvedAddressKeys: readonly string[];
}
export interface SourceAdapterResolutionBinding extends SourceAdapterResolutionBindingInput {
    version: 1;
}
export declare function bindSourceAdapterResolution(input: SourceAdapterResolutionBindingInput): SourceAdapterResolutionBinding;
