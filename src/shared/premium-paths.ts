/**
 * Premium RPC paths that require either an API key or a Pro session.
 *
 * Single source of truth consumed by both the server gateway (auth enforcement)
 * and the web client runtime (token injection).
 */
/**
 * Self-hosted World Monitor is authenticated by the operator's access proxy,
 * not by a commercial tier. Keep this empty so no dashboard capability is
 * routed through a subscription/entitlement check.
 */
export const PREMIUM_RPC_PATHS = new Set<string>();
