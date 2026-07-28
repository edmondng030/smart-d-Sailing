import * as THREE from 'three';
import { BOAT } from '../config.js';

const HULL_STATIONS=[
  {z:-2.15,width:.08,height:.50},{z:-1.70,width:.46,height:.78},{z:-.90,width:.73,height:.96},
  {z:0,width:.79,height:1.02},{z:.95,width:.68,height:.92},{z:1.75,width:.40,height:.75},{z:2.20,width:.10,height:.56}
];
const BUOYANCY_POINTS=[[-.52,-.28,-1.55],[.52,-.28,-1.55],[-.68,-.42,-.55],[.68,-.42,-.55],[-.68,-.42,.55],[.68,-.42,.55],[-.42,-.30,1.55],[.42,-.30,1.55]].map(p=>new THREE.Vector3(...p));
const temp={q:new THREE.Quaternion(),qi:new THREE.Quaternion(),position:new THREE.Vector3(),velocity:new THREE.Vector3(),angular:new THREE.Vector3(),point:new THREE.Vector3(),r:new THREE.Vector3(),pointVelocity:new THREE.Vector3(),force:new THREE.Vector3(),forward:new THREE.Vector3(),right:new THREE.Vector3(),wind:new THREE.Vector3(),apparent:new THREE.Vector3(),apparentUnit:new THREE.Vector3(),sample:{height:0,normal:new THREE.Vector3(),velocity:new THREE.Vector3()}};

function makeTexture(kind,renderer){
  const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
  if(kind==='wood'){x.fillStyle='#8b5435';x.fillRect(0,0,512,512);for(let i=0;i<92;i++){const y=i*5.6;x.strokeStyle=`rgba(${42+i%30},24,12,${.07+i%4*.02})`;x.lineWidth=1+(i%5===0);x.beginPath();x.moveTo(0,y);for(let u=0;u<=512;u+=20)x.lineTo(u,y+Math.sin(u*.026+i*.8)*3);x.stroke()}}
  if(kind==='deck'){x.fillStyle='#c39a69';x.fillRect(0,0,512,512);for(let i=0;i<20;i++){x.fillStyle=i%2?'#50321f2c':'#f7dba126';x.fillRect(i*27,0,3,512)}for(let y=0;y<512;y+=86){x.fillStyle='#41271930';x.fillRect(0,y,512,2)}}
  if(kind==='sail'){const g=x.createLinearGradient(0,0,512,512);g.addColorStop(0,'#fffaf0');g.addColorStop(.62,'#e8ddc9');g.addColorStop(1,'#b5a58c');x.fillStyle=g;x.fillRect(0,0,512,512);for(let y=35;y<512;y+=52){x.strokeStyle='#78664f52';x.lineWidth=2;x.beginPath();x.moveTo(0,y);x.lineTo(512,y+8);x.stroke()}for(let i=0;i<5500;i++){const v=210+Math.random()*35;x.fillStyle=`rgba(${v},${v-5},${v-14},.08)`;x.fillRect(Math.random()*512,Math.random()*512,1,1)}}
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return texture;
}

function createHullGeometry(detail=8){
  const vertices=[],indices=[],levels=detail;
  for(let s=0;s<HULL_STATIONS.length;s++){const station=HULL_STATIONS[s];for(let side=0;side<2;side++){const sign=side?1:-1;for(let j=0;j<=levels;j++){const t=j/levels;const handmade=1+Math.sin(s*2.17+j*.73)*.006;const width=station.width*Math.pow(Math.sin(t*Math.PI*.5),.7)*handmade;const y=-BOAT.draftDepth+t*station.height;vertices.push(sign*width,y,station.z)}}}
  const stride=levels+1;
  for(let s=0;s<HULL_STATIONS.length-1;s++)for(let side=0;side<2;side++)for(let j=0;j<levels;j++){const a=(s*2+side)*stride+j,b=a+stride*2;if(side===0)indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,b+1,a+1)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

function createClothSail(width,height,renderer){
  const columns=16,rows=24,positions=[],uvs=[],indices=[];
  for(let y=0;y<=rows;y++){const v=y/rows,currentWidth=width*(1-v*.94);for(let x=0;x<=columns;x++){const u=x/columns;positions.push(currentWidth*u,v*height,0);uvs.push(u,v)}}
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=y*(columns+1)+x,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.userData.base=Float32Array.from(positions);geometry.userData.columns=columns;geometry.userData.rows=rows;
  const texture=makeTexture('sail',renderer);const material=new THREE.MeshPhysicalMaterial({map:texture,bumpMap:texture,bumpScale:.014,color:'#fff6df',side:THREE.DoubleSide,roughness:.72,clearcoat:.05,transmission:.035,thickness:.03,transparent:true,opacity:.985});
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;return mesh;
}

function tube(points,radius,material){return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,radius,7,false),material)}

