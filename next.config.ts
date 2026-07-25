import type { NextConfig } from "next";
import { SECURITY_RESPONSE_HEADERS } from "./src/lib/security/response-headers";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
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
