import { getSession } from "@/lib/auth";
import { initializeUserBoard } from "@/lib/database/functions/init-board-user";
import { redirect } from "next/navigation";

const DashboardPage = async () => {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Idempotent: returns the existing board, or creates one if the
  // post-signup hook failed to.
  const { data: board, error } = await initializeUserBoard(session.user.id);

  if (error) {
    console.error(`Failed to load board for user ${session.user.id}:`, error);

    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md rounded-md bg-destructive/15 p-4 text-center">
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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-black">{board.name}</h1>
    </div>
  );
};

export default DashboardPage;
