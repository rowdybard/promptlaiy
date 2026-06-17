const gone = () =>
  Response.json(
    { ok: false, error: "This endpoint was retired in Promptlaiy V1." },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );

export const onRequest = () => gone();
