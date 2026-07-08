import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    'six-bushes-rule.loca.lt',
    '*.loca.lt',
    'localhost:3000'
  ]
};

export default nextConfig;
