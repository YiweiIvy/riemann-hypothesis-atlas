import { enforceReviewOwnership, mergeReviews } from "./trust.mjs";

// The public atlas can accept a record between visits, after its author
// has already written private amendments. Keep the full local chain on disk.
export function reconcilePersonalReviews(records, published) {
  const personal = mergeReviews(records);
  const accepted = new Map(published.map((review) => [review.id, review]));
  const archivedIds = new Set();
  const archived = [];
  const active = [];
  // mergeReviews orders predecessors before their successors.
  for (const review of personal) {
    const publicCopy = accepted.get(review.id);
    const conflict = publicCopy
      ? JSON.stringify(review) !== JSON.stringify(publicCopy)
      : accepted.has(review.supersedes) || archivedIds.has(review.supersedes);
    if (conflict) {
      archivedIds.add(review.id);
      archived.push(review);
    } else {
      active.push(review);
    }
  }
  return { personal, archived, combined: enforceReviewOwnership(active, published) };
}
