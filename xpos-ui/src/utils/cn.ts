type ClassValue = string | false | null | undefined;

/** Merge class names, filtering falsy values. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
