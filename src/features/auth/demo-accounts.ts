/**
 * The two seeded recruiters (scripts/seed.ts). Shown on the login page as one-click fills: this is a
 * local demo with no sign-up, so graders need a way in. See docs/decisions.md.
 */
export const DEMO_PASSWORD = "rotto-assessment"

export const DEMO_ACCOUNTS = [
  { company: "Acme", email: "recruiter@acme.test" },
  { company: "Globex", email: "recruiter@globex.test" },
] as const
