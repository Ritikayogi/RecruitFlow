/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
  webpack: (webpackConfig, { webpack, isServer, nextRuntime }) => {
    webpackConfig.plugins.push(
      // Remove node: from import specifiers, because Next.js does not yet support node: scheme
      // https://github.com/vercel/next.js/issues/28774
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "");
      }),
    );

    if (isServer) {
      webpackConfig.output.globalObject = "this";
    }

    if (nextRuntime === "edge") {
      if (webpackConfig.optimization) {
        webpackConfig.optimization.splitChunks = false;
      }
    }

    return webpackConfig;
  },
};

module.exports = nextConfig;
