export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const loopback = (url: URL) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
export async function jsonBody(request: Request, maxBytes = 16384): Promise<unknown> {
  if (request.headers.get('Origin') !== new URL(request.url).origin) throw new HttpError(403, 'この画面から送信し直してください。');
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') throw new HttpError(415, '送信形式を確認してください。');
  if (Number(request.headers.get('Content-Length')) > maxBytes) throw new HttpError(413, '入力内容が長すぎます。');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, '入力内容を確認してください。');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, '入力内容が長すぎます。'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new HttpError(400, '入力内容を確認してください。'); }
}
export function errorResponse(error: unknown): Response {
  return Response.json({ message: error instanceof HttpError ? error.message : '処理を完了できませんでした。入力内容を残したまま、時間をおいて再度お試しください。' },
    { status: error instanceof HttpError ? error.status : 503 });
}
