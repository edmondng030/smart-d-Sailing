import * as THREE from 'three';
import { QUALITY_PRESETS } from '../config.js';

const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),local=new THREE.Vector3();

function foamTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.clearRect(0,0,128,128);x.fillStyle='#ecffff';x.beginPath();for(let i=0;i<28;i++){const a=i/28*Math.PI*2,r=45+Math.sin(i*2.7)*13+Math.random()*8,pX=64+Math.cos(a)*r,pY=64+Math.sin(a)*r*.45;i?x.lineTo(pX,pY):x.moveTo(pX,pY)}x.closePath();x.fill();const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export function createWakeSystem(scene,ocean,qualityName='high'){
  const texture=foamTexture();let capacity=QUALITY_PRESETS[qualityName].foamParticles,mesh,particles=[];const material=new THREE.MeshBasicMaterial({map:texture,color:'#ecffff',transparent:true,opacity:.62,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  function rebuild(name){capacity=QUALITY_PRESETS[name].foamParticles;if(mesh){scene.remove(mesh);mesh.geometry.dispose()}mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,.48),material,capacity);mesh.frustumCulled=false;mesh.renderOrder=2;scene.add(mesh);particles=Array.from({length:capacity},()=>({age:99,life:1,x:0,z:0,size:0,drift:0}));mesh.count=capacity}
  let cursor=0,spawnRemainder=0;
  function spawn(worldPosition,boatQuaternion,speed,type){const p=particles[cursor++%capacity],width=type==='rear'?1.1:type==='side'?.7:.3;local.set((Math.random()-.5)*width,0,type==='rear'?1.8+Math.random()*1.5:type==='side'?.5:-2.05).applyQuaternion(boatQuaternion);p.x=worldPosition.x+local.x;p.z=worldPosition.z+local.z;p.age=0;p.life=1.2+Math.random()*2.4;p.size=.22+Math.random()*.45+speed*.025;p.drift=(Math.random()-.5)*.18}
  function update(dt,time,boatTransform,speedKnots){const intensity=Math.max(0,(speedKnots-.35)/9);spawnRemainder+=dt*intensity*80;while(spawnRemainder>=1){spawn(boatTransform.position,boatTransform.quaternion,speedKnots,Math.random()<.45?'rear':Math.random()<.7?'side':'bow');spawnRemainder--}
    for(let i=0;i<capacity;i++){const p=particles[i];p.age+=dt;if(p.age>=p.life){scale.setScalar(0);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);continue}p.x+=p.drift*dt;p.z+=dt*.35;const wave=ocean.sampleOceanSurface(p.x,p.z,time);position.set(p.x,wave.height+.018,p.z);rotation.setFromEuler(new THREE.Euler(-Math.PI/2,0,p.drift*2));const life=p.age/p.life;scale.set(p.size*(1+life*2.8)*(1-life*.82),p.size*(.45+life),1);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix)}mesh.instanceMatrix.needsUpdate=true;mesh.visible=speedKnots>.35}
  rebuild(qualityName);return {mesh,update,setQuality:rebuild,dispose(){texture.dispose();material.dispose();mesh.geometry.dispose();scene.remove(mesh)}};
}
