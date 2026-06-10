Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: new Headers({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }),
    });
  }

  const url = new URL(req.url);
  const gameId = url.searchParams.get("id");

  if (!gameId) {
    return new Response("Missing game id", { status: 400 });
  }

  const deepLink = `ntusports://game/${gameId}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0;url=${deepLink}">
  <title>NTU Sports</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding:48px 24px;background:#f5f5f5">
  <h2 style="font-size:22px;margin-bottom:12px">Opening NTU Sports...</h2>
  <p style="color:#666;font-size:15px;margin-bottom:24px">If the app does not open automatically, tap the button below.</p>
  <a href="${deepLink}" style="display:inline-block;padding:14px 32px;background:#4CAF50;color:#fff;border-radius:12px;text-decoration:none;font-size:17px;font-weight:700">Open in NTU Sports</a>
</body>
</html>`;

  return new Response(new Blob([html], { type: "text/html; charset=utf-8" }), { status: 200 });
});