function createDetailedVisual(renderer){
  const root=new THREE.Group();root.name='VisualHull';
  const wood=makeTexture('wood',renderer),deckTexture=makeTexture('deck',renderer);
  const hullMaterial=new THREE.MeshPhysicalMaterial({map:wood,color:'#8b5435',roughness:.62,metalness:0,clearcoat:.13,clearcoatRoughness:.48});
  const lowerMaterial=new THREE.MeshPhysicalMaterial({map:wood,color:'#284954',roughness:.48,metalness:0,clearcoat:.18,clearcoatRoughness:.38});
  const outer=new THREE.Mesh(createHullGeometry(10),hullMaterial);outer.name='OuterHull';outer.castShadow=outer.receiveShadow=true;root.add(outer);
  const lower=new THREE.Mesh(createHullGeometry(8),lowerMaterial);lower.name='LowerHull';lower.scale.set(1.012,.62,1.012);lower.position.y=-.22;root.add(lower);
  const keel=new THREE.Mesh(new THREE.BoxGeometry(.13,.72,2.45),new THREE.MeshPhysicalMaterial({map:wood,color:'#463128',roughness:.58,clearcoat:.12}));keel.name='Keel';keel.position.set(0,-.72,.1);keel.rotation.x=.02;root.add(keel);
  const inner=new THREE.Mesh(createHullGeometry(6),new THREE.MeshStandardMaterial({map:wood,color:'#39261e',roughness:.78,side:THREE.BackSide}));inner.name='InnerHull';inner.scale.set(.87,.8,.9);inner.position.y=.13;root.add(inner);

  const deck=new THREE.Group();deck.name='Deck';root.add(deck);
  for(let i=-7;i<=7;i++){const plank=new THREE.Mesh(new THREE.BoxGeometry(.095,.055,3.35),new THREE.MeshPhysicalMaterial({map:deckTexture,color:new THREE.Color().setHSL(.075,.34,.5+(i%3)*.018),roughness:.67,clearcoat:.08}));plank.position.set(i*.105,.5,.02);plank.castShadow=true;deck.add(plank)}
  const gunwaleMat=new THREE.MeshPhysicalMaterial({map:wood,color:'#503323',roughness:.55,clearcoat:.14});
  [-1,1].forEach(side=>{root.add(tube([new THREE.Vector3(side*.12,.48,-2.08),new THREE.Vector3(side*.74,.55,-.8),new THREE.Vector3(side*.78,.56,.1),new THREE.Vector3(side*.36,.5,1.95)],.045,gunwaleMat))});
  const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.02,.42,.82),new THREE.MeshPhysicalMaterial({map:wood,color:'#a9784f',roughness:.56,clearcoat:.1}));cabin.name='Cabin';cabin.position.set(0,.72,.35);cabin.castShadow=true;deck.add(cabin);
  const hatch=new THREE.Mesh(new THREE.BoxGeometry(.78,.08,.62),new THREE.MeshPhysicalMaterial({map:deckTexture,color:'#855637',roughness:.62}));hatch.name='Hatch';hatch.position.set(0,.97,-.05);deck.add(hatch);
  const glass=new THREE.MeshPhysicalMaterial({color:'#0d3347',roughness:.08,metalness:.15,transmission:.25,thickness:.03});
  [-1,1].forEach(side=>{const windowMesh=new THREE.Mesh(new THREE.BoxGeometry(.72,.21,.035),glass);windowMesh.position.set(side*.16,.04,-.425);cabin.add(windowMesh)});

  const mastSystem=new THREE.Group();mastSystem.name='MastSystem';root.add(mastSystem);
  const mastMat=new THREE.MeshPhysicalMaterial({map:wood,color:'#543522',roughness:.44,clearcoat:.18});
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,4.2,12),mastMat);mast.name='MainMast';mast.position.set(0,2.55,-.22);mast.castShadow=true;mastSystem.add(mast);
  const boom=new THREE.Mesh(new THREE.CylinderGeometry(.026,.038,2.25,10),mastMat);boom.name='Boom';boom.rotation.z=Math.PI/2;boom.position.set(1.02,1.05,-.2);mastSystem.add(boom);
  const sail=createClothSail(2.05,3.55,renderer);sail.name='MainSail';sail.position.set(.045,1.03,-.19);mastSystem.add(sail);
  const jib=createClothSail(1.18,2.7,renderer);jib.name='JibSail';jib.scale.x=-1;jib.position.set(-.03,1.02,-.2);mastSystem.add(jib);
  const ropeMat=new THREE.MeshStandardMaterial({color:'#aa916c',roughness:.92});
  const ropes=new THREE.Group();ropes.name='Ropes';mastSystem.add(ropes);
  [[new THREE.Vector3(0,4.65,-.22),new THREE.Vector3(-.15,2.1,-.5),new THREE.Vector3(-.52,.58,-1.72)],[new THREE.Vector3(0,4.65,-.22),new THREE.Vector3(.18,2.4,.3),new THREE.Vector3(.48,.58,1.62)],[new THREE.Vector3(0,4.65,-.22),new THREE.Vector3(0,2.2,1.0),new THREE.Vector3(0,.56,2.02)]].forEach(points=>ropes.add(tube(points,.012,ropeMat)));

  const steering=new THREE.Group();steering.name='Steering';root.add(steering);
  const rudder=new THREE.Mesh(new THREE.BoxGeometry(.09,.72,.55),new THREE.MeshPhysicalMaterial({map:wood,color:'#67432c',roughness:.6}));rudder.name='Rudder';rudder.position.set(0,-.3,1.96);steering.add(rudder);
  const metal=new THREE.MeshStandardMaterial({color:'#b48438',metalness:.88,roughness:.3});
  const wheel=new THREE.Group();wheel.name='Wheel';const rim=new THREE.Mesh(new THREE.TorusGeometry(.31,.026,8,28),gunwaleMat);rim.rotation.y=Math.PI/2;wheel.add(rim);for(let i=0;i<8;i++){const spoke=new THREE.Mesh(new THREE.CylinderGeometry(.009,.014,.62,6),gunwaleMat);spoke.rotation.z=Math.PI/2;spoke.rotation.x=i*Math.PI/4;wheel.add(spoke)}wheel.position.set(.48,1.12,1.25);steering.add(wheel);

  const accessories=new THREE.Group();accessories.name='Accessories';root.add(accessories);
  for(let i=0;i<4;i++){const cleat=new THREE.Mesh(new THREE.CapsuleGeometry(.025,.15,3,6),metal);cleat.rotation.z=Math.PI/2;cleat.position.set(i<2?-.62:.62,.62,i%2?-1.15:.72);cleat.name='Cleat';accessories.add(cleat)}
  const anchor=new THREE.Group();anchor.name='Anchor';const shank=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,.48,8),new THREE.MeshStandardMaterial({color:'#31363a',metalness:.9,roughness:.42}));shank.rotation.z=Math.PI/2;anchor.add(shank);anchor.position.set(-.67,.38,-1.3);accessories.add(anchor);
  const lanternGlass=new THREE.MeshPhysicalMaterial({color:'#ffd27a',emissive:'#ff9d32',emissiveIntensity:2,transmission:.5,roughness:.08});
  const lantern=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.18,10),lanternGlass);lantern.name='Lantern';lantern.position.set(0,1.05,1.62);accessories.add(lantern);
  const flag=createClothSail(.55,.28,renderer);flag.name='Flag';flag.rotation.z=-Math.PI/2;flag.position.set(0,4.58,-.2);accessories.add(flag);

  root.userData={hullMaterial,lowerMaterial,sail,jib,rudder,flag,wetness:0};
  return root;
}

