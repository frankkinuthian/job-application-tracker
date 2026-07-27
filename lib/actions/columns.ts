"use server";

import { revalidatePath, updateTag } from "next/cache";
import connectDB from "../database";
import { Board, Column, JobApplication } from "../models";
import { getSession } from "../auth";
import { boardTag } from "../helpers/board-status";

/**
 * Deletes an empty column.
 *
 * Deliberately refuses to cascade: a column holding cards has to be emptied
 * first. Silently destroying a user's applications because they clicked a menu
 * item is not a recoverable mistake, and there's no undo here.
 */
export async function deleteColumn(columnId: string) {
  const session = await getSession();

  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  await connectDB();

  const column = await Column.findById(columnId);

  if (!column) {
    return { error: "Column not found" };
  }

  // Columns carry no userId, so ownership is established through the board.
  const board = await Board.findOne({
    _id: column.boardId,
    userId: session.user.id,
  }).select("_id");

  if (!board) {
    return { error: "Unauthorized" };
  }

  const cardCount = await JobApplication.countDocuments({ columnId });

  if (cardCount > 0) {
    return {
      error:
        cardCount === 1
          ? "Move or delete the card in this column first."
          : `Move or delete the ${cardCount} cards in this column first.`,
    };
  }

  const remainingColumns = await Column.countDocuments({
    boardId: column.boardId,
  });

  if (remainingColumns <= 1) {
    return { error: "A board needs at least one column." };
  }

  const boardId = column.boardId.toString();

  await Column.deleteOne({ _id: columnId });
  await Board.findByIdAndUpdate(boardId, {
    $pull: { columns: columnId },
  });

  updateTag(boardTag(boardId));
  revalidatePath("/dashboard");

  return { success: true };
}
