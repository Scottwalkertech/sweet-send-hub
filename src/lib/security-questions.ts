// Standard security questions offered at signup and enforced at sign-in.
export const SECURITY_QUESTIONS: string[] = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What was the make of your first car?",
];

/** Normalize security answers so trivial typos (spacing, case) don't lock users out. */
export function normalizeSecurityAnswer(v: string): string {
  return (v ?? "").trim().toLowerCase();
}
