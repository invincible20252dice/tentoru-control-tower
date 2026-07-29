import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    'funny-shoes-slide.loca.lt',
    'six-bushes-rule.loca.lt',
    '*.loca.lt',
    'localhost:3000'
  ]
};

export default nextConfig;
