import JSZip from "jszip";

export async function createProjectZip(
  files: Map<string, string>
): Promise<Blob> {
  const zip = new JSZip();

  for (const [path, content] of files) {
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    zip.file(normalizedPath, content);
  }

  return zip.generateAsync({ type: "blob" });
}
