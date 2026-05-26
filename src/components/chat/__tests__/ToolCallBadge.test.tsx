import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge, getToolCallLabel } from "../ToolCallBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

// --- getToolCallLabel unit tests ---

test("getToolCallLabel: str_replace_editor create", () => {
  expect(getToolCallLabel("str_replace_editor", { command: "create", path: "/App.jsx" })).toBe("Creating /App.jsx");
});

test("getToolCallLabel: str_replace_editor str_replace", () => {
  expect(getToolCallLabel("str_replace_editor", { command: "str_replace", path: "/components/Button.jsx" })).toBe("Editing /components/Button.jsx");
});

test("getToolCallLabel: str_replace_editor insert", () => {
  expect(getToolCallLabel("str_replace_editor", { command: "insert", path: "/App.jsx" })).toBe("Editing /App.jsx");
});

test("getToolCallLabel: str_replace_editor view", () => {
  expect(getToolCallLabel("str_replace_editor", { command: "view", path: "/App.jsx" })).toBe("Reading /App.jsx");
});

test("getToolCallLabel: str_replace_editor undo_edit", () => {
  expect(getToolCallLabel("str_replace_editor", { command: "undo_edit" })).toBe("Undoing edit");
});

test("getToolCallLabel: file_manager rename", () => {
  expect(getToolCallLabel("file_manager", { command: "rename", path: "/OldName.jsx" })).toBe("Renaming /OldName.jsx");
});

test("getToolCallLabel: file_manager delete", () => {
  expect(getToolCallLabel("file_manager", { command: "delete", path: "/OldName.jsx" })).toBe("Deleting /OldName.jsx");
});

test("getToolCallLabel: unknown tool falls back to capitalized name", () => {
  expect(getToolCallLabel("my_custom_tool", {})).toBe("My Custom Tool");
});

test("getToolCallLabel: hyphenated unknown tool falls back to capitalized name", () => {
  expect(getToolCallLabel("some-other-tool", {})).toBe("Some Other Tool");
});

// --- ToolCallBadge rendering tests ---

function makePendingInvocation(toolName: string, args: Record<string, unknown>): ToolInvocation {
  return { toolCallId: "tc-1", toolName, args, state: "call" } as ToolInvocation;
}

function makeCompletedInvocation(toolName: string, args: Record<string, unknown>): ToolInvocation {
  return { toolCallId: "tc-1", toolName, args, state: "result", result: "Success" } as ToolInvocation;
}

test("ToolCallBadge shows user-friendly label for create command", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeCompletedInvocation("str_replace_editor", { command: "create", path: "/App.jsx" })}
    />
  );
  expect(screen.getByText("Creating /App.jsx")).toBeDefined();
});

test("ToolCallBadge shows user-friendly label for str_replace command", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeCompletedInvocation("str_replace_editor", { command: "str_replace", path: "/App.jsx" })}
    />
  );
  expect(screen.getByText("Editing /App.jsx")).toBeDefined();
});

test("ToolCallBadge shows user-friendly label for view command", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeCompletedInvocation("str_replace_editor", { command: "view", path: "/App.jsx" })}
    />
  );
  expect(screen.getByText("Reading /App.jsx")).toBeDefined();
});

test("ToolCallBadge shows green dot when completed", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={makeCompletedInvocation("str_replace_editor", { command: "create", path: "/App.jsx" })}
    />
  );
  const greenDot = container.querySelector(".bg-emerald-500");
  expect(greenDot).toBeDefined();
  expect(greenDot).not.toBeNull();
});

test("ToolCallBadge shows spinner when pending", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={makePendingInvocation("str_replace_editor", { command: "create", path: "/App.jsx" })}
    />
  );
  const spinner = container.querySelector(".animate-spin");
  expect(spinner).toBeDefined();
  expect(spinner).not.toBeNull();
  // no green dot
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("ToolCallBadge shows fallback label for unknown tool", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeCompletedInvocation("some_custom_tool", {})}
    />
  );
  expect(screen.getByText("Some Custom Tool")).toBeDefined();
});

test("ToolCallBadge shows file_manager delete label", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeCompletedInvocation("file_manager", { command: "delete", path: "/OldFile.jsx" })}
    />
  );
  expect(screen.getByText("Deleting /OldFile.jsx")).toBeDefined();
});

test("ToolCallBadge does not show raw tool name str_replace_editor", () => {
  render(
    <ToolCallBadge
      toolInvocation={makeCompletedInvocation("str_replace_editor", { command: "create", path: "/App.jsx" })}
    />
  );
  expect(screen.queryByText("str_replace_editor")).toBeNull();
});
