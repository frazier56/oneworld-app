/** Keep authentication return trips inside this app, including the original query and hash. */
export function safeAuthReturn(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/yourworld";
  try {
    const url = new URL(value, "https://oneworld.invalid");
    if (url.origin !== "https://oneworld.invalid") return "/yourworld";
    return url.pathname + url.search + url.hash;
  } catch { return "/yourworld"; }
}

export const signUpHref = (next: string) => "/join?next=" + encodeURIComponent(safeAuthReturn(next));
