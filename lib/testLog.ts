/**
 * ============================================================================
 *  TEMPORARY - USER TESTING PHASE ONLY - DELETE BEFORE GENERAL RELEASE
 * ============================================================================
 *
 * This file and everything that imports it exist to capture real call sessions
 * from a handful of invited testers, so the transcripts can be read back as
 * research. It is NOT a product feature and must not survive the testing phase.
 *
 * What it captures: the traveler's brief (including free-text notes), the full
 * dual-language transcript, and the generated summary. In practice that means
 * PERSONAL DATA - names a booking is made under, what someone wants, and
 * occasionally health information, because "my son has an earache" is exactly
 * the kind of call this product is for.
 *
 * Three safeguards, all deliberate:
 *
 *  1. OFF BY DEFAULT. Nothing is captured unless NEXT_PUBLIC_ENABLE_TEST_LOGGING is
 *     set to "true" in the environment.
 *  2. IT EXPIRES. After TEST_LOG_EXPIRES the endpoint stops storing anything
 *     and starts warning instead, so forgetting to remove this fails closed
 *     rather than quietly collecting data for a year.
 *  3. TESTERS ARE TOLD. When logging is on, the brief form shows a notice.
 *     Do not remove that notice while leaving the logging on.
 *
 * Removal checklist lives in TESTING-ONLY.md at the repo root.
 */

/** Anything written by this feature carries this marker, so it is greppable. */
export const TEST_LOG_MARKER = "[YAPPR-TEST-LOG]";

/**
 * Hard stop. After this date the endpoint refuses to store anything, whatever
 * the environment says. Bump it deliberately if testing genuinely runs longer;
 * do not remove the check.
 */
export const TEST_LOG_EXPIRES = "2026-12-31";

/**
 * Deliberately a NEXT_PUBLIC_ flag. The same value gates the server-side
 * capture AND the notice shown to testers, so it is impossible to end up
 * recording people without the notice being on. It is not a secret: anyone
 * being recorded is being told anyway.
 */
export function testLoggingConfigured() {
  return process.env.NEXT_PUBLIC_ENABLE_TEST_LOGGING === "true";
}

export function testLoggingExpired(now: Date = new Date()) {
  return now > new Date(`${TEST_LOG_EXPIRES}T23:59:59Z`);
}

/** Logging is live only while it is switched on AND has not expired. */
export function testLoggingActive(now: Date = new Date()) {
  return testLoggingConfigured() && !testLoggingExpired(now);
}