function createSimplifiedVisual(renderer,distant=false){
  const root=new THREE.Group(),wood=makeTexture('wood',renderer);
  const hull=new THREE.Mesh(createHullGeometry(distant?3:5),new THREE.MeshStandardMaterial({map:wood,color:'#76503a',roughness:.68}));hull.castShadow=!distant;root.add(hull);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.04,.055,4.1,distant?6:8),new THREE.MeshStandardMaterial({color:'#4b3222',roughness:.65}));mast.position.set(0,2.5,-.22);root.add(mast);
  const sail=createClothSail(2,3.5,renderer);sail.position.set(.04,1.04,-.19);root.add(sail);
  return root;
}

export function createBoatVisual(renderer){
  const boatRoot=new THREE.Group();boatRoot.name='BoatRoot';
  const physicsHull=new THREE.Object3D();physicsHull.name='PhysicsHull';physicsHull.visible=false;boatRoot.add(physicsHull);
  const lod=new THREE.LOD();lod.name='BoatLOD';const high=createDetailedVisual(renderer),medium=createSimplifiedVisual(renderer),distant=createSimplifiedVisual(renderer,true);
  lod.addLevel(high,0);lod.addLevel(medium,30);lod.addLevel(distant,100);lod.fadeDuration=.35;boatRoot.add(lod);
  boatRoot.userData={high,lod,physicsHull};return boatRoot;
}

