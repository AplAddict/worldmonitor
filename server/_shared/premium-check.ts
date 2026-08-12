/**
 * Self-hosted authorization adapter.
 *
 * The World Monitor container has no host-published UI port and is protected
 * by the Authentik reverse proxy. Product-tier checks are deliberately absent
 * from this deployment; callers reaching the application are authorized by
 * that ingress boundary.
 */
export async function isCallerPremium(_request: Request): Promise<boolean> {
  return true;
}
