/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },

  // @react-pdf/renderer requires canvas and some Node.js modules to be excluded
  // from the client-side webpack bundle
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        canvas: false,
        path: false,
        stream: false,
        zlib: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
