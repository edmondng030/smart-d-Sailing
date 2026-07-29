import * as THREE from 'three';
import { BOAT } from '../config.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const desiredPosition = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();
const desiredQuaternion = new THREE.Quaternion();
const localOffset = new THREE.Vector3();
const forward = new THREE.Vector3();
const side = new THREE.Vector3();
const stableQuaternion = new THREE.Quaternion();
const yawEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const lookMatrix = new THREE.Matrix4();

const CAMERA_MODES = [
  { name: 'chase', offset: [.52, .9, 1.85], targetForward: .65, targetUp: .5, fov: 44, response: 8.5 },
  { name: 'deck', offset: [.05, .73, .42], targetForward: 1.05, targetUp: .5, fov: 50, response: 12 },
  { name: 'cinematic', offset: [2.45, 1.25, 2.6], targetForward: .38, targetUp: .55, fov: 42, response: 5.4 },
  { name: 'oblique', offset: [3.1, 2.45, 3.15], targetForward: .2, targetUp: .15, fov: 48, response: 6 }
];

const CAMERA_BOOKMARKS = Object.freeze({ near: 1, design: 0, far: 2, oblique: 3 });

export function createFollowCamera(camera) {
  let mode = 0;
  let shake = 0;
  let lagDistance = 0;
  let lagVelocity = 0;
  let transition = null;
  let bookmark = null;
  let frozenPose = null;

  function setMode(next) {
    const resolved = ((next % CAMERA_MODES.length) + CAMERA_MODES.length) % CAMERA_MODES.length;
    if (resolved === mode && !bookmark) return mode;
    mode = resolved;
    bookmark = null;
    frozenPose = null;
    transition = {
      elapsed: 0,
      duration: .9,
      startPosition: camera.position.clone(),
      startQuaternion: camera.quaternion.clone(),
      startFov: camera.fov
    };
    return mode;
  }

  function setBookmark(name = null) {
    bookmark = Object.hasOwn(CAMERA_BOOKMARKS, name) ? name : null;
    if (bookmark) mode = CAMERA_BOOKMARKS[bookmark];
    frozenPose = null;
    transition = null;
    return bookmark;
  }

  function addImpact(amount) {
    shake = Math.max(shake, amount);
  }

  function updateLag(dt, speedKnots) {
    const active = mode === 0 && speedKnots > 1;
    const targetDrive = active ? THREE.MathUtils.clamp((speedKnots - 1) / 10, 0, 1) * BOAT.length * .55 : 0;
    const stiffness = active ? 6 : 34;
    const dampingRatio = active ? 1.04 : 1.3;
    const damping = 2 * dampingRatio * Math.sqrt(stiffness);
    const acceleration = (active ? targetDrive * 7.5 : 0) - stiffness * lagDistance - damping * lagVelocity;
    lagVelocity += acceleration * dt;
    lagDistance = THREE.MathUtils.clamp(lagDistance + lagVelocity * dt, 0, BOAT.length * .72);
    if ((lagDistance === 0 && lagVelocity < 0) || (lagDistance === BOAT.length * .72 && lagVelocity > 0)) lagVelocity = 0;
  }

  function resolvePose(dt, boatTransform, speedKnots, environment, enabled) {
    const q = boatTransform.quaternion;
    yawEuler.setFromQuaternion(q);
    yawEuler.x = 0;
    yawEuler.z = 0;
    stableQuaternion.setFromEuler(yawEuler);
    const config = CAMERA_MODES[mode];
    const portraitFrame = THREE.MathUtils.clamp((.82 - camera.aspect) / .42, 0, 1);
    localOffset.set(...config.offset).multiplyScalar(BOAT.length);
    localOffset.x *= 1 - portraitFrame * .5;
    localOffset.z += portraitFrame * BOAT.length * .62;
    desiredPosition.copy(localOffset).applyQuaternion(stableQuaternion).add(boatTransform.position);
    forward.set(0, 0, -1).applyQuaternion(stableQuaternion);
    side.set(1, 0, 0).applyQuaternion(stableQuaternion);
    updateLag(dt, speedKnots);
    desiredPosition.addScaledVector(forward, -lagDistance);
    const turnLag = THREE.MathUtils.clamp(boatTransform.angularHint || 0, -1, 1);
    desiredPosition.addScaledVector(side, -turnLag * BOAT.beam * .34);
    desiredTarget.copy(boatTransform.position)
      .addScaledVector(forward, config.targetForward * BOAT.length * (1 - portraitFrame * .12));
    desiredTarget.y += config.targetUp * BOAT.length;

    if (enabled && !bookmark) {
      const storm = environment.waveIntensity > 1.1 ? (environment.waveIntensity - 1.1) * .1 : 0;
      shake = THREE.MathUtils.damp(shake, storm, 4, dt);
      if (shake > .001) {
        const t = environment.time * 17;
        desiredPosition.x += Math.sin(t * 1.7) * shake;
        desiredPosition.y += Math.sin(t * 2.3) * shake * .45;
      }
    }
    lookMatrix.lookAt(desiredPosition, desiredTarget, WORLD_UP);
    desiredQuaternion.setFromRotationMatrix(lookMatrix);
    return { config, portraitFrame, fov: config.fov + portraitFrame * 4 };
  }

  function update(dt, boatTransform, speedKnots, environment, enabled = true) {
    dt = Math.min(dt, .05);
    const frame = resolvePose(dt, boatTransform, speedKnots, environment, enabled);
    const { config } = frame;

    if (bookmark) {
      if (!frozenPose) frozenPose = {
        position: desiredPosition.clone(), quaternion: desiredQuaternion.clone(), fov: frame.fov,
        target: desiredTarget.clone()
      };
      camera.position.copy(frozenPose.position);
      camera.quaternion.copy(frozenPose.quaternion);
      camera.fov = frozenPose.fov;
      camera.userData.target = frozenPose.target.clone();
      camera.updateProjectionMatrix();
      return;
    }

    if (transition) {
      transition.elapsed += dt;
      const t = THREE.MathUtils.clamp(transition.elapsed / transition.duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 1.8);
      camera.position.lerpVectors(transition.startPosition, desiredPosition, eased);
      camera.quaternion.slerpQuaternions(transition.startQuaternion, desiredQuaternion, eased);
      camera.fov = THREE.MathUtils.lerp(transition.startFov, frame.fov, eased);
      camera.userData.target = desiredTarget.clone();
      camera.updateProjectionMatrix();
      if (t >= 1) transition = null;
      return;
    }

    const response = 1 - Math.exp(-config.response * dt);
    camera.position.lerp(desiredPosition, response);
    camera.quaternion.slerp(desiredQuaternion, response);
    const speedFov = mode === 0 ? Math.min(speedKnots, 12) * .16 : 0;
    camera.fov = THREE.MathUtils.damp(camera.fov, frame.fov + speedFov, 4, dt);
    camera.userData.target = desiredTarget.clone();
    camera.updateProjectionMatrix();
  }

  return {
    update, setMode, setBookmark, addImpact,
    get mode() { return mode; },
    get diagnostics() {
      const config = CAMERA_MODES[mode];
      return {
        owner: 'follow-camera', mode: config.name, bookmark, subjectLength: BOAT.length,
        offsetInBoatLengths: config.offset, lagDistance, lagVelocity,
        transition: transition ? { t: transition.elapsed / transition.duration, duration: transition.duration } : null,
        projection: { fov: camera.fov, near: camera.near, far: camera.far, aspect: camera.aspect },
        portraitFrame: THREE.MathUtils.clamp((.82 - camera.aspect) / .42, 0, 1)
      };
    }
  };
}