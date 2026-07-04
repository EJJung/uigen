"use client";

import { useState } from "react";
import { Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import { createProjectZip } from "@/lib/export/zip";

interface ExportButtonProps {
  projectName?: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ExportButton({ projectName }: ExportButtonProps) {
  const { getAllFiles } = useFileSystem();
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = async () => {
    try {
      const files = getAllFiles();
      const blob = await createProjectZip(files);

      const slug = projectName ? slugify(projectName) : "";
      const filename = slug ? `${slug}.zip` : "uigen-export.zip";

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 1500);
    } catch (error) {
      console.error("Failed to export project as ZIP:", error);
    }
  };

  return (
    <Button
      variant="outline"
      className="h-8 gap-2"
      onClick={handleDownload}
      title="Download project as ZIP"
    >
      {downloaded ? (
        <>
          <Check className="h-4 w-4" />
          Downloaded
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Download
        </>
      )}
    </Button>
  );
}
