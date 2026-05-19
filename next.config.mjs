/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // deck.gl-leaflet ships a UMD as its "browser" field which webpack picks up
  // and then complains "LeafletLayer is not a named export". Transpiling forces
  // Next to use the package's "module" / source build, which has proper ESM.
  transpilePackages: ['deck.gl-leaflet', '@deck.gl/core', '@deck.gl/layers'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
};

export default nextConfig;
