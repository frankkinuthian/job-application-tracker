import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { initializeUserBoard } from "../database/functions/init-board-user";

const client = new MongoClient(process.env.MONGODB_URI!, {
  serverSelectionTimeoutMS: 5000,
});
const db = client.db();

export const auth = betterAuth({
  //...
  database: mongodbAdapter(db, {
    client,
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Initialize user board after account creation
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (!user.id) return;

          const { error } = await initializeUserBoard(user.id);

          if (error) {
            // Don't fail signup: the account exists, the board can be
            // created lazily on the next dashboard visit.
            console.error(
              `Failed to initialize board for user ${user.id}:`,
              error,
            );
          }
        },
      },
    },
  },
});

export async function getSession() {
  const result = await auth.api.getSession({
    headers: await headers(),
  });

  return result;
}

export async function signOut() {
  "use server";

  const result = await auth.api.signOut({
    headers: await headers(),
  });

  if (result.success) {
    redirect("/sign-in");
  }
}
