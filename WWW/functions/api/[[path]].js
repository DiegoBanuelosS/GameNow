const API_ORIGIN = "https://gamenow-api.fly.dev";

export async function onRequest(context) {
  const incoming = new URL(context.request.url);
  const target = new URL(incoming.pathname + incoming.search, API_ORIGIN);
  const headers = new Headers(context.request.headers);
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", "https");
  headers.delete("host");
  const method = context.request.method;
  const response = await fetch(target, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : context.request.body,
    redirect: "manual",
  });
  const out = new Headers(response.headers);
  out.delete("content-encoding");
  return new Response(response.body, { status: response.status, headers: out });
}
