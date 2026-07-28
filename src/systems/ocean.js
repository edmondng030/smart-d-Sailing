import * as THREE from 'three';
import { BASE_WAVES, QUALITY_PRESETS } from '../config.js';

const MAX_WAVES = 6;
const TAU = Math.PI * 2;
const tmpNormal = new THREE.Vector3();

function normalisedDirection([x, y]) {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
}

export function createOceanSystem(scene, qualityName = 'high') {
  const waves = BASE_WAVES.map(wave => { const direction=normalisedDirection(wave.direction); return { ...wave, direction, baseDirection:[...direction], baseSpeed:wave.speed, currentAmplitude:wave.amplitude, targetAmplitude:wave.amplitude }; });
  const waveUniforms = Array.from({ length: MAX_WAVES }, () => new THREE.Vector4());
  const speedUniforms = new Float32Array(MAX_WAVES);
  const steepnessUniforms = new Float32Array(MAX_WAVES);
  const uniforms = {
    uTime: { value: 0 }, uWaveCount: { value: QUALITY_PRESETS[qualityName].waveCount },
    uWaves: { value: waveUniforms }, uWaveSpeeds: { value: speedUniforms }, uSteepness: { value: steepnessUniforms },
    uDeep: { value: new THREE.Color('#082f4f') }, uMid: { value: new THREE.Color('#0f6681') },
    uShallow: { value: new THREE.Color('#3ca6a0') }, uHorizon: { value: new THREE.Color('#c9dde0') },
    uSunColour: { value: new THREE.Color('#fff2d2') }, uSunDirection: { value: new THREE.Vector3(-.35, .72, .6).normalize() },
    uFoamThreshold: { value: .48 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      #define MAX_WAVES 6
      uniform float uTime; uniform int uWaveCount; uniform vec4 uWaves[MAX_WAVES];
      uniform float uWaveSpeeds[MAX_WAVES]; uniform float uSteepness[MAX_WAVES];
      varying vec3 vWorld; varying vec3 vNormalW; varying float vCrest;
      void main() {
        vec4 baseWorld = modelMatrix * vec4(position.x, 0.0, position.y, 1.0);
        vec2 worldXZ = baseWorld.xz; float height = 0.0; vec2 horizontal = vec2(0.0); vec2 gradient = vec2(0.0); float crest = 0.0;
        for (int i = 0; i < MAX_WAVES; i++) {
          if (i >= uWaveCount) break;
          vec4 wave = uWaves[i]; float k = 6.28318530718 / wave.w;
          float phase = k * dot(wave.xy, worldXZ) - uWaveSpeeds[i] * uTime;
          float sn = sin(phase); float cs = cos(phase);
          height += wave.z * sn; horizontal += wave.xy * (uSteepness[i] * wave.z * cs);
          gradient += wave.xy * (wave.z * k * cs); crest += smoothstep(0.72, 0.98, sn) * wave.z;
        }
        vec3 p = position; p.x += horizontal.x; p.y += horizontal.y; p.z = height;
        vec4 world = modelMatrix * vec4(p, 1.0); vWorld = world.xyz;
        vNormalW = normalize(normalMatrix * vec3(-gradient.x, -gradient.y, 1.0)); vCrest = crest;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uShallow; uniform vec3 uHorizon;
      uniform vec3 uSunColour; uniform vec3 uSunDirection; uniform float uTime; uniform float uFoamThreshold;
      varying vec3 vWorld; varying vec3 vNormalW; varying float vCrest;
      void main() {
        vec3 normal = normalize(vNormalW); vec3 viewDir = normalize(cameraPosition - vWorld);
        float facing = max(dot(viewDir, normal), 0.0); float fresnel = pow(1.0 - facing, 3.0);
        float downView = clamp(viewDir.y, 0.0, 1.0);
        float distanceFog = smoothstep(250.0, 2100.0, distance(cameraPosition.xz, vWorld.xz));
        vec3 reflected = reflect(-uSunDirection, normal);
        float glitter = pow(max(dot(reflected, viewDir), 0.0), 128.0);
        float micro = sin(vWorld.x * 3.1 + uTime * 2.4) * sin(vWorld.z * 2.7 - uTime * 1.9);
        float foam = smoothstep(uFoamThreshold, uFoamThreshold + .12, vCrest + micro * .025);
        vec3 water = mix(uMid, uDeep, downView * .72); water = mix(water, uShallow, fresnel * .32);
        water += uSunColour * (glitter * 1.5 + foam * .48); water = mix(water, uHorizon, distanceFog * .92);
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
    geometry?.dispose();
    geometry = new THREE.PlaneGeometry(5000, 5000, preset.oceanSegments, preset.oceanSegments);
    mesh.geometry = geometry;
  }

  function setWaveIntensity(intensity) {
    waves.forEach(wave => { wave.targetAmplitude = wave.amplitude * intensity; });
  }

  function update(dt, time, environment, focusPosition) {
    uniforms.uTime.value = time; mesh.position.x = Math.round(focusPosition.x / 100) * 100; mesh.position.z = Math.round(focusPosition.z / 100) * 100;
    waves.forEach((wave, index) => {
      wave.currentAmplitude = THREE.MathUtils.damp(wave.currentAmplitude, wave.targetAmplitude, .65, dt);
      const [x, z] = wave.direction; waveUniforms[index].set(x, z, wave.currentAmplitude, wave.wavelength);
      speedUniforms[index] = wave.speed; steepnessUniforms[index] = wave.steepness;
    });
    const blend = 1 - Math.exp(-dt * .6);
    uniforms.uDeep.value.lerp(environment.deep, blend); uniforms.uMid.value.lerp(environment.mid, blend);
    uniforms.uShallow.value.lerp(environment.shallow, blend); uniforms.uHorizon.value.lerp(environment.horizon, blend);
    uniforms.uSunColour.value.lerp(environment.sun, blend);
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
  return { mesh, material, uniforms, waves, update, sampleOceanSurface, setWaveIntensity, setQuality, dispose() { geometry.dispose(); material.dispose(); scene.remove(mesh); } };
}
