import * as THREE from 'three';
import { QUALITY_PRESETS } from '../config.js';

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const twist = new THREE.Quaternion();
const scale = new THREE.Vector3();
const local = new THREE.Vector3();
const wakeVelocity = new THREE.Vector3();
const planeNormal = new THREE.Vector3(0, 0, 1);

function foamTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 192;
  const context = canvas.getContext('2d');
  let seed = 2719;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  context.clearRect(0, 0, 192, 192);
  context.globalCompositeOperation = 'lighter';

  for (let i = 0; i < 54; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 12 + Math.pow(random(), .72) * 70;
    const x = 96 + Math.cos(angle) * radius;
    const y = 96 + Math.sin(angle) * radius * .46;
    const size = 5 + random() * 18;
    const gradient = context.createRadialGradient(x, y, 0, x, y, size);
    gradient.addColorStop(0, 'rgba(236,252,255,.72)');
    gradient.addColorStop(.36, 'rgba(218,246,250,.36)');
    gradient.addColorStop(1, 'rgba(214,244,250,0)');
    context.fillStyle = gradient;
    context.save();
    context.translate(x, y);
    context.rotate(angle + (random() - .5) * .8);
    context.scale(1.8 + random() * 1.8, .42 + random() * .48);
    context.beginPath();
    context.arc(0, 0, size, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 18; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 18 + random() * 52;
    const size = 3 + random() * 8;
    context.fillStyle = 'rgba(0,0,0,' + (.28 + random() * .48) + ')';
    context.beginPath();
    context.ellipse(
      96 + Math.cos(angle) * radius,
      96 + Math.sin(angle) * radius * .42,
      size * 1.8,
      size * .58,
      angle,
      0,
      Math.PI * 2
    );
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

export function createWakeSystem(scene, ocean, qualityName = 'high') {
  const texture = foamTexture();
  let capacity = QUALITY_PRESETS[qualityName].foamParticles;
  let mesh;
  let particles = [];
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: '#e8fbff',
    transparent: true,
    opacity: .74,
    depthWrite: false,
    alphaTest: .012,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide
  });

  function rebuild(name) {
    capacity = QUALITY_PRESETS[name].foamParticles;
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
    }
    mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, .48), material, capacity);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    scene.add(mesh);
    particles = Array.from({ length: capacity }, () => ({
      age: 99,
      life: 1,
      x: 0,
      z: 0,
      size: 0,
      vx: 0,
      vz: 0,
      angle: 0
    }));
    mesh.count = capacity;
  }

  let cursor = 0;
  let spawnRemainder = 0;

  function spawn(worldPosition, boatQuaternion, speed, type) {
    const particle = particles[cursor++ % capacity];
    const width = type === 'rear' ? 1.1 : type === 'side' ? .7 : .3;
    local
      .set((Math.random() - .5) * width, 0, type === 'rear' ? 1.8 + Math.random() * 1.5 : type === 'side' ? .5 : -2.05)
      .applyQuaternion(boatQuaternion);
    wakeVelocity
      .set((Math.random() - .5) * .06, 0, type === 'bow' ? -.04 : .22 + Math.random() * .18)
      .applyQuaternion(boatQuaternion);

    particle.x = worldPosition.x + local.x;
    particle.z = worldPosition.z + local.z;
    particle.age = 0;
    particle.life = 1.35 + Math.random() * 2.65;
    particle.size = .2 + Math.random() * .46 + speed * .024;
    particle.vx = wakeVelocity.x;
    particle.vz = wakeVelocity.z;
    particle.angle = Math.random() * Math.PI;
  }

  function update(dt, time, boatTransform, speedKnots) {
    const intensity = Math.max(0, (speedKnots - .35) / 9);
    spawnRemainder += dt * intensity * 80;
    while (spawnRemainder >= 1) {
      spawn(boatTransform.position, boatTransform.quaternion, speedKnots, Math.random() < .45 ? 'rear' : Math.random() < .7 ? 'side' : 'bow');
      spawnRemainder--;
    }

    for (let i = 0; i < capacity; i++) {
      const particle = particles[i];
      particle.age += dt;
      if (particle.age >= particle.life) {
        scale.setScalar(0);
        matrix.compose(position, rotation, scale);
        mesh.setMatrixAt(i, matrix);
        continue;
      }

      particle.x += particle.vx * dt;
      particle.z += particle.vz * dt;
      const wave = ocean.sampleOceanSurface(particle.x, particle.z, time);
      position.set(particle.x, wave.height + .022, particle.z);
      rotation.setFromUnitVectors(planeNormal, wave.normal);
      twist.setFromAxisAngle(wave.normal, particle.angle + particle.age * .04);
      rotation.premultiply(twist);

      const life = particle.age / particle.life;
      const fadeScale = 1 - life * life;
      scale.set(
        particle.size * (1 + life * 2.9) * Math.max(.08, fadeScale),
        particle.size * (.42 + life * .95) * Math.max(.08, fadeScale),
        1
      );
      matrix.compose(position, rotation, scale);
      mesh.setMatrixAt(i, matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = speedKnots > .35;
  }

  rebuild(qualityName);
  return {
    get mesh() { return mesh; },
    update,
    setQuality: rebuild,
    dispose() {
      texture.dispose();
      material.dispose();
      mesh.geometry.dispose();
      scene.remove(mesh);
    }
  };
}
