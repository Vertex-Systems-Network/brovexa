import { z } from 'zod';

export const sourceTransportAddressClassValues = [
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
] as const;

export const SourceTransportAddressClassSchema = z.enum(sourceTransportAddressClassValues);
export type SourceTransportAddressClass = z.infer<typeof SourceTransportAddressClassSchema>;
