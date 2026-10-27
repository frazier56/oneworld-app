// Dependency-free classnames helper (clsx/tailwind-merge not installed here).
// Filters out falsy values and joins the rest — enough for the VAIA kit usage.
export type ClassValue = string | number | null | false | undefined;
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
export default cn;
