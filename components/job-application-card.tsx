"use client";

import { JobApplication, Column } from "@/lib/models/model-types";
import { Card, CardContent } from "./ui/card";
import { Edit2, ExternalLink, MoreVertical, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import {
  deleteJobApplication,
  updateJobApplication,
} from "@/lib/actions/job-applications";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { tryCatch } from "@/lib/helpers/tryCatch";
import React, { useState } from "react";
interface JobApplicationCardProps {
  job: JobApplication;
  columns: Column[];
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}

export default function JobApplicationCard({
  job,
  columns,
  dragHandleProps,
}: JobApplicationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    company: job.company,
    position: job.position,
    location: job.location || "",
    notes: job.notes || "",
    salary: job.salary || "",
    jobUrl: job.jobUrl || "",
    columnId: job.columnId || "",
    tags: job.tags?.join(", ") || "",
    description: job.description || "",
  });

  /**
   * Server actions fail in two ways: they throw on infrastructure problems and
   * return `{ error }` for expected ones like "Unauthorized". Both need to reach
   * the user, but only the returned message is safe to show verbatim.
   */
  function describeFailure(
    thrown: unknown,
    returned: string | undefined,
    fallback: string,
  ) {
    if (returned) return returned;
    console.error(fallback, thrown);
    return fallback;
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const { data: result, error: thrown } = await tryCatch(
      updateJobApplication(job._id, {
        ...formData,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
      }),
    );

    if (thrown || result?.error) {
      setError(
        describeFailure(
          thrown,
          result?.error,
          "Couldn't save your changes. Please try again.",
        ),
      );
      return;
    }

    setIsEditing(false);
  }

  async function handleDelete() {
    setError(null);

    const { data: result, error: thrown } = await tryCatch(
      deleteJobApplication(job._id),
    );

    if (thrown || result?.error) {
      setError(
        describeFailure(
          thrown,
          result?.error,
          "Couldn't delete this application. Please try again.",
        ),
      );
    }
  }

  async function handleMove(newColumnId: string) {
    setError(null);

    const { data: result, error: thrown } = await tryCatch(
      updateJobApplication(job._id, {
        columnId: newColumnId,
      }),
    );

    if (thrown || result?.error) {
      setError(
        describeFailure(
          thrown,
          result?.error,
          "Couldn't move this application. Please try again.",
        ),
      );
    }
  }
  return (
    <>
      <Card
        className="cursor-pointer transition-shadow hover:shadow-lg bg-white group shadow-sm"
        {...dragHandleProps}
      >
        <CardContent className="p-4">
          {error && !isEditing && (
            <div
              role="alert"
              className="mb-2 flex items-start justify-between gap-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Dismiss error"
                className="shrink-0 font-medium underline"
              >
                Dismiss
              </button>
            </div>
          )}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1">{job.position}</h3>
              <p className="text-xs text-muted-foreground mb-2">
                {job.company}
              </p>
              {job.description && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {job.description}
                </p>
              )}
              {job.tags && job.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {job.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {job.jobUrl && (
                <a
                  href={job.jobUrl}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="flex items-start gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label={`${job.position} options`}
                    />
                  }
                >
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setError(null);
                      setIsEditing(true);
                    }}
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  {columns.length > 1 && (
                    <>
                      {columns
                        .filter((c) => c._id !== job.columnId)
                        .map((column) => (
                          <DropdownMenuItem
                            key={column._id}
                            onClick={() => handleMove(column._id)}
                          >
                            Move to {column.name}
                          </DropdownMenuItem>
                        ))}
                    </>
                  )}
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDelete()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isEditing}
        onOpenChange={(open) => {
          setIsEditing(open);
          if (!open) setError(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Job Application</DialogTitle>
            <DialogDescription>
              Update the details of this application
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleUpdate}>
            <div className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
                >
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company *</Label>
                  <Input
                    id="company"
                    required
                    value={formData.company}
                    onChange={(e) =>
                      setFormData({ ...formData, company: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Position *</Label>
                  <Input
                    id="position"
                    required
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary">Salary</Label>
                  <Input
                    id="salary"
                    placeholder="e.g., $100k - $150k"
                    value={formData.salary}
                    onChange={(e) =>
                      setFormData({ ...formData, salary: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobUrl">Job URL</Label>
                <Input
                  id="jobUrl"
                  type="url"
                  placeholder="https://..."
                  value={formData.jobUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, jobUrl: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="React, Tailwind, High Pay"
                  value={formData.tags}
                  onChange={(e) =>
                    setFormData({ ...formData, tags: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  placeholder="Brief description of the role..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
