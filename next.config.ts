import type { NextConfig } from "next";

// Deployed on Vercel, which runs the Next.js server (incl. the /api/extract
// route that calls the Anthropic API). No static-export overrides needed.
const nextConfig: NextConfig = {};

export default nextConfig;