function deformCloth(mesh,environment,time,tension=.78){
  if(!mesh?.geometry?.userData?.base)return;const position=mesh.geometry.attributes.position,base=mesh.geometry.userData.base,columns=mesh.geometry.userData.columns,rows=mesh.geometry.userData.rows;
  const gust=Math.sin(time*1.7+mesh.id)*environment.gustStrength;
  for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){const index=(y*(columns+1)+x)*3,u=x/columns,v=y/rows,attachment=Math.sin(Math.PI*u)*Math.sin(Math.PI*v);position.array[index]=base[index];position.array[index+1]=base[index+1];position.array[index+2]=attachment*(environment.windSpeed*.018+gust)*tension+Math.sin(v*8-time*2.3+u*3)*attachment*.018}
  position.needsUpdate=true;mesh.geometry.computeVertexNormals();
}

export function createBoatPhysics(RAPIER,world,boatRoot,ocean){
  const parameters={...BOAT,centreOfMass:0};
  const bodyDesc=RAPIER.RigidBodyDesc.dynamic().setTranslation(0,.25,0).setLinearDamping(.12).setAngularDamping(parameters.angularDamping);
  const body=world.createRigidBody(bodyDesc);body.setLinvel({x:0,y:0,z:-2.4},true);
  const density=parameters.mass/(parameters.length*parameters.beam*parameters.hullHeight*.52);
  const colliderDesc=RAPIER.ColliderDesc.cuboid(parameters.beam*.42,parameters.hullHeight*.36,parameters.length*.43).setTranslation(0,-.08,0).setDensity(density);
  const collider=world.createCollider(colliderDesc,body);collider.setFriction(.2);
  let accumulator=0,rudderInput=0,sailTrim=.82,anchored=false,forwardSpeed=0;

  function fixedStep(environment,time){
    const p=body.translation(),r=body.rotation(),v=body.linvel(),av=body.angvel();
    temp.position.set(p.x,p.y,p.z);temp.q.set(r.x,r.y,r.z,r.w);temp.velocity.set(v.x,v.y,v.z);temp.angular.set(av.x,av.y,av.z);
    temp.forward.set(0,0,-1).applyQuaternion(temp.q);temp.right.set(1,0,0).applyQuaternion(temp.q);
    for(const pointLocal of BUOYANCY_POINTS){
      temp.point.copy(pointLocal);temp.point.y-=parameters.centreOfMass;temp.point.applyQuaternion(temp.q).add(temp.position);const sample=ocean.sampleOceanSurface(temp.point.x,temp.point.z,time,temp.sample);const depth=sample.height-temp.point.y;
      if(depth>0){temp.r.copy(temp.point).sub(temp.position);temp.pointVelocity.copy(temp.angular).cross(temp.r).add(temp.velocity);const relativeY=temp.pointVelocity.y-sample.velocity.y;const upward=THREE.MathUtils.clamp(depth*parameters.buoyancyStrength-relativeY*parameters.buoyancyDamping,0,720);body.addForceAtPoint({x:0,y:upward,z:0},{x:temp.point.x,y:temp.point.y,z:temp.point.z},true)}
    }
    forwardSpeed=temp.velocity.dot(temp.forward);const sideSpeed=temp.velocity.dot(temp.right);
    temp.force.copy(temp.forward).multiplyScalar(-forwardSpeed*Math.abs(forwardSpeed)*parameters.forwardDrag).addScaledVector(temp.right,-sideSpeed*Math.abs(sideSpeed)*parameters.sideDrag);temp.force.y+=-temp.velocity.y*parameters.verticalDrag*parameters.mass;
    body.addForce({x:temp.force.x,y:temp.force.y,z:temp.force.z},true);
    if(anchored){body.addForce({x:-v.x*180,y:0,z:-v.z*180},true)}else{
      temp.wind.copy(environment.windDirection).multiplyScalar(environment.windSpeed);temp.apparent.copy(temp.wind).sub(temp.velocity);const apparentSpeed=temp.apparent.length();temp.apparentUnit.copy(temp.apparent).normalize();const angle=Math.acos(THREE.MathUtils.clamp(temp.apparentUnit.dot(temp.forward),-1,1));const sideWind=temp.apparentUnit.dot(temp.right);const efficiency=Math.max(.12,Math.abs(Math.sin(angle)))*sailTrim;
      const sailForce=THREE.MathUtils.clamp(apparentSpeed*apparentSpeed*2.6*parameters.sailForce*efficiency,0,520);temp.force.copy(temp.forward).multiplyScalar(sailForce).addScaledVector(temp.right,-sideWind*sailForce*.28);const sailPoint=temp.point.set(0,2.45,-.1).applyQuaternion(temp.q).add(temp.position);body.addForceAtPoint({x:temp.force.x,y:temp.force.y,z:temp.force.z},{x:sailPoint.x,y:sailPoint.y,z:sailPoint.z},true);
      const rudderForce=THREE.MathUtils.clamp(forwardSpeed*forwardSpeed*rudderInput*parameters.rudderEfficiency*36,-320,320);temp.force.copy(temp.right).multiplyScalar(rudderForce);const rudderPoint=temp.point.set(0,-.05,1.85).applyQuaternion(temp.q).add(temp.position);body.addForceAtPoint({x:temp.force.x,y:0,z:temp.force.z},{x:rudderPoint.x,y:rudderPoint.y,z:rudderPoint.z},true);
    }
    world.step();
  }

  function update(dt,time,environment,controls){
    rudderInput=THREE.MathUtils.damp(rudderInput,controls.rudder,5,dt);sailTrim=THREE.MathUtils.damp(sailTrim,controls.sailTrim,3,dt);anchored=controls.anchored;accumulator+=Math.min(dt,.08);let steps=0;
    while(accumulator>=1/60&&steps<4){fixedStep(environment,time);accumulator-=1/60;steps++}
    const p=body.translation(),r=body.rotation();boatRoot.position.set(p.x,p.y,p.z);boatRoot.quaternion.set(r.x,r.y,r.z,r.w);
    const high=boatRoot.userData.high;deformCloth(high.userData.sail,environment,time,sailTrim);deformCloth(high.userData.jib,environment,time,sailTrim*.7);deformCloth(high.userData.flag,environment,time,.55);
    high.userData.rudder.rotation.y=rudderInput*.55;high.userData.wetness=THREE.MathUtils.damp(high.userData.wetness,environment.wetness,1.2,dt);high.userData.lowerMaterial.roughness=THREE.MathUtils.lerp(.52,.28,high.userData.wetness);
    return {speedKnots:Math.abs(forwardSpeed)*1.94384,forwardSpeed,position:boatRoot.position,quaternion:boatRoot.quaternion};
  }
  return {body,collider,parameters,buoyancyPoints:BUOYANCY_POINTS,update,setVelocity(z){body.setLinvel({x:0,y:0,z},true)}};
}
