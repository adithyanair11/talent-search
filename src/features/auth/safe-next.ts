/**
 * The post-login destination from `?next=`: only same-origin paths (open-redirect guard). The URL is resolved
 * and origins compared rather than pattern-matching the string, because URL parsing strips tabs/newlines:
 * "/\t/evil.example" passes a "starts with one slash" regex but resolves to another host.
 */
export function safeNextPath(next: string | null, origin: string, fallback = "/search"): string {
  if (!next?.startsWith("/")) return fallback
  try {
    const url = new URL(next, origin)
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : fallback
  } catch {
    return fallback
  }
}
