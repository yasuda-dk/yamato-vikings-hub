import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { corsHeaders, handleCors, jsonResponse } from './cors.ts';

Deno.test('handleCors returns an OPTIONS response', () => {
  const response = handleCors(new Request('http://localhost', { method: 'OPTIONS' }));

  assertEquals(response?.status, 200);
  assertEquals(response?.headers.get('Access-Control-Allow-Origin'), corsHeaders['Access-Control-Allow-Origin']);
});

Deno.test('jsonResponse serializes JSON with CORS headers', async () => {
  const response = jsonResponse({ ok: true }, 201);

  assertEquals(response.status, 201);
  assertEquals(response.headers.get('Content-Type'), 'application/json');
  assertEquals(await response.json(), { ok: true });
});
