import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const isPagesBuild = process.env.CLOUDFLARE_PAGES === "true";

export default withSerwist({
  reactStrictMode: true,
  outputFileTracingRoot: new URL(".", import.meta.url).pathname,
  output: isPagesBuild ? "export" : undefined,
  images: isPagesBuild ? { unoptimized: true } : undefined,
});
