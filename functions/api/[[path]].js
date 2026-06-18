export function onRequest() {
  return Response.json(
    { ok: false, error: "API route not found." },
    {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
