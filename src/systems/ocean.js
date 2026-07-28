import * as THREE from 'three';
import { BASE_WAVES, QUALITY_PRESETS } from '../config.js';
import { createSpectralLayer } from './spectral/index.js';

const MAX_WAVES = 6;
const TAU = Math.PI * 2;
const tmpNormal = new THREE.Vector3();
const tmpSunDirection = new THREE.Vector3();

export const OCEAN_DEBUG_MODES = Object.freeze({
  final: 0, cascades: 1, normals: 2, foam: 3, fresnel: 4, reflection: 5, absorption: 6,
  'no-foam': 7, 'no-detail': 8, jacobian: 9, lod: 10
});

function normalisedDirection([x, y]) {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
}

function createAdaptiveOceanGeometry(size, segments) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  const positions = geometry.attributes.position;
  const half = size * .5;
  const nearScale = 96;
  for (let index = 0; index < positions.count; index += 1) {
    const normalizedX = positions.getX(index) / half;
    const normalizedY = positions.getY(index) / half;
    const remap = value => {
      const magnitude = Math.abs(value);
      return Math.sign(value) * (nearScale * magnitude + (half - nearScale) * magnitude ** 3);
    };
    positions.setXY(index, remap(normalizedX), remap(normalizedY));
  }
  positions.needsUpdate = true;
  geometry.computeBoundingSphere();
  return geometry;
}

