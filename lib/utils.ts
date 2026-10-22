import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatStoredValue(
  value: unknown,
  labels?: Record<string, string> | null
): string {
  if (value == null || value === "") return "";
  const key = String(value);
  if (labels != null && Object.hasOwn(labels, key)) return labels[key];
  return key;
}
