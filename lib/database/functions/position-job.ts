import { JobApplication } from "../../models";
import {
  ORDER_STEP,
  needsRenormalize,
  orderBetween,
} from "../../helpers/fractional-order";

type Sibling = { _id: unknown; order: number };

/**
 * Rewrites a column's sort keys back to clean ORDER_STEP spacing. Only runs
 * when repeated inserts into the same slot have exhausted the gap between two
 * neighbours. Writes absolute values, so a retry converges on the same result.
 */
async function renormalizeColumn(
  columnId: string,
  excludeId: string,
): Promise<Sibling[]> {
  const all: Sibling[] = await JobApplication.find({ columnId })
    .sort({ order: 1 })
    .select("order")
    .lean();

  if (all.length === 0) return [];

  await JobApplication.bulkWrite(
    all.map((job, index) => ({
      updateOne: {
        filter: { _id: job._id },
        update: { $set: { order: (index + 1) * ORDER_STEP } },
      },
    })),
  );

  return all
    .map((job, index) => ({ _id: job._id, order: (index + 1) * ORDER_STEP }))
    .filter((job) => String(job._id) !== excludeId);
}

/**
 * Resolves the sort key for dropping a card at `requestedIndex` within a
 * column. The index is interpreted against the column's cards *excluding* the
 * card being moved, which is the same space the client computes it in.
 *
 * Pass a null/undefined index to append to the end of the column.
 */
export async function resolveOrder(
  columnId: string,
  jobApplicationId: string,
  requestedIndex?: number | null,
): Promise<number> {
  let siblings: Sibling[] = await JobApplication.find({
    columnId,
    _id: { $ne: jobApplicationId },
  })
    .sort({ order: 1 })
    .select("order")
    .lean();

  // Clamp so a stale client index can't land out of bounds.
  const index = Math.max(
    0,
    Math.min(requestedIndex ?? siblings.length, siblings.length),
  );

  let prev = siblings[index - 1]?.order;
  let next = siblings[index]?.order;

  if (needsRenormalize(prev, next)) {
    siblings = await renormalizeColumn(columnId, jobApplicationId);
    prev = siblings[index - 1]?.order;
    next = siblings[index]?.order;
  }

  return orderBetween(prev, next);
}
