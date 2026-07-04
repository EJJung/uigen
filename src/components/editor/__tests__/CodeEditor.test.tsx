import { test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { useFileSystem } from "@/lib/contexts/file-system-context";

vi.mock("@/lib/contexts/file-system-context");

vi.mock("@monaco-editor/react", () => ({
  default: ({ value }: { value: string }) => (
    <div data-testid="monaco-editor">{value}</div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

test("shows no toolbar when no file is selected", () => {
  (useFileSystem as ReturnType<typeof vi.fn>).mockReturnValue({
    selectedFile: null,
    getFileContent: () => null,
    updateFile: vi.fn(),
  });

  render(<CodeEditor />);

  expect(screen.queryByTitle("Copy file content")).toBeNull();
});

test("shows the selected file path and copies its content on click", async () => {
  const writeText = mockClipboard();
  (useFileSystem as ReturnType<typeof vi.fn>).mockReturnValue({
    selectedFile: "/App.jsx",
    getFileContent: () => "export default function App() {}",
    updateFile: vi.fn(),
  });

  render(<CodeEditor />);

  expect(screen.getByText("/App.jsx")).toBeDefined();

  fireEvent.click(screen.getByTitle("Copy file content"));

  await waitFor(() => {
    expect(writeText).toHaveBeenCalledWith("export default function App() {}");
  });

  await waitFor(() => {
    expect(screen.getByTitle("Copied!")).toBeDefined();
  });
});

test("does not show the copied state when clipboard write fails", async () => {
  const writeText = vi.fn().mockRejectedValue(new Error("denied"));
  Object.assign(navigator, { clipboard: { writeText } });
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  (useFileSystem as ReturnType<typeof vi.fn>).mockReturnValue({
    selectedFile: "/App.jsx",
    getFileContent: () => "export default function App() {}",
    updateFile: vi.fn(),
  });

  render(<CodeEditor />);

  fireEvent.click(screen.getByTitle("Copy file content"));

  await waitFor(() => {
    expect(consoleSpy).toHaveBeenCalled();
  });
  expect(screen.queryByTitle("Copied!")).toBeNull();
});
