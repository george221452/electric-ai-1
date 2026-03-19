/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude sharp and other native modules from client-side bundle
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });
    
    // Exclude @xenova/transformers from client-side
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@xenova/transformers': false,
      };
    }
    
    return config;
  },
  
  // Transpile specific packages
  transpilePackages: ['@xenova/transformers', '@radix-ui/react-tabs', '@radix-ui/react-primitive'],
  
  // Environment variables that should be available at build time
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
  
  // Experimental features
  experimental: {
    // Permite fișiere mari în App Router
    serverComponentsExternalPackages: ['fluent-ffmpeg'],
  },
};

module.exports = nextConfig;
