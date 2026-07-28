import * as THREE from 'three';
import { BASE_WAVES, QUALITY_PRESETS } from '../config.js';
import { createSpectralLayer } from './spectral/index.js';

const MAX_WAVES = 6;
const TAU = Math.PI * 2;
const tmpNormal = new THREE.Vector3();
const tmpSunDirection = new THREE.Vector3();

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
    uTime: { value: 0 }, uWaveCount: { value: QUALITY_PRESETS[qualityName].waveCount },
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
    uSpectralGeometryStrength: { value: .065 }, uSpectralNormalStrength: { value: .86 }, uSpectralActive: { value: spectral.active ? 1 : 0 },
    uSpectralFoamThreshold: { value: .4 }, uSpectralFoamScale: { value: 2.5 },
    uFoamThreshold: { value: .48 }, uWaveEnergy: { value: 1 }, uDetailLevel: { value: 1 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      #define MAX_WAVES 6
      uniform float uTime; uniform int uWaveCount; uniform vec4 uWaves[MAX_WAVES];
      uniform float uWaveSpeeds[MAX_WAVES]; uniform float uSteepness[MAX_WAVES];
      uniform sampler2D uSpectralDisplacement0; uniform sampler2D uSpectralDisplacement1; uniform sampler2D uSpectralDisplacement2;
      uniform vec3 uSpectralPatchLengths; uniform float uSpectralGeometryStrength;
      varying vec3 vWorld; varying vec3 vNormalW; varying vec2 vOceanXZ;
      varying float vCrest; varying float vSlope; varying float vHeight; varying float vSpectralHistory;
      void main() {
        vec4 baseWorld = modelMatrix * vec4(position.x, 0.0, position.y, 1.0);
        vec2 worldXZ = baseWorld.xz; float height = 0.0; vec2 horizontal = vec2(0.0); vec2 gradient = vec2(0.0); float crest = 0.0;
        float vertexFootprint =
          distance(cameraPosition.xz, worldXZ) * distance(cameraPosition.xz, worldXZ) * .001 /
          max(abs(cameraPosition.y - baseWorld.y), .5);
        for (int i = 0; i < MAX_WAVES; i++) {
          if (i >= uWaveCount) break;
          vec4 wave = uWaves[i]; float k = 6.28318530718 / wave.w;
          float waveKeep = 1.0 - smoothstep(wave.w * .12, wave.w * .45, vertexFootprint);
          float phase = k * dot(wave.xy, worldXZ) - uWaveSpeeds[i] * uTime;
          float sn = sin(phase); float cs = cos(phase);
          height += wave.z * sn * waveKeep;
          horizontal += wave.xy * (uSteepness[i] * wave.z * cs) * waveKeep;
          gradient += wave.xy * (wave.z * k * cs) * waveKeep;
          crest += smoothstep(0.55, 0.98, sn) * min(wave.z * k, 0.15) * waveKeep;
        }
        vec4 spectral0 = texture2D(uSpectralDisplacement0, fract(worldXZ / uSpectralPatchLengths.x));
        vec4 spectral1 = texture2D(uSpectralDisplacement1, fract(worldXZ / uSpectralPatchLengths.y));
        vec4 spectral2 = texture2D(uSpectralDisplacement2, fract(worldXZ / uSpectralPatchLengths.z));
        float spectralKeep0 = 1.0 - smoothstep(2.5, 5.5, vertexFootprint);
        float spectralKeep1 = 1.0 - smoothstep(.35, 1.2, vertexFootprint);
        float spectralKeep2 = 1.0 - smoothstep(.1, .4, vertexFootprint);
        vec3 spectralDisplacement =
          spectral0.xyz * spectralKeep0 +
          spectral1.xyz * .55 * spectralKeep1 +
          spectral2.xyz * .28 * spectralKeep2;
        horizontal += spectralDisplacement.xz * uSpectralGeometryStrength;
        height += spectralDisplacement.y * uSpectralGeometryStrength;
        vec3 p = position; p.x += horizontal.x; p.y += horizontal.y; p.z = height;
        vec4 world = modelMatrix * vec4(p, 1.0); vWorld = world.xyz; vOceanXZ = worldXZ;
        vSpectralHistory = min(
          mix(1.0, spectral0.a, spectralKeep0),
          mix(1.0, spectral1.a, spectralKeep1)
        );
        vNormalW = normalize(normalMatrix * vec3(-gradient.x, -gradient.y, 1.0));
        vCrest = crest; vSlope = length(gradient); vHeight = height;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      #define MAX_WAVES 6
      uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uShallow; uniform vec3 uHorizon;
      uniform vec3 uSky; uniform vec3 uSunColour; uniform vec3 uSunDirection; uniform vec2 uWindDirection;
      uniform float uTime; uniform float uFoamThreshold; uniform float uWaveEnergy; uniform float uDetailLevel;
      uniform int uWaveCount; uniform vec4 uWaves[MAX_WAVES]; uniform float uWaveSpeeds[MAX_WAVES];
      uniform sampler2D uSpectralDerivatives0; uniform sampler2D uSpectralDerivatives1; uniform sampler2D uSpectralDerivatives2;
      uniform sampler2D uSpectralDetail; uniform vec3 uSpectralPatchLengths;
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

      vec2 microSlope(vec2 p, float time) {
        vec2 wind = normalize(uWindDirection);
        vec2 crossWind = vec2(-wind.y, wind.x);
        vec2 diagonalA = normalize(wind * .68 + crossWind * .73);
        vec2 diagonalB = normalize(wind * .36 - crossWind * .93);
        float primary = cos(dot(p, wind) * 6.6 - time * 3.15);
        float secondary = cos(dot(p, diagonalA) * 11.8 - time * 4.4);
        float capillary = cos(dot(p, diagonalB) * 19.5 - time * 5.7);
        float breakup = mix(.38, 1.0, fbm(p * 1.7 + wind * time * .18));
        return (wind * primary * .032 + diagonalA * secondary * .015 +
          diagonalB * capillary * .007) * breakup * uDetailLevel;
      }

      void main() {
        float pixelFootprint =
          distance(cameraPosition.xz, vWorld.xz) * distance(cameraPosition.xz, vWorld.xz) * .001 /
          max(abs(cameraPosition.y - vWorld.y), .5);
        float fragmentHeight = 0.0;
        float fragmentCrest = 0.0;
        vec2 fragmentGradient = vec2(0.0);
        for (int i = 0; i < MAX_WAVES; i++) {
          if (i >= uWaveCount) break;
          vec4 wave = uWaves[i];
          float k = 6.28318530718 / wave.w;
          float waveKeep = 1.0 - smoothstep(wave.w * .12, wave.w * .45, pixelFootprint);
          float phase = k * dot(wave.xy, vOceanXZ) - uWaveSpeeds[i] * uTime;
          float sn = sin(phase); float cs = cos(phase);
          fragmentHeight += wave.z * sn * waveKeep;
          fragmentGradient += wave.xy * (wave.z * k * cs) * waveKeep;
          fragmentCrest += smoothstep(.55, .98, sn) * min(wave.z * k, .15) * waveKeep;
        }
        float analyticVisualStrength = mix(1.0, .16, uSpectralActive);
        fragmentGradient *= analyticVisualStrength;
        fragmentHeight *= mix(1.0, .35, uSpectralActive);
        fragmentCrest *= analyticVisualStrength;
        float fragmentSlope = length(fragmentGradient);
        float spectralKeep0 = 1.0 - smoothstep(2.5, 5.5, pixelFootprint);
        float spectralKeep1 = 1.0 - smoothstep(.35, 1.2, pixelFootprint);
        float spectralKeep2 = 1.0 - smoothstep(.1, .4, pixelFootprint);
        vec4 derivative =
          texture2D(uSpectralDerivatives0, fract(vOceanXZ / uSpectralPatchLengths.x)) * spectralKeep0 +
          texture2D(uSpectralDerivatives1, fract(vOceanXZ / uSpectralPatchLengths.y)) * .55 * spectralKeep1 +
          texture2D(uSpectralDerivatives2, fract(vOceanXZ / uSpectralPatchLengths.z)) * .28 * spectralKeep2;
        vec2 spectralSlope = vec2(
          derivative.x / max(.18, 1.0 + derivative.z),
          derivative.y / max(.18, 1.0 + derivative.w)
        );
        float detailKeepA = 1.0 - smoothstep(.025, .12, pixelFootprint);
        float detailKeepB = 1.0 - smoothstep(.008, .035, pixelFootprint);
        vec2 detailA = (texture2D(uSpectralDetail, vOceanXZ * .06 + vec2(uTime * .012, uTime * .008)).rg * 2.0 - 1.0) * detailKeepA;
        vec2 detailB = (texture2D(uSpectralDetail, vOceanXZ * .17 + vec2(-uTime * .02, uTime * .015)).rg * 2.0 - 1.0) * detailKeepB;
        vec2 micro = microSlope(vWorld.xz, uTime) * detailKeepA * mix(1.0, .14, uSpectralActive) +
          (detailA * .12 + detailB * .05) * uDetailLevel * uSpectralActive;
        vec3 baseNormal = normalize(vec3(-fragmentGradient.x, 1.0, fragmentGradient.y));
        vec3 normal = normalize(vec3(
          baseNormal.x - micro.x - spectralSlope.x * uSpectralNormalStrength,
          baseNormal.y,
          baseNormal.z - micro.y - spectralSlope.y * uSpectralNormalStrength
        ));
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float facing = max(dot(viewDir, normal), 0.0);
        float fresnel = .02 + .98 * pow(1.0 - facing, 5.0);
        float downView = clamp(viewDir.y, 0.0, 1.0);
        float distanceFog = smoothstep(250.0, 2100.0, distance(cameraPosition.xz, vWorld.xz));

        vec3 reflectedSky = reflect(-viewDir, normal);
        float horizonView = pow(1.0 - clamp(reflectedSky.y, 0.0, 1.0), .58);
        float sunMirror = max(dot(reflectedSky, normalize(uSunDirection)), 0.0);
        vec3 skyReflection = mix(uSky * .68, uHorizon, horizonView);
        skyReflection = mix(mix(uMid, uHorizon, .38), skyReflection, .46);
        skyReflection += uSunColour * (pow(sunMirror, 96.0) * .18 + pow(sunMirror, 680.0) * .75);
        float bodyDepth = clamp(downView * .82 + fragmentSlope * .18 - fragmentHeight * .045, 0.0, 1.0);
        vec3 bodyColour = mix(uMid, uDeep, bodyDepth);
        float crestLight = smoothstep(.08, .38, fragmentCrest + max(fragmentHeight, 0.0) * .035);
        bodyColour = mix(bodyColour, uShallow, crestLight * .34 + (1.0 - downView) * .08);
        float reflectionWeight = clamp(.1 + fresnel * .34, .1, .44);
        vec3 water = mix(bodyColour, skyReflection, reflectionWeight);

        vec3 reflected = reflect(-normalize(uSunDirection), normal);
        float reflectionDot = max(dot(reflected, viewDir), 0.0);
        float sparkleNoise = fbm(vWorld.xz * 2.8 + uWindDirection * uTime * .55);
        float broadGlitter = pow(reflectionDot, 42.0) * (.28 + sparkleNoise * .72);
        float sharpGlitter = pow(reflectionDot, 280.0) * step(.56, sparkleNoise);
        water += uSunColour * (broadGlitter * .24 + sharpGlitter * 1.55) * (1.0 - distanceFog);

        float foamNoise = fbm(vWorld.xz * .82 + uWindDirection * uTime * .08);
        float fineFoam = fbm(vWorld.xz * 2.35 - uWindDirection * uTime * .12);
        float crestSignal = fragmentCrest * (1.05 + foamNoise * .55) + fragmentSlope * .065 * uWaveEnergy;
        float foamBase = smoothstep(uFoamThreshold - .06, uFoamThreshold + .08, crestSignal);
        float brokenEdge = smoothstep(.34, .72, foamNoise + fineFoam * .32);
        float foam = foamBase * mix(.42, 1.0, brokenEdge);
        float spectralFoamRaw = clamp((uSpectralFoamThreshold - vSpectralHistory) * uSpectralFoamScale, 0.0, 1.0);
        float spectralFoam = smoothstep(.2, .9, spectralFoamRaw) * mix(.62, 1.0, fineFoam);
        foam = max(foam, spectralFoam);
        vec3 foamColour = mix(uHorizon, vec3(0.94, 0.985, 1.0), .62);
        water = mix(water, foamColour, foam * .78);

        float shallowScatter = pow(max(dot(normal, normalize(uSunDirection)), 0.0), 2.0) * crestLight;
        water += uShallow * shallowScatter * .075;
        water = mix(water, uHorizon, distanceFog * .92);
        gl_FragColor = vec4(water, 1.0);
      }`,
    side: THREE.DoubleSide
  });

  let geometry;
  const mesh = new THREE.Mesh();
  mesh.material = material; mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'OceanSurface';
  scene.add(mesh);

  function setQuality(name) {
    const preset = QUALITY_PRESETS[name] || QUALITY_PRESETS.high;
    uniforms.uWaveCount.value = preset.waveCount;
    uniforms.uDetailLevel.value = ({ low:.38, medium:.68, high:1, ultra:1.18 })[name] || 1;
    uniforms.uSpectralGeometryStrength.value = ({ low:.025, medium:.045, high:.065, ultra:.08 })[name] || .065;
    uniforms.uSpectralNormalStrength.value = ({ low:.5, medium:.72, high:.86, ultra:1 })[name] || .86;
    spectral.setQuality(name);
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
  return { mesh, material, uniforms, waves, spectral, update, sampleOceanSurface, setWaveIntensity, setQuality, dispose() { geometry.dispose(); material.dispose(); spectral.dispose(); scene.remove(mesh); } };
}
