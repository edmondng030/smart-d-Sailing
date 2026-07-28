import * as THREE from 'three';
import { QUALITY_PRESETS } from '../config.js';

export function createRenderer(canvas, initialQuality) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  function applyQuality(name, sunLight) {
    const quality = QUALITY_PRESETS[name] || QUALITY_PRESETS.high;
    renderer.setPixelRatio(Math.min(devicePixelRatio, quality.pixelRatio));
    renderer.setSize(innerWidth, innerHeight, false);
    if (sunLight) sunLight.shadow.mapSize.setScalar(quality.shadowSize);
    return quality;
  }
  applyQuality(initialQuality);
  return { renderer, applyQuality };
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 6000);
  camera.position.set(0, 4.8, 10.5);
  return camera;
}
