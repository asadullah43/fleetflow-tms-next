import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone', // for the Docker image (backend/Dockerfile-style multi-stage build)
  turbopack: {
    // Repo root has its own package-lock.json (proto codegen tooling),
    // which otherwise confuses Next's workspace-root auto-detection.
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
