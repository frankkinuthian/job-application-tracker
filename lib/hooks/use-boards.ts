"use client";

import { useState } from "react";
import { Board, Column, JobApplication } from "@/lib/models/model-types";
import { updateJobApplication } from "../actions/job-applications";
import { tryCatch } from "../helpers/tryCatch";

export function useBoard(initialBoard?: Board | null) {
  const [board, setBoard] = useState<Board | null>(initialBoard || null);
  const [columns, setColumns] = useState<Column[]>(initialBoard?.columns || []);
  const [error, setError] = useState<string | null>(null);

  // Re-sync when the server sends a new board (e.g. after revalidatePath).
  // Adjusting state during render is the supported alternative to doing this
  // in an effect, which would trigger a cascading re-render.
  const [syncedBoard, setSyncedBoard] = useState(initialBoard);

  if (initialBoard && initialBoard !== syncedBoard) {
    setSyncedBoard(initialBoard);
    setBoard(initialBoard);
    setColumns(initialBoard.columns || []);
  }

  async function moveJob(
    jobApplicationId: string,
    newColumnId: string,
    newOrder: number,
  ) {
    // Snapshot for rollback if the server rejects the move.
    const previousColumns = columns;

    setError(null);

    setColumns((prev) => {
      const newColumns = prev.map((col) => ({
        ...col,
        jobApplications: [...col.jobApplications],
      }));

      // Find and remove job from the old column

      let jobToMove: JobApplication | null = null;
      let oldColumnId: string | null = null;

      for (const col of newColumns) {
        const jobIndex = col.jobApplications.findIndex(
          (j) => j._id === jobApplicationId,
        );
        if (jobIndex !== -1 && jobIndex !== undefined) {
          jobToMove = col.jobApplications[jobIndex];
          oldColumnId = col._id;
          col.jobApplications = col.jobApplications.filter(
            (job) => job._id !== jobApplicationId,
          );
          break;
        }
      }

      if (jobToMove && oldColumnId) {
        const targetColumnIndex = newColumns.findIndex(
          (col) => col._id === newColumnId,
        );
        if (targetColumnIndex !== -1) {
          const targetColumn = newColumns[targetColumnIndex];
          const currentJobs = targetColumn.jobApplications || [];

          const updatedJobs = [...currentJobs];
          updatedJobs.splice(newOrder, 0, {
            ...jobToMove,
            columnId: newColumnId,
            order: newOrder * 100,
          });

          const jobsWithUpdatedOrders = updatedJobs.map((job, idx) => ({
            ...job,
            order: idx * 100,
          }));

          newColumns[targetColumnIndex] = {
            ...targetColumn,
            jobApplications: jobsWithUpdatedOrders,
          };
        }
      }

      return newColumns;
    });

    const { data: result, error: requestError } = await tryCatch(
      updateJobApplication(jobApplicationId, {
        columnId: newColumnId,
        order: newOrder,
      }),
    );

    // The action reports failures as a value, so both branches need checking.
    const failure = requestError
      ? "Couldn't save that move. Please try again."
      : result?.error;

    if (failure) {
      console.error("Failed to move job application:", requestError ?? failure);
      setColumns(previousColumns);
      setError(failure);
    }
  }

  return { board, columns, error, moveJob };
}
