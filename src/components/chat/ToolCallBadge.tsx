"use client";

import { ToolInvocation } from "ai";
import { Loader2 } from "lucide-react";

export function getToolCallLabel(toolName: string, args: Record<string, unknown>): string {
  if (toolName === "str_replace_editor") {
    const command = args.command as string;
    const path = args.path as string | undefined;
    switch (command) {
      case "create":
        return `Creating ${path}`;
      case "str_replace":
      case "insert":
        return `Editing ${path}`;
      case "view":
        return `Reading ${path}`;
      case "undo_edit":
        return "Undoing edit";
    }
  }

  if (toolName === "file_manager") {
    const command = args.command as string;
    const path = args.path as string | undefined;
    switch (command) {
      case "rename":
        return `Renaming ${path}`;
      case "delete":
        return `Deleting ${path}`;
    }
  }

  return toolName
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface ToolCallBadgeProps {
  toolInvocation: ToolInvocation;
}

export function ToolCallBadge({ toolInvocation }: ToolCallBadgeProps) {
  const label = getToolCallLabel(
    toolInvocation.toolName,
    toolInvocation.args as Record<string, unknown>
  );
  const isDone = toolInvocation.state === "result" && "result" in toolInvocation && toolInvocation.result;

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-neutral-700">{label}</span>
        </>
      ) : (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
          <span className="text-neutral-700">{label}</span>
        </>
      )}
    </div>
  );
}
