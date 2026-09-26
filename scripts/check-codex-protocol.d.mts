// Types for the plain-ESM protocol checker, so TypeScript scripts reuse its canonical manifest
// hashing rather than carrying a second copy of it.
export type ProtocolManifest = {
  schema: string;
  version: string;
  executable: string;
  command: string;
  experimental: boolean;
  fileCount: number;
  bundleHash: string;
  files: Record<string, string>;
};
export function buildProtocolManifest(input: {
  schemaRoot: string;
  version: string;
  executable: string;
}): Promise<ProtocolManifest>;
export function checkProtocolBundle(input: {
  bundleRoot: string;
  expectedVersion: string;
}): Promise<{ ok: true; fileCount: number; version: string } | { ok: false; code: string }>;
