/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Azure App Service runs `node server.js`. Standalone emits that server plus
  // only the node_modules actually imported, which keeps the deployed payload
  // small enough that App Service starts promptly.
  output: "standalone",
};

export default nextConfig;
