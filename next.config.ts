import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Googleアカウントのプロフィール画像（アバター表示用）をnext/imageで扱えるようにする
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
