/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  rewrites: async () => {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL}/api/:path*`,
      },
      {
        source: "/docs",
        destination: `${process.env.API_URL}/docs`,
      },
      {
        source: "/openapi.json",
        destination: `${process.env.API_URL}/openapi.json`,
      },
    ];
  },
};

module.exports = nextConfig;
