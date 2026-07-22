// Triggers a browser download of a data-URI's content — the standard trick,
// since RPC responses here are JSON/data-URI only (see ticket-import), never
// raw file bytes.
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
