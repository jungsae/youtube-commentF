import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 정적 파일 생성 최적화
  output: 'standalone',

  // 이미지 최적화 설정
  images: {
    unoptimized: true
  },

  // 실험적 기능 설정
  experimental: {
    // 앱 라우터 최적화
    optimizePackageImports: ['@supabase/supabase-js']
  },

  // Webpack 설정
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 클라이언트 측 번들 최적화
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },

  // 정적 생성 설정
  trailingSlash: false,

  // 압축 설정
  compress: true,

  // 환경 변수 설정
  env: {
    CUSTOM_KEY: 'my-value',
  },
};

export default nextConfig;
