// Tiny helper extracted out of @/lib/pdf so that callers needing only the
// download utility don't drag the entire @react-pdf/renderer bundle (~490 KB
// gzipped) into their route chunk.
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}