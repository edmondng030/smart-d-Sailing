import * as THREE from 'three';

const desiredPosition=new THREE.Vector3(),desiredTarget=new THREE.Vector3(),localOffset=new THREE.Vector3(),forward=new THREE.Vector3(),side=new THREE.Vector3();
const stableQuaternion=new THREE.Quaternion(),yawEuler=new THREE.Euler(0,0,0,'YXZ');

export function createFollowCamera(camera){
  let mode=0,shake=0;
  const offsets=[new THREE.Vector3(0,4.7,10.4),new THREE.Vector3(.2,2.65,1.8),new THREE.Vector3(9,6.4,12.5)];

  function setMode(next){mode=((next%offsets.length)+offsets.length)%offsets.length;return mode}
  function addImpact(amount){shake=Math.max(shake,amount)}

  function update(dt,boatTransform,speedKnots,environment,enabled=true){
    const q=boatTransform.quaternion;yawEuler.setFromQuaternion(q);yawEuler.x=0;yawEuler.z=0;stableQuaternion.setFromEuler(yawEuler);
    localOffset.copy(offsets[mode]);desiredPosition.copy(localOffset).applyQuaternion(stableQuaternion).add(boatTransform.position);
    forward.set(0,0,-1).applyQuaternion(stableQuaternion);side.set(1,0,0).applyQuaternion(stableQuaternion);
    const turnLag=THREE.MathUtils.clamp(boatTransform.angularHint||0,-1,1);desiredPosition.addScaledVector(side,-turnLag*.55);
    desiredTarget.copy(boatTransform.position).addScaledVector(forward,mode===1?4.2:5.3);desiredTarget.y+=mode===1?1.9:1.25;
    if(enabled){
      const storm=environment.waveIntensity>1.1?(environment.waveIntensity-1.1)*.12:0;
      shake=THREE.MathUtils.damp(shake,storm,4,dt);
      if(shake>.001){const t=environment.time*17;desiredPosition.x+=Math.sin(t*1.7)*shake;desiredPosition.y+=Math.sin(t*2.3)*shake*.55}
    }
    camera.position.lerp(desiredPosition,1-Math.exp(-dt*4));camera.userData.target=camera.userData.target||desiredTarget.clone();camera.userData.target.lerp(desiredTarget,1-Math.exp(-dt*6));camera.lookAt(camera.userData.target);
    const targetFov=48+Math.min(speedKnots,12)*.28;camera.fov=THREE.MathUtils.damp(camera.fov,targetFov,3,dt);camera.updateProjectionMatrix();
  }

  return {update,setMode,addImpact,get mode(){return mode}};
}
