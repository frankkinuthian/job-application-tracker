"use server";

import { revalidatePath } from "next/cache";
import connectDB from "../database";
import { Board, Column, JobApplication } from "../models";
import { getSession } from "../auth";
import { orderBetween } from "../helpers/fractional-order";
import { resolveOrder } from "../database/functions/position-job";

interface JobApplicationData {
  company: string;
  position: string;
  location?: string;
  notes?: string;
  salary?: string;
  jobUrl?: string;
  columnId: string;
  boardId: string;
  tags?: string[];
  description?: string;
}

export async function createJobApplication(data: JobApplicationData) {
  const session = await getSession();

  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  await connectDB();

  const {
    company,
    position,
    location,
    notes,
    salary,
    jobUrl,
    columnId,
    boardId,
    tags,
    description,
  } = data;

  if (!company || !position || !columnId || !boardId) {
    return { error: "Missing required fields" };
  }

  // Verify board ownership
  const board = await Board.findOne({
    _id: boardId,
    userId: session.user.id,
  });

  if (!board) {
    return { error: "Board not found" };
  }

  // Verify column belongs to board

  const column = await Column.findOne({
    _id: columnId,
    boardId: boardId,
  });

  if (!column) {
    return { error: "Column not found" };
  }

  const lastJob = (await JobApplication.findOne({ columnId })
    .sort({ order: -1 })
    .select("order")
    .lean()) as { order: number } | null;

  const jobApplication = await JobApplication.create({
    company,
    position,
    location,
    notes,
    salary,
    jobUrl,
    columnId,
    boardId,
    userId: session.user.id,
    tags: tags || [],
    description,
    status: "applied",
    // Append: no neighbour on the right.
    order: orderBetween(lastJob?.order, undefined),
  });

  revalidatePath("/dashboard");

  return { data: JSON.parse(JSON.stringify(jobApplication)) };
}

export async function updateJobApplication(
  id: string,
  updates: {
    company?: string;
    position?: string;
    location?: string;
    notes?: string;
    salary?: string;
    jobUrl?: string;
    columnId?: string;
    order?: number;
    tags?: string[];
    description?: string;
  },
) {
  const session = await getSession();

  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  await connectDB();

  const jobApplication = await JobApplication.findById(id);

  if (!jobApplication) {
    return { error: "Job application not found" };
  }

  if (jobApplication.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  const { columnId, order, ...otherUpdates } = updates;

  const updatesToApply: Partial<{
    company: string;
    position: string;
    location: string;
    notes: string;
    salary: string;
    jobUrl: string;
    columnId: string;
    order: number;
    tags: string[];
    description: string;
  }> = otherUpdates;

  const currentColumnId = jobApplication.columnId.toString();
  const newColumnId = columnId?.toString();
  const targetColumnId = newColumnId || currentColumnId;

  const isMovingToDifferentColumn =
    newColumnId && newColumnId !== currentColumnId;

  const isRepositioning =
    (order !== undefined && order !== null) || isMovingToDifferentColumn;

  if (isRepositioning) {
    // A missing index means "append", which is what the move-to-column menu
    // sends.
    updatesToApply.order = await resolveOrder(targetColumnId, id, order);

    if (isMovingToDifferentColumn) {
      updatesToApply.columnId = newColumnId;
    }
  }

  // Single write: the card owns its own position, so no neighbours are touched
  // and no column ref arrays need updating.
  const updated = await JobApplication.findByIdAndUpdate(id, updatesToApply, {
    new: true,
  });

  revalidatePath("/dashboard");

  return { data: JSON.parse(JSON.stringify(updated)) };
}

export async function deleteJobApplication(id: string) {
  const session = await getSession();

  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  await connectDB();

  const jobApplication = await JobApplication.findById(id);

  if (!jobApplication) {
    return { error: "Job application not found" };
  }

  if (jobApplication.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  await JobApplication.deleteOne({ _id: id });
  revalidatePath("/dashboard");

  return { success: true };
}
