import { auth, stream } from '@mindstudio-ai/agent';
import { runImport } from './common/importPipeline';

// Browser upload/photo entry point. The file arrives as a data URI (same
// client-side pattern the profile-photo upload already uses — no multipart,
// no object storage) rather than the raw base64 the shared pipeline expects.
function splitDataUrl(dataUrl: string): { base64: string; mimeType: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) throw new Error('Expected a data URL (data:<mime>;base64,<data>).');
  return { mimeType: m[1], base64: m[2] };
}

export async function importDocument(input: { tripId?: string; fileDataUrl: string; fileName: string }) {
  const userId = auth.userId;
  if (!userId) throw new Error('Please sign in to import a document.');
  if (!input.fileDataUrl) throw new Error('No file provided.');

  await stream({ type: 'status', text: 'Reading your document' });
  const { base64, mimeType } = splitDataUrl(input.fileDataUrl);

  const result = await runImport({
    userId,
    tripId: input.tripId ?? null,
    base64,
    mimeType,
    fileName: input.fileName,
  });

  await stream({ type: 'status', text: '' });
  return result;
}
