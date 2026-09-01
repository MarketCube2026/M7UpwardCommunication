const UPSTREAM_ORIGIN = "https://zhibi-public-beta.vercel.app";

export default {
  async fetch(request: Request): Promise<Response> {
    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, UPSTREAM_ORIGIN);
    const upstreamRequest = new Request(upstreamUrl, request);
    upstreamRequest.headers.set("X-Forwarded-Host", incomingUrl.host);
    upstreamRequest.headers.set("X-Forwarded-Proto", "https");

    const upstreamResponse = await fetch(upstreamRequest, { redirect: "manual" });
    const headers = new Headers(upstreamResponse.headers);
    const location = headers.get("Location");
    if (location) {
      const redirectUrl = new URL(location, UPSTREAM_ORIGIN);
      if (redirectUrl.origin === UPSTREAM_ORIGIN) {
        redirectUrl.protocol = incomingUrl.protocol;
        redirectUrl.host = incomingUrl.host;
        headers.set("Location", redirectUrl.toString());
      }
    }
    headers.set("X-Robots-Tag", "noindex, nofollow");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  },
};
