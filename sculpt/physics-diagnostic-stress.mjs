import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createBoatPhysics } from '../src/systems/boat.js';
import { createOceanSystem } from '../src/systems/ocean.js';

await RAPIER.init({});

const DT = 1 / 60;
const RAD_TO_DEG = 180 / Math.PI;

function makeBoatRoot() {
  const root = new THREE.Group();
  const rudder = { rotation: { y: 0 } };
  root.userData.high = {
    userData: {
      sail: null,
      jib: null,
      flag: null,
      rudder,
      wetness: 0,
      lowerMaterial: { roughness: 0.5 }
    }
  };
  return root;
}

function makeEnvironment(windSpeed, windDegrees, waveIntensity) {
  const angle = THREE.MathUtils.degToRad(windDegrees);
  return {
    windSpeed,
    windDirection: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
    gustStrength: 0,
    wetness: 0.15,
    waveIntensity
  };
}

function yawFromQuaternion(q) {
  const siny = 2 * (q.w * q.y + q.x * q.z);
  const cosy = 1 - 2 * (q.y * q.y + q.z * q.z);
  return Math.atan2(siny, cosy);
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

function summarize(name, frames, rudderReleasedAt = 0) {
  const warm = frames.filter(frame => frame.t >= 5);
  const tail = frames.filter(frame => frame.t >= frames.at(-1).t - 10);
  const postRudder = frames.filter(frame => frame.t >= Math.max(rudderReleasedAt + 5, 5));
  const heave = tail.map(frame => frame.heave);
  const yawRates = tail.map(frame => Math.abs(frame.angvel.y));
  const postYawStart = postRudder[0]?.unwrappedYaw ?? 0;
  const postYawEnd = postRudder.at(-1)?.unwrappedYaw ?? 0;
  const maxRoll = Math.max(...warm.map(frame => Math.abs(frame.roll)));
  const maxPitch = Math.max(...warm.map(frame => Math.abs(frame.pitch)));
  const minUp = Math.min(...warm.map(frame => frame.upDot));
  const maxAngular = Math.max(...warm.map(frame => frame.angularSpeed));
  const final = frames.at(-1);
  const tailMeanYawRate = yawRates.reduce((sum, value) => sum + value, 0) / yawRates.length;
  return {
    name,
    durationSeconds: final.t,
    floating: Number.isFinite(final.y) && final.y > -2 && final.y < 2,
    inverted: minUp < 0,
    firstInstabilityAtSeconds: warm.find(frame => frame.upDot < 0.25 || Math.abs(frame.roll) > 55 || Math.abs(frame.pitch) > 40)?.t ?? null,
    waterRelativeBodyY: {
      meanLast10s: heave.reduce((sum, value) => sum + value, 0) / heave.length,
      minLast10s: Math.min(...heave),
      maxLast10s: Math.max(...heave),
      p95Last10s: percentile(heave, 0.95)
    },
    attitudeDegrees: {
      maxAbsRollAfter5s: maxRoll,
      maxAbsPitchAfter5s: maxPitch,
      finalRoll: final.roll,
      finalPitch: final.pitch,
      minimumUpDot: minUp
    },
    rotation: {
      totalYawTurns: final.unwrappedYaw / (Math.PI * 2),
      yawTurnsAfterRudderSettling: (postYawEnd - postYawStart) / (Math.PI * 2),
      maxAngularSpeedAfter5s: maxAngular,
      meanAbsYawRateLast10s: tailMeanYawRate,
      maxAbsYawRateLast10s: Math.max(...yawRates),
      finalAngularVelocity: final.angvel
    },
    motion: {
      finalPosition: { x: final.x, y: final.y, z: final.z },
      finalLinearVelocity: final.linvel,
      finalSpeedKnots: final.speedKnots
    },
    abnormalSpin: tailMeanYawRate > 0.25 || Math.abs((postYawEnd - postYawStart) / (Math.PI * 2)) > 1.25,
    unstableFloat: minUp < 0.25 || maxRoll > 55 || maxPitch > 40 || !Number.isFinite(final.y)
  };
}

function runScenario(options) {
  const scene = new THREE.Scene();
  const ocean = createOceanSystem(scene, 'high');
  ocean.waves.forEach(wave => {
    wave.currentAmplitude = wave.amplitude * options.waveIntensity;
    wave.targetAmplitude = wave.currentAmplitude;
  });
  const environment = makeEnvironment(options.windSpeed, options.windDegrees, options.waveIntensity);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  const root = makeBoatRoot();
  const physics = createBoatPhysics(RAPIER, world, root, ocean);
  if (options.initialVelocity !== undefined) physics.setVelocity(options.initialVelocity);
  const frames = [];
  let priorYaw = 0;
  let unwrappedYaw = 0;
  const up = new THREE.Vector3();
  const euler = new THREE.Euler();
  const totalSteps = Math.round(options.duration * 60);
  for (let step = 0; step <= totalSteps; step++) {
    const t = step * DT;
    const rudder = options.rudder(t);
    const result = physics.update(DT, t, environment, {
      rudder,
      sailTrim: options.sailTrim,
      anchored: options.anchored
    });
    const q = root.quaternion;
    const yaw = yawFromQuaternion(q);
    if (step > 0) {
      let delta = yaw - priorYaw;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      unwrappedYaw += delta;
    }
    priorYaw = yaw;
    if (step % 6 === 0) {
      const p = physics.body.translation();
      const av = physics.body.angvel();
      const lv = physics.body.linvel();
      const water = ocean.sampleOceanSurface(p.x, p.z, t);
      euler.setFromQuaternion(q, 'YXZ');
      up.set(0, 1, 0).applyQuaternion(q);
      frames.push({
        t,
        x: p.x,
        y: p.y,
        z: p.z,
        heave: p.y - water.height,
        roll: euler.z * RAD_TO_DEG,
        pitch: euler.x * RAD_TO_DEG,
        unwrappedYaw,
        upDot: up.y,
        angularSpeed: Math.hypot(av.x, av.y, av.z),
        angvel: { x: av.x, y: av.y, z: av.z },
        linvel: { x: lv.x, y: lv.y, z: lv.z },
        speedKnots: result.speedKnots
      });
    }
  }
  ocean.dispose();
  world.free();
  return summarize(options.name, frames, options.rudderReleasedAt || 0);
}

const scenarios = [
  {
    name: 'calm-flat-water',
    duration: 30,
    windSpeed: 0,
    windDegrees: 0,
    waveIntensity: 0,
    sailTrim: 0.82,
    anchored: true,
    initialVelocity: 0,
    rudder: () => 0
  },
  {
    name: 'normal-clear-weather-straight-rudder',
    duration: 120,
    windSpeed: 8,
    windDegrees: 14,
    waveIntensity: 1.18,
    sailTrim: 0.82,
    anchored: false,
    rudder: () => 0
  },
  {
    name: 'normal-weather-rudder-pulse-then-center',
    duration: 120,
    windSpeed: 8,
    windDegrees: 14,
    waveIntensity: 1.18,
    sailTrim: 0.82,
    anchored: false,
    rudderReleasedAt: 4,
    rudder: time => time < 4 ? 1 : 0
  }
];

const results = scenarios.map(runScenario);
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), dt: DT, results }, null, 2));
