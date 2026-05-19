// Re-export the package's main types under the explicit ESM subpath we
// import in SatelliteOverlay.tsx. See that file for the rationale.
declare module 'deck.gl-leaflet/dist/deck.gl-leaflet.esm.js' {
  export * from 'deck.gl-leaflet';
}
