import * as THREE from 'three';
import { createOceanDetailTexture } from './detail-texture.js';
import { validateFragmentIFFT } from './fft-pipeline.js';
import { SpectralOceanSystem } from './ocean-system.js';

const QUALITY = {
  low: { resolution: 64, detailSize: 128 },
  medium: { resolution: 128, detailSize: 192 },
  high: { resolution: 128, detailSize: 256 },
  ultra: { resolution: 256, detailSize: 384 }
};

function flatTexture(alpha = 0) {
  const data = new Uint8Array([0, 0, 0, Math.round(alpha * 255)]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function createSpectralLayer(renderer, qualityName = 'high') {
  const flatDisplacement = flatTexture(1);
  const flatDerivatives = flatTexture(0);
  const fallbackCascades = Array.from({ length: 3 }, () => ({
    displacement: flatDisplacement,
    derivatives: { texture: flatDerivatives }
  }));
  let detailTexture = null;
  let system = null;
  let currentQuality = null;
  let validation = { pass: false, reason: 'not-initialized' };

  function build(name) {
    const quality = QUALITY[name] || QUALITY.high;
    if (currentQuality === name && system) return;
    system?.dispose();
    detailTexture?.dispose();
    system = null;
    currentQuality = name;
    detailTexture = createOceanDetailTexture(quality.detailSize, 0x1f2e3d4c);

    if (!renderer?.capabilities?.isWebGL2 || !renderer?.extensions?.has?.('EXT_color_buffer_float')) {
      validation = { pass: false, reason: 'webgl2-float-targets-unavailable' };
      return;
    }

    try {
      validation = validateFragmentIFFT(renderer, 16);
      if (!validation.pass) return;
      system = new SpectralOceanSystem(renderer, {
        resolution: quality.resolution,
        patchLengths: [250, 17, 5],
        boundaryFactor: 6,
        gravity: 9.81,
        depth: 500,
        choppiness: 1.3,
        foamRecovery: .4,
        amplitude: 1,
        seed: 481516,
        local: {
          scale: .85,
          windSpeed: 13,
          directionDegrees: 14,
          fetchMeters: 100000,
          directionality: .82,
          swell: .2,
          peakEnhancement: 3.3,
          shortWaveFade: .02
        },
        swell: {
          scale: .48,
          windSpeed: 3,
          directionDegrees: 58,
          fetchMeters: 300000,
          directionality: .9,
          swell: 1,
          peakEnhancement: 3.3,
          shortWaveFade: .01
        }
      });
    } catch (error) {
      validation = { pass: false, reason: error instanceof Error ? error.message : String(error) };
      system?.dispose();
      system = null;
      renderer.setRenderTarget(null);
    }
  }

  function update(time, dt, waveIntensity) {
    if (!system) return;
    system.setIntensity(THREE.MathUtils.clamp(.72 + waveIntensity * .28, .65, 1.18));
    system.update(time, Math.max(dt, 1 / 120));
  }

  build(qualityName);
  return {
    get active() { return Boolean(system); },
    get cascades() { return system?.cascades || fallbackCascades; },
    get detailTexture() { return detailTexture; },
    get diagnostics() { return { ...validation, quality: currentQuality, resolution: QUALITY[currentQuality]?.resolution || 0 }; },
    update,
    setQuality: build,
    dispose() {
      system?.dispose();
      detailTexture?.dispose();
      flatDisplacement.dispose();
      flatDerivatives.dispose();
    }
  };
}
