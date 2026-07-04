# export-001: Code Export / Download — Design

**Status:** Approved
**Feature ID:** `export-001` (see `feature_list.json`)
**Date:** 2026-07-03

## Summary

Let users download the generated virtual file system as a ZIP archive, and copy the
currently-open file's content to the clipboard from the code editor. Both are read-only
operations against existing state — no new persistence, no VFS mutations.

## Scope

- ZIP download of the entire `VirtualFileSystem` for the current session/project.
- Copy-to-clipboard for the currently selected file in the code editor.
- Out of scope: per-file copy from the file tree (not needed for this iteration), export
  formats other than ZIP, server-side export.

## Architecture

### `src/lib/export/zip.ts`

```ts
export async function createProjectZip(files: Map<string, string>): Promise<Blob>
```

Uses `jszip` (new dependency) to build the archive from the `Map<path, content>` returned by
`VirtualFileSystem.getAllFiles()`. Paths are already normalized with a leading `/`; JSZip
treats these as folder structure. Returns a `Blob`. The caller is responsible for triggering
the browser download via `URL.createObjectURL` + a temporary `<a download>` click, consistent
with the blob-URL pattern already used in the preview pipeline (`PreviewFrame.tsx`).

### Filename

Slugify `project?.name` (lowercase, spaces/non-alphanumerics → hyphens) and use
`<slug>.zip`. Fall back to `uigen-export.zip` when there is no project or no name
(anonymous/unsaved sessions).

## Components

### `ExportButton` (`src/components/ExportButton.tsx`)

New client component (`"use client"`). Props: `{ projectName?: string }`.

- Reads `fileSystem` from `useFileSystem()`.
- On click: `fileSystem.getAllFiles()` → `createProjectZip()` → build filename → create
  object URL → programmatically click a temporary anchor with `download="<slug>.zip"` →
  revoke the object URL.
- Brief inline visual feedback on click (icon swaps to a checkmark for ~1.5s), matching the
  no-toast-library constraint of this codebase.
- Placed in `main-content.tsx`'s top bar, to the left of `HeaderActions`, so it is visible in
  both the Preview and Code tabs (it exports the whole project regardless of active view).

### `CodeEditor` toolbar (`src/components/editor/CodeEditor.tsx`)

Currently renders Monaco directly with no header. Add a thin toolbar row (`h-9`, dark theme
to match the editor) above the editor, shown only when `selectedFile` is set:

- Left: the selected file's path, truncated, monospace.
- Right: a copy icon button. On click, calls
  `navigator.clipboard.writeText(getFileContent(selectedFile))` and shows the same
  checkmark-flash feedback pattern as `ExportButton`.

The existing "select a file" empty state is unchanged — no toolbar when nothing is selected.

## Data Flow

Both features are read-only reads against existing `useFileSystem()` state
(`getAllFiles`, `getFileContent`). No new context, no new provider, no VFS mutation. The only
new prop threaded through is `project?.name` into `ExportButton` from `MainContent`.

## Error Handling

- ZIP generation is local/synchronous-ish and not expected to fail for valid input. Wrap in
  try/catch; on error, `console.error` and leave the button in its normal (non-feedback)
  state — no user-facing error UI for this edge case.
- `navigator.clipboard.writeText` can reject (e.g. permissions, non-secure context). Catch and
  `console.error`; do not show the "copied" checkmark if it fails. No legacy
  `document.execCommand("copy")` fallback — out of scope for this app.

## Testing

- `src/lib/export/__tests__/zip.test.ts` — unit tests for `createProjectZip`: produced archive
  contains the expected file paths/content (round-trip via `jszip.loadAsync`), and handles an
  empty file map.
- `src/components/__tests__/ExportButton.test.tsx` — mocks `useFileSystem`; asserts clicking
  triggers zip creation and a download (mock `URL.createObjectURL` and the anchor click).
- Add `src/components/editor/__tests__/CodeEditor.test.tsx` (does not yet exist) — asserts
  the copy button calls `navigator.clipboard.writeText` with the current file's content and
  shows the brief "copied" state.

## Dependencies

- Add `jszip` to `package.json` dependencies.
