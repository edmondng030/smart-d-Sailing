# OceanThreejs integration reference

The ocean renderer uses ideas studied from
[achrefelouafi/OceanThreejs](https://github.com/achrefelouafi/OceanThreejs),
an MIT-licensed Three.js ocean implementation by Mohamed Achref El Ouafi.

## Techniques retained

- Water IOR of 1.333 and Schlick Fresnel energy splitting.
- Cook-Torrance GGX sun highlights with Smith visibility.
- Beer-Lambert RGB absorption using an explicitly approximate path length.
- Wrapped, crest-local subsurface scattering.
- A shared procedural sky family for the visible horizon and water reflection.
- Above-water reflection rays are constrained to the sky hemisphere to avoid a screen-locked lower-sky band.
- Jacobian/compression-driven foam instead of a detached scrolling foam mask.

## Project-specific differences

- The existing deterministic, disjoint spectral cascades remain the source of
  displacement, derivatives, normals and persistent foam history.
- No extra Gerstner swell or repeated sampling of one FFT tile was imported;
  that would diverge from the CPU wave surface used by boat buoyancy.
- Spectral LOD stays camera-footprint based and continuous. Raw directional
  slope never tints the water body, preventing straight teal bands.
- Refraction does not claim reconstructed scene thickness. Until a depth-owned
  refraction pass exists, absorption uses the configured fallback depth.

No OceanThreejs source file is vendored into this project. The integration is a
project-native implementation of the cited optical principles.