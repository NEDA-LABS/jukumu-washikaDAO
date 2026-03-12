import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pg'],
  eslint: {
    ignoreDuringBuilds: true
  },
  webpack: (config: any) => {
    config.externals.push('pg-native');
    return config;
  }
};

export default nextConfig;
