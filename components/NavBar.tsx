import { Briefcase } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button, buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback } from "./ui/avatar";
import SignOutButton from "./sign-out-btn";

export const NavBar = async () => {
  const session = await getSession();
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="container mx-auto flex h-16 items-center px-4 justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-semibold text-primary"
        >
          <Briefcase />
          Job Tracker.
        </Link>

        <div className="flex items-center gap-4">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "text-gray-700 hover:text-black",
                )}
              >
                Dashboard
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      className="relative h-8 w-8 rounded-full"
                    />
                  }
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-white">
                      {session.user.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {session.user.name}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {session.user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  <SignOutButton />
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "text-gray-700 hover:text-black",
                )}
              >
                Sign In
              </Link>

              <Link
                href="/sign-up"
                className={cn(
                  buttonVariants(),
                  "bg-primary hover:bg-primary/90",
                )}
              >
                Start for free.
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
