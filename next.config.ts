import type { NextConfig } from "next";
import { SECURITY_RESPONSE_HEADERS } from "./src/core/security/response-headers";

const STATIC_ASSET_CACHE = "public, max-age=31536000, immutable";
const SW_CACHE = "public, max-age=0, must-revalidate";

const nextConfig: NextConfig = {
  // Solo para imagen Docker; Vercel no debe usar standalone.
  ...(process.env.DOCKER_BUILD === "true" ? { output: "standalone" as const } : {}),
  reactCompiler: true,
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "unpdf", "xlsx"],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/cmaps/**",
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "zod"],
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path(.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|woff2?))",
        headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE }],
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: SW_CACHE }],
      },
      {
        source: "/sw-portal.js",
        headers: [{ key: "Cache-Control", value: SW_CACHE }],
      },
      // Do not attach CSP to static assets (SVG-as-<img> breaks when the asset itself carries CSP).
      {
        source: "/:path((?!.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|woff2?)$).*)",
        headers: [...SECURITY_RESPONSE_HEADERS],
      },
    ];
  },
};

export default nextConfig;
