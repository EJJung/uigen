import { test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ExportButton } from "@/components/ExportButton";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import { createProjectZip } from "@/lib/export/zip";

vi.mock("@/lib/contexts/file-system-context");
vi.mock("@/lib/export/zip");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setupDomMocks() {
  const clickSpy = vi.fn();
  let lastAnchor: HTMLAnchorElement | null = null;
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    const el = originalCreateElement(tag);
    if (tag === "a") {
      el.click = clickSpy;
      lastAnchor = el as HTMLAnchorElement;
    }
    return el;
  });

  const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
  const revokeObjectURL = vi.fn();
  (URL as any).createObjectURL = createObjectURL;
  (URL as any).revokeObjectURL = revokeObjectURL;

  return { clickSpy, createObjectURL, revokeObjectURL, getLastAnchor: () => lastAnchor };
}

test("clicking Download builds a zip and triggers a file download named after the project", async () => {
  const mockFiles = new Map([["/App.jsx", "content"]]);
  (useFileSystem as ReturnType<typeof vi.fn>).mockReturnValue({
    getAllFiles: () => mockFiles,
  });

  const fakeBlob = new Blob(["zip-bytes"]);
  (createProjectZip as ReturnType<typeof vi.fn>).mockResolvedValue(fakeBlob);

  const { clickSpy, createObjectURL, revokeObjectURL, getLastAnchor } = setupDomMocks();

  render(<ExportButton projectName="My Design" />);

  fireEvent.click(screen.getByRole("button", { name: /download/i }));

  await waitFor(() => {
    expect(createProjectZip).toHaveBeenCalledWith(mockFiles);
  });

  expect(createObjectURL).toHaveBeenCalledWith(fakeBlob);
  expect(getLastAnchor()?.download).toBe("my-design.zip");
  expect(clickSpy).toHaveBeenCalled();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

  await waitFor(() => {
    expect(screen.getByText("Downloaded")).toBeDefined();
  });
});

test("falls back to uigen-export.zip when no project name is given", async () => {
  (useFileSystem as ReturnType<typeof vi.fn>).mockReturnValue({
    getAllFiles: () => new Map([["/App.jsx", "content"]]),
  });
  (createProjectZip as ReturnType<typeof vi.fn>).mockResolvedValue(new Blob(["zip-bytes"]));

  const { getLastAnchor } = setupDomMocks();

  render(<ExportButton />);

  fireEvent.click(screen.getByRole("button", { name: /download/i }));

  await waitFor(() => {
    expect(getLastAnchor()?.download).toBe("uigen-export.zip");
  });
});

test("logs and does not show the Downloaded state when zip creation fails", async () => {
  (useFileSystem as ReturnType<typeof vi.fn>).mockReturnValue({
    getAllFiles: () => new Map(),
  });
  (createProjectZip as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  render(<ExportButton projectName="My Design" />);

  fireEvent.click(screen.getByRole("button", { name: /download/i }));

  await waitFor(() => {
    expect(consoleSpy).toHaveBeenCalled();
  });
  expect(screen.queryByText("Downloaded")).toBeNull();
});
