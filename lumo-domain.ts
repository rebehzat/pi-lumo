/** True for `lumo.proton.me` itself or any of its subdomains, never a look-alike like `evillumo.proton.me`. */
export function isLumoCookieDomain(domain: string): boolean {
  return domain === "lumo.proton.me" || domain.endsWith(".lumo.proton.me");
}
