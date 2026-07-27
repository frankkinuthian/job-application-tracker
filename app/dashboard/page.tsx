import { getSession } from "@/lib/auth";
import connectDB from "@/lib/database";
import { Board, Column, JobApplication } from "@/lib/models";
import type {
  Board as BoardDTO,
  Column as ColumnDTO,
  JobApplication as JobApplicationDTO,
} from "@/lib/models/model-types";
import { redirect } from "next/navigation";
import KanbanBoard from "@/components/kanban-board";
import { Suspense } from "react";
import { LoaderOne } from "@/components/ui/loader";

/**
 * Assembles the board the client needs: columns in order, each with its cards
 * in order. Card membership comes from JobApplication.columnId (indexed), not
 * from a ref array on the column, so the two sides can't drift apart.
 */
async function getBoard(userId: string): Promise<BoardDTO | null> {
  "use cache";

  await connectDB();

  const boardDoc = await Board.findOne({
    userId: userId,
    name: "Job Hunt",
  }).lean();

  if (!boardDoc) return null;

  const [columnDocs, jobDocs] = await Promise.all([
    Column.find({ boardId: boardDoc._id }).sort({ order: 1 }).lean(),
    JobApplication.find({ boardId: boardDoc._id }).sort({ order: 1 }).lean(),
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
    _id: String(boardDoc._id),
    name: boardDoc.name,
    columns,
  };
}

async function DashboardPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/sign-in");
  }

  const board = await getBoard(session.user.id);

  if (!board) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md rounded-md bg-destructive/15 p-4 text-center">
          <h1 className="mb-2 text-lg font-semibold text-destructive">
            We couldn&apos;t find your board
          </h1>
          <p className="text-sm text-gray-700">
            Your board hasn&apos;t been set up yet. Try signing out and back in,
            or refresh the page.
          </p>
        </div>
      </div>
    );
  }

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
