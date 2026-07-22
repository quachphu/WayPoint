// Landing AI document extraction — turns a confirmation PDF/photo into raw
// text/markdown so the normalization step (importPipeline.ts) can pull
// structured flight/hotel/activity fields out of it. No local PDF/OCR
// library needed; Landing AI's ADE API does that server-side.
//
// Verified live against the ADE endpoint on 2026-07-21 with the hackathon key:
// POST https://api.va.landing.ai/v1/ade/parse, Authorization: Basic <key>,
// multipart/form-data with a `document` file field (NOT JSON+base64 — that
// shape returns a 422 "must provide document or document_url"). Response is
// `{ markdown, chunks, splits, ... }`; `markdown` is the full extracted text.

const ADE_ENDPOINT = 'https://api.va.landing.ai/v1/ade/parse';

function landingAiKey(): string | undefined {
  return process.env.LANDING_AI_KEY || process.env.landing_ai;
}

export async function extractDocument(base64: string, mimeType: string): Promise<{ text: string } | null> {
  const key = landingAiKey();
  if (!key) {
    console.error('[landingAi] no key configured (LANDING_AI_KEY / landing_ai)');
    return null;
  }
  try {
    const buffer = Buffer.from(base64, 'base64');
    const form = new FormData();
    form.append('document', new Blob([buffer], { type: mimeType }), 'document');
    const res = await fetch(ADE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Basic ${key}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[landingAi] extract failed:', res.status, body.slice(0, 300));
      return null;
    }
    const data = await res.json();
    const text = data?.markdown ?? data?.text ?? null;
    if (!text) {
      console.error('[landingAi] extract returned no text field:', JSON.stringify(data).slice(0, 300));
      return null;
    }
    return { text };
  } catch (err) {
    console.error('[landingAi] extract error:', err);
    return null;
  }
}
