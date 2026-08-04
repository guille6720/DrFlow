import type { NextConfig } from "next";
import { SECURITY_RESPONSE_HEADERS } from "./src/lib/security/response-headers";

const nextConfig: NextConfig = {
  // Solo para imagen Docker; Vercel no debe usar standalone.
  ...(process.env.DOCKER_BUILD === "true" ? { output: "standalone" as const } : {}),
  reactCompiler: true,
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "unpdf", "xlsx"],
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
    optimizePackageImports: ["lucide-react", "date-fns"],
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...SECURITY_RESPONSE_HEADERS],
      },
    ];
  },
};

export default nextConfig;
