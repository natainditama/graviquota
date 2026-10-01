import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind and conditional CSS class names safely
 */
export function mergeTailwindClassNames(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const cn = mergeTailwindClassNames;

/**
 * Normalizes an email address for consistent comparison.
 * Handles trimming, lowercasing, and Google/Gmail address rules.
 */
function normalizeUserEmailAddress(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex === -1) return trimmed;

  let localPart = trimmed.substring(0, atIndex);
  let domainPart = trimmed.substring(atIndex + 1);

  if (domainPart === "googlemail.com") {
    domainPart = "gmail.com";
  }

  if (domainPart === "gmail.com") {
    localPart = localPart.replace(/\./g, "");
    const plusIndex = localPart.indexOf("+");
    if (plusIndex !== -1) {
      localPart = localPart.substring(0, plusIndex);
    }
  }

  return `${localPart}@${domainPart}`;
}

/**
 * Case-insensitive comparison of two Google account email addresses.
 * Safely determines if online session account matches local environment account.
 */
export function compareUserAccountEmails(firstEmail?: string | null, secondEmail?: string | null): boolean {
  if (!firstEmail || !secondEmail) return false;
  return normalizeUserEmailAddress(firstEmail) === normalizeUserEmailAddress(secondEmail);
}
