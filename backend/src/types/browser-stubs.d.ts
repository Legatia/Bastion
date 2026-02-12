// Stub browser-only types referenced by ox (viem dependency).
// ox ships raw .ts files that use WebAuthn APIs — these never run in Node.js
// but tsc still type-checks them. This file satisfies the compiler without
// pulling in the full DOM lib.

declare var window: any;
declare type BufferSource = ArrayBufferView | ArrayBuffer;
declare type AuthenticatorResponse = any;
declare type AuthenticatorAttestationResponse = any;
declare type AuthenticatorAssertionResponse = any;
declare type AuthenticationExtensionsClientOutputs = any;
