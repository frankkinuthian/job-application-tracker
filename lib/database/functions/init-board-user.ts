import connectDB from "../index";
import { Board, Column } from "../../models";
import type { IBoard } from "../../models/board";
import { tryCatch, type Result } from "../../helpers/tryCatch";

const DEFAULT_COLUMNS = [
  {
    name: "Wish List",
    order: 0,
  },
  { name: "Applied", order: 1 },
  { name: "Interviewing", order: 2 },
  { name: "Offer", order: 3 },
  { name: "Rejected", order: 4 },
];

export async function initializeUserBoard(
  userId: string,
): Promise<Result<IBoard>> {
  // connectDB already returns a Result, so it doesn't need tryCatch
  const { error: connectionError } = await connectDB();

  if (connectionError) {
    return { data: null, error: connectionError };
  }

  // Check if board already exists
  const { data: existingBoard, error: existingBoardError } = await tryCatch(
    Board.findOne({ userId, name: "Job Hunt" }),
  );

  if (existingBoardError) {
    return { data: null, error: existingBoardError };
  }

  if (existingBoard) {
    return { data: existingBoard, error: null };
  }

  // Create the board
  const { data: board, error: boardError } = await tryCatch(
    Board.create({
      name: "Job Hunt",
      userId,
      columns: [],
    }),
  );

  if (boardError) {
    return { data: null, error: boardError };
  }

  // Create default columns
  const { data: columns, error: columnsError } = await tryCatch(
    Promise.all(
      DEFAULT_COLUMNS.map((col) =>
        Column.create({
          name: col.name,
          order: col.order,
          boardId: board._id,
          jobApplications: [],
        }),
      ),
    ),
  );

  if (columnsError) {
    return { data: null, error: columnsError };
  }

  // Update the board with the new column IDs
  board.columns = columns.map((col) => col._id);

  const { error: saveError } = await tryCatch(board.save());

  if (saveError) {
    return { data: null, error: saveError };
  }

  return { data: board, error: null };
}
