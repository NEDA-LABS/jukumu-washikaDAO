import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ['pg', 'officeparser', 'pdf-parse'],
  webpack: (config: any) => {
    config.externals.push('pg-native');
    return config;
  }
};

export default nextConfig;
