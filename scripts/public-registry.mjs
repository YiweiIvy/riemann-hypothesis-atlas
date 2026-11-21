// GitHub identity belongs to the accepted issue, separate from the cited evidence.
import { isDeepStrictEqual } from "node:util";
import { BASELINE } from "../site/data/baseline.mjs";
import {
  enforceReviewOwnership,
  importReviews,
  REVIEW_CONTEXT,
} from "../site/trust.mjs";

export const issueUrl =
  /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9_-]*\/[A-Za-z0-9_.-]+\/issues\/[1-9]\d*$/;

export function validateSubmission(source) {
  if (
    !source ||
    Object.keys(source).sort().join(",") !== "issue,login" ||
    typeof source.issue !== "string" ||
    !issueUrl.test(source.issue) ||
    new URL(source.issue).href !== source.issue ||
    !(
      source.login === null ||
      (typeof source.login === "string" &&
        /^[A-Za-z0-9_-]{1,100}(?:\[bot\])?$/.test(source.login))
    )
  )
    throw new Error("Invalid GitHub submission attribution.");
  return source;
}

export function publicRegistry(
  json,
  context = REVIEW_CONTEXT,
  protectedReviews = BASELINE,
) {
  const envelope = typeof json === "string" ? JSON.parse(json) : json;
  const reviews = importReviews(envelope, context);
  if (reviews.length !== envelope.reviews.length)
    throw new Error("Duplicate review ID in public registry");
  const ids = new Set(reviews.map((r) => r.id));
  if (protectedReviews.some((r) => ids.has(r.id)))
    throw new Error(
      "A baseline review cannot be republished as a community record",
    );
  enforceReviewOwnership(reviews, protectedReviews);
  const raw = envelope.submissions === undefined ? {} : envelope.submissions;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid submissions map");
  const submissions = new Map();
  for (const [id, source] of Object.entries(raw)) {
    if (!ids.has(id))
      throw new Error("Submission has no matching community review: " + id);
    submissions.set(id, validateSubmission(source));
  }
  return { reviews, submissions };
}

export function requireAppendOnly(before, after) {
  const afterById = new Map(after.reviews.map((r) => [r.id, r]));
  for (const record of before.reviews) {
    if (!isDeepStrictEqual(afterById.get(record.id), record))
      throw new Error("Changed or removed published review: " + record.id);
    if (
      !isDeepStrictEqual(
        after.submissions.get(record.id),
        before.submissions.get(record.id),
      )
    )
      throw new Error("Changed submission attribution: " + record.id);
  }
  enforceReviewOwnership(after.reviews, before.reviews);
}
