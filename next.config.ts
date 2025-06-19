import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  
  // GCP Load Balancer를 위한 설정
  assetPrefix: process.env.NODE_ENV === 'production' 
    ? 'https://veo.kakao-ai-hackathon-mzc.com' 
    : undefined,
    
  // 정적 파일 최적화
  trailingSlash: false,
  
  // 보안 헤더 설정
  async headers() {
    return [
      {
        // 모든 정적 파일에 적용
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        // 폰트 파일에 적용
        source: '/_next/static/media/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
  
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    // ignoreBuildErrors: true,
  },
  
  // 개발 환경에서 허용할 Origins
  experimental: {
    allowedRevalidateHeaderKeys: ['host'],
  },
};

export default nextConfig;
