import { test, expect } from "vitest";
import JSZip from "jszip";
import { createProjectZip } from "../zip";

test("creates a zip containing all files with their content, stripping the leading slash from paths", async () => {
  const files = new Map<string, string>([
    ["/App.jsx", "export default function App() { return null; }"],
    ["/components/Button.jsx", "export default function Button() { return null; }"],
  ]);

  const blob = await createProjectZip(files);
  const zip = await JSZip.loadAsync(blob);

  const appFile = zip.file("App.jsx");
  expect(appFile).not.toBeNull();
  expect(await appFile!.async("string")).toBe(files.get("/App.jsx"));

  const buttonFile = zip.file("components/Button.jsx");
  expect(buttonFile).not.toBeNull();
  expect(await buttonFile!.async("string")).toBe(files.get("/components/Button.jsx"));

  // No leading-slash entries should exist
  expect(zip.file("/App.jsx")).toBeNull();
});

test("creates an empty zip when there are no files", async () => {
  const blob = await createProjectZip(new Map());
  const zip = await JSZip.loadAsync(blob);

  expect(Object.keys(zip.files).length).toBe(0);
});
