import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "flagcdn.com" },
      { protocol: "https", hostname: "crests.football-data.org" },
      // Higgsfield-delivered stylized assets land on Supabase storage
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default nextConfig;