export function createOceanSystem(scene, renderer, qualityName = 'high') {
  const spectral = createSpectralLayer(renderer, qualityName);
  const initialCascades = spectral.cascades;
  const waves = BASE_WAVES.map(wave => { const direction=normalisedDirection(wave.direction); return { ...wave, direction, baseDirection:[...direction], baseSpeed:wave.speed, currentAmplitude:wave.amplitude, targetAmplitude:wave.amplitude }; });
  const waveUniforms = Array.from({ length: MAX_WAVES }, () => new THREE.Vector4());
  const speedUniforms = new Float32Array(MAX_WAVES);
  const steepnessUniforms = new Float32Array(MAX_WAVES);
  const uniforms = {
    uTime: { value: 0 }, uWaveCount: { value: QUALITY_PRESETS[qualityName].waveCount }, uGeometryWaveCount: { value: 2 },
    uWaves: { value: waveUniforms }, uWaveSpeeds: { value: speedUniforms }, uSteepness: { value: steepnessUniforms },
    uDeep: { value: new THREE.Color('#082f4f') }, uMid: { value: new THREE.Color('#0f6681') },
    uShallow: { value: new THREE.Color('#3ca6a0') }, uHorizon: { value: new THREE.Color('#c9dde0') },
    uSky: { value: new THREE.Color('#8fc6df') },
    uSunColour: { value: new THREE.Color('#fff2d2') }, uSunDirection: { value: new THREE.Vector3(-.35, .72, .6).normalize() },
    uWindDirection: { value: new THREE.Vector2(1, .25).normalize() },
    uSpectralDisplacement0: { value: initialCascades[0].displacement },
    uSpectralDisplacement1: { value: initialCascades[1].displacement },
    uSpectralDisplacement2: { value: initialCascades[2].displacement },
    uSpectralDerivatives0: { value: initialCascades[0].derivatives.texture },
    uSpectralDerivatives1: { value: initialCascades[1].derivatives.texture },
    uSpectralDerivatives2: { value: initialCascades[2].derivatives.texture },
    uSpectralDetail: { value: spectral.detailTexture },
    uSpectralPatchLengths: { value: new THREE.Vector3(250, 17, 5) },
    uSpectralCascadeWeights: { value: new THREE.Vector3(1, .55, .28) },
    uSpectralTexelSize: { value: 1 / 128 },
    uSpectralGeometryStrength: { value: .03 }, uSpectralNormalStrength: { value: .68 }, uSpectralActive: { value: spectral.active ? 1 : 0 },
    uSpectralFoamThreshold: { value: .92 }, uSpectralFoamScale: { value: 5.5 },
    uAbsorption: { value: new THREE.Vector3(.105, .035, .018) }, uFallbackDepth: { value: 3.25 },
    uDetailStrength: { value: .1 }, uRoughness: { value: .055 }, uDebugMode: { value: OCEAN_DEBUG_MODES.final },
    uFoamThreshold: { value: .48 }, uWaveEnergy: { value: 1 }, uDetailLevel: { value: 1 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      #define MAX_WAVES 6
      uniform float uTime; uniform int uWaveCount; uniform int uGeometryWaveCount; uniform vec4 uWaves[MAX_WAVES];
      uniform float uWaveSpeeds[MAX_WAVES]; uniform float uSteepness[MAX_WAVES];
      uniform sampler2D uSpectralDisplacement0;
      uniform vec3 uSpectralPatchLengths; uniform float uSpectralTexelSize; uniform float uSpectralGeometryStrength;
      varying vec3 vWorld; varying vec3 vNormalW; varying vec2 vOceanXZ;
      varying float vCrest; varying float vSlope; varying float vHeight; varying float vSpectralHistory;
      void main() {
        vec4 baseWorld = modelMatrix * vec4(position.x, 0.0, position.y, 1.0);
        vec2 worldXZ = baseWorld.xz; float height = 0.0; vec2 horizontal = vec2(0.0); vec2 gradient = vec2(0.0); float crest = 0.0;
        float vertexFootprint =
          distance(cameraPosition.xz, worldXZ) * distance(cameraPosition.xz, worldXZ) * .001 /
          max(abs(cameraPosition.y - baseWorld.y), .5);
        for (int i = 0; i < MAX_WAVES; i++) {
          if (i >= uGeometryWaveCount) break;
          vec4 wave = uWaves[i]; float k = 6.28318530718 / wave.w;
          float waveKeep = 1.0 - smoothstep(wave.w * .12, wave.w * .45, vertexFootprint);
          float phase = k * dot(wave.xy, worldXZ) - uWaveSpeeds[i] * uTime;
          float sn = sin(phase); float cs = cos(phase);
          height += wave.z * sn * waveKeep;
          horizontal += wave.xy * (uSteepness[i] * wave.z * cs) * waveKeep;
          gradient += wave.xy * (wave.z * k * cs) * waveKeep;
          crest += smoothstep(0.55, 0.98, sn) * min(wave.z * k, 0.15) * waveKeep;
        }
        vec2 spectralUv0 = fract(worldXZ / uSpectralPatchLengths.x);
        vec2 spectralTexel = vec2(uSpectralTexelSize * 1.5, 0.0);
        vec4 spectral0 = (
          texture2D(uSpectralDisplacement0, spectralUv0) * 2.0 +
          texture2D(uSpectralDisplacement0, fract(spectralUv0 + spectralTexel)) +
          texture2D(uSpectralDisplacement0, fract(spectralUv0 - spectralTexel)) +
          texture2D(uSpectralDisplacement0, fract(spectralUv0 + spectralTexel.yx)) +
          texture2D(uSpectralDisplacement0, fract(spectralUv0 - spectralTexel.yx))
        ) / 6.0;
        float spectralKeep0 = 1.0 - smoothstep(1.2, 3.0, vertexFootprint);
        vec3 spectralDisplacement = spectral0.xyz * spectralKeep0;
        horizontal += spectralDisplacement.xz * uSpectralGeometryStrength;
        height += spectralDisplacement.y * uSpectralGeometryStrength;
        vec3 p = position; p.x += horizontal.x; p.y += horizontal.y; p.z = height;
        vec4 world = modelMatrix * vec4(p, 1.0); vWorld = world.xyz; vOceanXZ = worldXZ;
        vSpectralHistory = mix(1.0, spectral0.a, spectralKeep0);
        vNormalW = normalize(normalMatrix * vec3(-gradient.x, -gradient.y, 1.0));
        vCrest = crest; vSlope = length(gradient); vHeight = height;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      #define MAX_WAVES 6
      uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uShallow; uniform vec3 uHorizon;
      uniform vec3 uSky; uniform vec3 uSunColour; uniform vec3 uSunDirection; uniform vec2 uWindDirection;
      uniform vec3 uAbsorption; uniform float uFallbackDepth; uniform float uDetailStrength; uniform float uRoughness; uniform int uDebugMode;
      uniform float uTime; uniform float uFoamThreshold; uniform float uWaveEnergy; uniform float uDetailLevel;
      uniform int uWaveCount; uniform vec4 uWaves[MAX_WAVES]; uniform float uWaveSpeeds[MAX_WAVES];
      uniform sampler2D uSpectralDisplacement0; uniform sampler2D uSpectralDisplacement1; uniform sampler2D uSpectralDisplacement2;
      uniform sampler2D uSpectralDerivatives0; uniform sampler2D uSpectralDerivatives1; uniform sampler2D uSpectralDerivatives2;
      uniform sampler2D uSpectralDetail; uniform vec3 uSpectralPatchLengths; uniform vec3 uSpectralCascadeWeights;
      uniform float uSpectralNormalStrength; uniform float uSpectralActive; uniform float uSpectralFoamThreshold; uniform float uSpectralFoamScale;
      varying vec3 vWorld; varying vec3 vNormalW; varying vec2 vOceanXZ;
      varying float vCrest; varying float vSlope; varying float vHeight; varying float vSpectralHistory;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float valueNoise(vec2 p) {
        vec2 cell = floor(p); vec2 local = fract(p);
        local = local * local * (3.0 - 2.0 * local);
        float a = hash21(cell); float b = hash21(cell + vec2(1.0, 0.0));
        float c = hash21(cell + vec2(0.0, 1.0)); float d = hash21(cell + vec2(1.0));
        return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
      }

      float fbm(vec2 p) {
        mat2 octave = mat2(1.62, 1.18, -1.18, 1.62);
        float value = valueNoise(p) * .5;
        if (uDetailLevel < .52) return value * 1.55;
        p = octave * p + 17.13; value += valueNoise(p) * .24;
        if (uDetailLevel < .82) return value * 1.22;
        p = octave * p + 11.71; value += valueNoise(p) * .115;
        p = octave * p + 7.93; value += valueNoise(p) * .055;
        return value;
      }

      vec2 microSlope(vec2 p, float time, float footprint) {
        vec2 wind = normalize(uWindDirection);
        vec2 crossWind = vec2(-wind.y, wind.x);
        vec2 diagonalA = normalize(wind * .68 + crossWind * .73);
        vec2 diagonalB = normalize(wind * .36 - crossWind * .93);
        float primary = cos(dot(p, wind) * 6.6 - time * 3.15);
        float secondary = cos(dot(p, diagonalA) * 11.8 - time * 4.4);
        float capillary = cos(dot(p, diagonalB) * 19.5 - time * 5.7);
        float breakup = mix(.38, 1.0, fbm(p * 1.7 + wind * time * .18));
        float primaryKeep = 1.0 - smoothstep(.3, 1.05, footprint * 6.6);
        float secondaryKeep = 1.0 - smoothstep(.3, 1.05, footprint * 11.8);
        float capillaryKeep = 1.0 - smoothstep(.3, 1.05, footprint * 19.5);
        return (wind * primary * .032 * primaryKeep + diagonalA * secondary * .015 * secondaryKeep +
          diagonalB * capillary * .007 * capillaryKeep) * breakup * uDetailLevel;
      }

      vec3 skyRadiance(vec3 direction) {
        float vertical = smoothstep(-.05, .55, direction.y);
        vec3 gradient = mix(uHorizon, uSky, vertical);
        float sunAlignment = max(dot(normalize(direction), normalize(uSunDirection)), 0.0);
        vec3 disc = uSunColour * pow(sunAlignment, 1200.0) * 5.0;
        vec3 halo = uSunColour * pow(sunAlignment, 9.0) * .24;
        return gradient + disc + halo;
      }

      float ggxD(float noH, float roughness) {
        float a2 = roughness * roughness;
        float denominator = noH * noH * (a2 - 1.0) + 1.0;
        return a2 / max(3.14159265 * denominator * denominator, 1e-4);
      }

      float smith(float noV, float noL, float roughness) {
        float k = roughness * roughness * .5;
        float gv = noV / max(noV * (1.0 - k) + k, 1e-4);
        float gl = noL / max(noL * (1.0 - k) + k, 1e-4);
        return gv * gl;
      }

      void main() {
        float pixelFootprint = max(length(dFdx(vWorld.xz)), length(dFdy(vWorld.xz)));
        float fragmentHeight = 0.0;
        float fragmentCrest = 0.0;
        vec2 fragmentGradient = vec2(0.0);
        for (int i = 0; i < MAX_WAVES; i++) {
          if (i >= uWaveCount) break;
          vec4 wave = uWaves[i];
          float k = 6.28318530718 / wave.w;
          float waveKeep = 1.0 - smoothstep(.35, 1.1, pixelFootprint * k);
          float phase = k * dot(wave.xy, vOceanXZ) - uWaveSpeeds[i] * uTime;
          float sn = sin(phase); float cs = cos(phase);
          fragmentHeight += wave.z * sn * waveKeep;
          fragmentGradient += wave.xy * (wave.z * k * cs) * waveKeep;
          fragmentCrest += smoothstep(.55, .98, sn) * min(wave.z * k, .15) * waveKeep;
        }
        float analyticVisualStrength = mix(1.0, .28, uSpectralActive);
        fragmentGradient *= analyticVisualStrength;
        fragmentHeight *= mix(1.0, .36, uSpectralActive);
        fragmentCrest *= analyticVisualStrength;
        float fragmentSlope = length(fragmentGradient);

        float spectralKeep0 = 1.0 - smoothstep(2.5, 5.5, pixelFootprint);
        float spectralKeep1 = 1.0 - smoothstep(.35, 1.2, pixelFootprint);
        float spectralKeep2 = 1.0 - smoothstep(.1, .4, pixelFootprint);
        vec4 displacement0 = texture2D(uSpectralDisplacement0, fract(vOceanXZ / uSpectralPatchLengths.x));
        vec4 displacement1 = texture2D(uSpectralDisplacement1, fract(vOceanXZ / uSpectralPatchLengths.y));
        vec4 displacement2 = texture2D(uSpectralDisplacement2, fract(vOceanXZ / uSpectralPatchLengths.z));
        vec4 derivative =
          texture2D(uSpectralDerivatives0, fract(vOceanXZ / uSpectralPatchLengths.x)) * uSpectralCascadeWeights.x * spectralKeep0 +
          texture2D(uSpectralDerivatives1, fract(vOceanXZ / uSpectralPatchLengths.y)) * uSpectralCascadeWeights.y * spectralKeep1 +
          texture2D(uSpectralDerivatives2, fract(vOceanXZ / uSpectralPatchLengths.z)) * uSpectralCascadeWeights.z * spectralKeep2;
        float normalFlatten = smoothstep(5.0, 16.0, pixelFootprint);
        vec2 spectralSlope = vec2(
          derivative.x / max(.18, 1.0 + derivative.z),
          derivative.y / max(.18, 1.0 + derivative.w)
        ) * (1.0 - normalFlatten);
        float spectralSlopeLength = length(spectralSlope);
        spectralSlope *= min(1.0, .18 / max(spectralSlopeLength, 1e-4));

        float detailKeepA = 1.0 - smoothstep(.025, .12, pixelFootprint);
        float detailKeepB = 1.0 - smoothstep(.008, .035, pixelFootprint);
        vec2 detailA = (texture2D(uSpectralDetail, vOceanXZ * .06 + vec2(uTime * .012, uTime * .008)).rg * 2.0 - 1.0) * detailKeepA;
        vec2 detailB = (texture2D(uSpectralDetail, vOceanXZ * .17 + vec2(-uTime * .02, uTime * .015)).rg * 2.0 - 1.0) * detailKeepB;
        float detailEnabled = uDebugMode == 8 ? 0.0 : 1.0;
        vec2 micro = microSlope(vWorld.xz, uTime, pixelFootprint) * mix(1.0, .16, uSpectralActive) * detailEnabled +
          (detailA + detailB * .5) * uDetailStrength * uDetailLevel * uSpectralActive * detailEnabled;
        vec3 baseNormal = normalize(vec3(-fragmentGradient.x, 1.0, fragmentGradient.y));
        vec3 normal = normalize(vec3(
          baseNormal.x - micro.x - spectralSlope.x * uSpectralNormalStrength,
          baseNormal.y,
          baseNormal.z - micro.y - spectralSlope.y * uSpectralNormalStrength
        ));

        vec3 viewDir = normalize(cameraPosition - vWorld);
        vec3 lightDirection = normalize(uSunDirection);
        float noV = max(dot(normal, viewDir), .001);
        float macroNoV = max(dot(baseNormal, viewDir), .001);
        float noL = max(dot(normal, lightDirection), 0.0);
        float f0 = .02037;
        float fresnel = f0 + (1.0 - f0) * pow(1.0 - macroNoV, 5.0);
        vec3 reflectedDirection = normalize(reflect(-viewDir, normal));
        float reflectionSpread = mix(.025, .14, clamp(uRoughness * 8.0, 0.0, 1.0));
        vec3 reflectionTangent = normalize(cross(abs(reflectedDirection.y) > .98 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0), reflectedDirection));
        vec3 reflectionBitangent = normalize(cross(reflectedDirection, reflectionTangent));
        vec3 reflection = (
          skyRadiance(reflectedDirection) * 2.0 +
          skyRadiance(normalize(reflectedDirection + reflectionTangent * reflectionSpread)) +
          skyRadiance(normalize(reflectedDirection - reflectionTangent * reflectionSpread)) +
          skyRadiance(normalize(reflectedDirection + reflectionBitangent * reflectionSpread)) +
          skyRadiance(normalize(reflectedDirection - reflectionBitangent * reflectionSpread))
        ) / 6.0;
        reflection = mix(mix(uSky, uHorizon, .72), reflection, .36);
        vec3 refractedDirection = refract(-viewDir, normal, 1.0 / 1.333);
        float pathLength = uFallbackDepth / max(.08, abs(refractedDirection.y));
        vec3 transmittance = exp(-uAbsorption * pathLength);

        float downView = clamp(viewDir.y, 0.0, 1.0);
        float bodyDepth = clamp(downView * .78 + fragmentSlope * .12 - fragmentHeight * .04, 0.0, 1.0);
        float crestLight = smoothstep(.07, .32, fragmentCrest + max(fragmentHeight, 0.0) * .04);
        vec3 nearBody = mix(uMid, uShallow, crestLight * .42 + (1.0 - bodyDepth) * .12);
        vec3 transmitted = mix(uDeep, nearBody, transmittance);
        float forwardScatter = pow(max(dot(viewDir, -lightDirection), 0.0), 4.0);
        transmitted += uShallow * forwardScatter * .24 * (1.0 - fresnel);

        vec3 halfVector = normalize(viewDir + lightDirection);
        float noH = max(dot(normal, halfVector), 0.0);
        float voH = max(dot(viewDir, halfVector), 0.0);
        float specular = ggxD(noH, uRoughness) * smith(noV, noL, uRoughness) *
          (f0 + (1.0 - f0) * pow(1.0 - voH, 5.0)) * noL;
        vec3 water = mix(transmitted, reflection, fresnel);
        water += uSunColour * specular * .34;
        float sparkleKeep = 1.0 - smoothstep(.06, .22, pixelFootprint);
        float sparkleMask = smoothstep(.56, .9, fbm(vOceanXZ * 2.5 + uWindDirection * uTime * .5));
        water += uSunColour * pow(max(dot(reflectedDirection, lightDirection), 0.0), 320.0) * sparkleMask * sparkleKeep * 1.4;

        float jacobian = (1.0 + derivative.z) * (1.0 + derivative.w);
        float historyRaw =
          clamp((uSpectralFoamThreshold - mix(1.0, displacement0.a, spectralKeep0)) * uSpectralFoamScale, 0.0, 1.0) +
          clamp((uSpectralFoamThreshold - mix(1.0, displacement1.a, spectralKeep1)) * uSpectralFoamScale, 0.0, 1.0);
        float foamCoverage = smoothstep(.28, .9, historyRaw);
        float foamNoise = fbm(vOceanXZ * .82 + uWindDirection * uTime * .08);
        float fineFoam = fbm(vOceanXZ * 2.35 - uWindDirection * uTime * .12);
        float foamVisibility = 1.0 - smoothstep(.16, .92, pixelFootprint);
        float foamBreakup = smoothstep(.61, .82, foamNoise * .7 + fineFoam * .3) * foamVisibility;
        foamCoverage *= foamBreakup;
        float analyticThreshold = mix(.12, .22, clamp((uFoamThreshold - .1) / .8, 0.0, 1.0));
        float analyticSignal = fragmentCrest * 1.4 + fragmentSlope * .18;
        float analyticFoam = smoothstep(analyticThreshold, analyticThreshold + .12, analyticSignal) * foamBreakup;
        foamCoverage = max(foamCoverage, analyticFoam * .5);

        if (uDebugMode == 1) {
          vec3 bands = vec3(abs(displacement0.y) * .16, abs(displacement1.y) * .7, abs(displacement2.y) * 1.4);
          gl_FragColor = vec4(pow(clamp(bands, 0.0, 1.0), vec3(.55)), 1.0);
          return;
        }
        if (uDebugMode == 2) { gl_FragColor = vec4(normal * .5 + .5, 1.0); return; }
        if (uDebugMode == 3) { gl_FragColor = vec4(vec3(foamCoverage), 1.0); return; }
        if (uDebugMode == 4) { gl_FragColor = vec4(vec3(fresnel), 1.0); return; }
        if (uDebugMode == 5) { gl_FragColor = vec4(reflection, 1.0); return; }
        if (uDebugMode == 6) { gl_FragColor = vec4(transmittance, 1.0); return; }
        if (uDebugMode == 9) {
          float compression = clamp((.65 - jacobian) * 1.35, 0.0, 1.0);
          gl_FragColor = vec4(compression, clamp(jacobian, 0.0, 1.0), 1.0 - compression, 1.0);
          return;
        }
        if (uDebugMode == 10) { gl_FragColor = vec4(spectralKeep0, spectralKeep1, spectralKeep2, 1.0); return; }

        float foamEnabled = uDebugMode == 7 ? 0.0 : 1.0;
        vec3 foamColour = mix(uHorizon, vec3(.94, .985, 1.0), .62);
        float foamLight = .55 + .55 * noL;
        water = mix(water, foamColour * foamLight, foamCoverage * .66 * foamEnabled);
        water += uShallow * noL * crestLight * .065;
        float distanceToCamera = distance(cameraPosition.xz, vWorld.xz);
        float distanceFog = 1.0 - exp(-distanceToCamera * distanceToCamera * .0000018);
        water = mix(water, uHorizon, clamp(distanceFog, 0.0, .94));
        gl_FragColor = vec4(water, 1.0);
      }`,
    side: THREE.DoubleSide
  });

  let geometry;
  let currentQuality = qualityName;
  const mesh = new THREE.Mesh();
  mesh.material = material; mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'OceanSurface';
  scene.add(mesh);

  function setQuality(name) {
    const preset = QUALITY_PRESETS[name] || QUALITY_PRESETS.high;
    uniforms.uWaveCount.value = preset.waveCount;
    uniforms.uGeometryWaveCount.value = 2;
    currentQuality = name;
    uniforms.uDetailLevel.value = ({ low:.38, medium:.68, high:1, ultra:1.08 })[name] || 1;
    uniforms.uSpectralGeometryStrength.value = ({ low:.018, medium:.024, high:.03, ultra:.035 })[name] || .03;
    uniforms.uSpectralNormalStrength.value = ({ low:.035, medium:.05, high:.07, ultra:.09 })[name] || .07;
    uniforms.uDetailStrength.value = ({ low:.07, medium:.1, high:.13, ultra:.15 })[name] || .13;
    uniforms.uRoughness.value = ({ low:.08, medium:.07, high:.055, ultra:.045 })[name] || .055;
    const weights = ({ low:[1,.35,0], medium:[1,.4,.12], high:[1,.46,.2], ultra:[1,.5,.24] })[name] || [1,.46,.2];
    uniforms.uSpectralCascadeWeights.value.fromArray(weights);
    spectral.setQuality(name);
    uniforms.uSpectralTexelSize.value = 1 / Math.max(spectral.diagnostics.resolution, 1);
    const cascades = spectral.cascades;
    uniforms.uSpectralDisplacement0.value = cascades[0].displacement;
    uniforms.uSpectralDisplacement1.value = cascades[1].displacement;
    uniforms.uSpectralDisplacement2.value = cascades[2].displacement;
    uniforms.uSpectralDerivatives0.value = cascades[0].derivatives.texture;
    uniforms.uSpectralDerivatives1.value = cascades[1].derivatives.texture;
    uniforms.uSpectralDerivatives2.value = cascades[2].derivatives.texture;
    uniforms.uSpectralActive.value = spectral.active ? 1 : 0;
    uniforms.uSpectralDetail.value = spectral.detailTexture;
    geometry?.dispose();
    geometry = createAdaptiveOceanGeometry(5000, preset.oceanSegments);
    mesh.geometry = geometry;
  }

  function setDebugMode(mode = 'final') {
    const value = typeof mode === 'number' ? mode : OCEAN_DEBUG_MODES[mode] ?? OCEAN_DEBUG_MODES.final;
    uniforms.uDebugMode.value = THREE.MathUtils.clamp(Math.round(value), 0, 10);
    return uniforms.uDebugMode.value;
  }

  function setWaveIntensity(intensity) {
    waves.forEach(wave => { wave.targetAmplitude = wave.amplitude * intensity; });
  }

  function update(dt, time, environment, focusPosition) {
    spectral.update(time, dt, environment.waveIntensity);
    const cascades = spectral.cascades;
    uniforms.uSpectralDisplacement0.value = cascades[0].displacement;
    uniforms.uSpectralDisplacement1.value = cascades[1].displacement;
    uniforms.uSpectralDisplacement2.value = cascades[2].displacement;
    uniforms.uSpectralDerivatives0.value = cascades[0].derivatives.texture;
    uniforms.uSpectralDerivatives1.value = cascades[1].derivatives.texture;
    uniforms.uSpectralDerivatives2.value = cascades[2].derivatives.texture;
    uniforms.uSpectralActive.value = spectral.active ? 1 : 0;
    uniforms.uTime.value = time; mesh.position.x = Math.round(focusPosition.x / 100) * 100; mesh.position.z = Math.round(focusPosition.z / 100) * 100;
    waves.forEach((wave, index) => {
      wave.currentAmplitude = THREE.MathUtils.damp(wave.currentAmplitude, wave.targetAmplitude, .65, dt);
      const [x, z] = wave.direction; waveUniforms[index].set(x, z, wave.currentAmplitude, wave.wavelength);
      speedUniforms[index] = wave.speed; steepnessUniforms[index] = wave.steepness;
    });
    const blend = 1 - Math.exp(-dt * .6);
    uniforms.uDeep.value.lerp(environment.deep, blend); uniforms.uMid.value.lerp(environment.mid, blend);
    uniforms.uShallow.value.lerp(environment.shallow, blend); uniforms.uHorizon.value.lerp(environment.horizon, blend);
    uniforms.uSky.value.lerp(environment.sky, blend); uniforms.uSunColour.value.lerp(environment.sun, blend);
    const phi=THREE.MathUtils.degToRad(90-environment.sunElevation),theta=THREE.MathUtils.degToRad(environment.sunAzimuth);
    tmpSunDirection.setFromSphericalCoords(1,phi,theta);uniforms.uSunDirection.value.lerp(tmpSunDirection,blend).normalize();
    uniforms.uWindDirection.value.set(environment.windDirection.x,environment.windDirection.z).normalize();
    uniforms.uWaveEnergy.value=THREE.MathUtils.damp(uniforms.uWaveEnergy.value,environment.waveIntensity,.8,dt);
    uniforms.uFoamThreshold.value = THREE.MathUtils.damp(uniforms.uFoamThreshold.value, environment.foam, .8, dt);
  }

  const result = { height: 0, normal: new THREE.Vector3(0, 1, 0), velocity: new THREE.Vector3() };
  function sampleOceanSurface(worldX, worldZ, time, out = result) {
    let height = 0, dx = 0, dz = 0, verticalVelocity = 0;
    const count = uniforms.uWaveCount.value;
    for (let i = 0; i < count; i++) {
      const wave = waves[i], k = TAU / wave.wavelength;
      const phase = k * (wave.direction[0] * worldX + wave.direction[1] * worldZ) - wave.speed * time;
      height += wave.currentAmplitude * Math.sin(phase);
      const derivative = wave.currentAmplitude * k * Math.cos(phase);
      dx += wave.direction[0] * derivative; dz += wave.direction[1] * derivative;
      verticalVelocity += -wave.speed * wave.currentAmplitude * Math.cos(phase);
    }
    out.height = height; tmpNormal.set(-dx, 1, -dz).normalize(); out.normal.copy(tmpNormal); out.velocity.set(0, verticalVelocity, 0);
    return out;
  }

  setQuality(qualityName);
  return {
    mesh, material, uniforms, waves, spectral, update, sampleOceanSurface, setWaveIntensity, setQuality, setDebugMode,
    get diagnostics() { return { ...spectral.diagnostics, quality: currentQuality, debugMode: uniforms.uDebugMode.value }; },
    dispose() { geometry.dispose(); material.dispose(); spectral.dispose(); scene.remove(mesh); }
  };
}
