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
        destination: `http://${process.env.API_URL}/api/:path*`,
      },
      {
        source: "/docs",
        destination: `http://${process.env.API_URL}/docs`,
      },
      {
        source: "/openapi.json",
        destination: `http://${process.env.API_URL}/openapi.json`,
      },
    ];
  },
};

module.exports = nextConfig;
