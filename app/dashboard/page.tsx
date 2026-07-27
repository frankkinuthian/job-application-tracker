import { getSession } from "@/lib/auth";
import connectDB from "@/lib/database";
import { Board, Column, JobApplication } from "@/lib/models";
import type {
  Board as BoardDTO,
  Column as ColumnDTO,
  JobApplication as JobApplicationDTO,
} from "@/lib/models/model-types";
import { initializeUserBoard } from "@/lib/database/functions/init-board-user";
import { boardTag } from "@/lib/helpers/board-status";
import { cacheTag } from "next/cache";
import { redirect } from "next/navigation";
import KanbanBoard from "@/components/kanban-board";
import { Suspense } from "react";
import { LoaderOne } from "@/components/ui/loader";

/**
 * Resolves the user's board, creating it if the post-signup hook never got
 * there. Deliberately uncached: it's one indexed lookup, and caching it would
 * mean caching the "no board" state and defeating the recovery below.
 */
async function resolveBoard(userId: string) {
  await connectDB();

  const existing = await Board.findOne({
    userId,
    name: "Job Hunt",
  })
    .select("_id name")
    .lean();

  if (existing) {
    return { boardId: String(existing._id), name: existing.name, error: null };
  }

  // initializeUserBoard is idempotent, so a concurrent request racing us here
  // ends up with the same board rather than a duplicate.
  const { data, error } = await initializeUserBoard(userId);

  if (error || !data) {
    return { boardId: null, name: null, error: error ?? new Error("No board") };
  }

  return { boardId: String(data._id), name: data.name, error: null };
}

/**
 * Assembles the board the client needs: columns in order, each with its cards
 * in order. Card membership comes from JobApplication.columnId (indexed), not
 * from a ref array on the column, so the two sides can't drift apart.
 *
 * Keyed on boardId rather than userId, so it is only ever called once the board
 * is known to exist.
 */
async function getBoardData(
  boardId: string,
  boardName: string,
): Promise<BoardDTO> {
  "use cache";
  cacheTag(boardTag(boardId));

  await connectDB();

  const [columnDocs, jobDocs] = await Promise.all([
    Column.find({ boardId }).sort({ order: 1 }).lean(),
    JobApplication.find({ boardId }).sort({ order: 1 }).lean(),
  ]);

  // Bucket cards by column. Both queries are already sorted, so each bucket
  // comes out in order.
  const jobsByColumn = new Map<string, JobApplicationDTO[]>();

  for (const job of jobDocs) {
    const key = String(job.columnId);
    const dto: JobApplicationDTO = {
      _id: String(job._id),
      company: job.company,
      position: job.position,
      location: job.location,
      status: job.status,
      notes: job.notes,
      salary: job.salary,
      jobUrl: job.jobUrl,
      order: job.order,
      columnId: key,
      tags: job.tags,
      description: job.description,
    };

    const bucket = jobsByColumn.get(key);

    if (bucket) {
      bucket.push(dto);
    } else {
      jobsByColumn.set(key, [dto]);
    }
  }

  const columns: ColumnDTO[] = columnDocs.map((col) => ({
    _id: String(col._id),
    name: col.name,
    order: col.order,
    jobApplications: jobsByColumn.get(String(col._id)) ?? [],
  }));

  return {
    _id: boardId,
    name: boardName,
    columns,
  };
}

async function DashboardPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/sign-in");
  }

  const { boardId, name, error } = await resolveBoard(session.user.id);

  if (error || !boardId) {
    console.error(
      `Failed to resolve board for user ${session.user.id}:`,
      error,
    );

    return (
      <div className="container mx-auto px-4 py-16">
        <div
          role="alert"
          className="mx-auto max-w-md rounded-md bg-destructive/15 p-4 text-center"
        >
          <h1 className="mb-2 text-lg font-semibold text-destructive">
            We couldn&apos;t load your board
          </h1>
          <p className="text-sm text-gray-700">
            Something went wrong reaching the database. Refresh the page to try
            again.
          </p>
        </div>
      </div>
    );
  }

  const board = await getBoardData(boardId, name ?? "Job Hunt");

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-black">Job Hunt</h1>
          <p className="text-gray-600">Track your job applications</p>
        </div>
        <KanbanBoard board={board} userId={session.user.id} />
      </div>
    </div>
  );
}

export default async function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-100">
          <LoaderOne />
        </div>
      }
    >
      <DashboardPage />
    </Suspense>
  );
}
