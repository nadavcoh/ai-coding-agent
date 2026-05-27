/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@octokit/rest"],
  },
};

export default nextConfig;
