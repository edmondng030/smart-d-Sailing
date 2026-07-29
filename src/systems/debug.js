import * as THREE from 'three';
import { BOAT } from '../config.js';

const worldPoint=new THREE.Vector3(),windOrigin=new THREE.Vector3(),direction=new THREE.Vector3(),normal=new THREE.Vector3();
const windAngleVector=new THREE.Vector3();

export function createDebugPanel(scene,boatRoot,boatPhysics,ocean,environment){
  if(!import.meta.env.DEV)return{update(){},dispose(){}};
  const values={waveAmplitude:1,waveDirection:0,waveSpeed:1,windSpeed:environment.state.windSpeed,windDirection:14,buoyancyStrength:BOAT.buoyancyStrength,buoyancyDamping:BOAT.buoyancyDamping,forwardDrag:BOAT.forwardDrag,sideDrag:BOAT.sideDrag,boatMass:BOAT.mass,centreOfMass:0,sailForce:BOAT.sailForce,rudderEfficiency:BOAT.rudderEfficiency,exposure:1,sunElevation:45,shadowBounds:24,fogDensity:environment.state.fogDensity,foamThreshold:.48};
  const panel=document.createElement('aside');panel.className='dev-panel';panel.innerHTML='<header><b>SAIL LAB</b><span>F8</span></header><div class="dev-fields"></div><footer>Physics visuals <button data-debug-visuals>OFF</button></footer>';document.body.append(panel);
  const fields=panel.querySelector('.dev-fields'),labels={waveAmplitude:'Wave amplitude',waveDirection:'Wave direction',waveSpeed:'Wave speed',windSpeed:'Wind speed',windDirection:'Wind direction',buoyancyStrength:'Buoyancy strength',buoyancyDamping:'Buoyancy damping',forwardDrag:'Forward drag',sideDrag:'Side drag',boatMass:'Boat mass',centreOfMass:'Centre of mass',sailForce:'Sail force',rudderEfficiency:'Rudder efficiency',exposure:'Exposure',sunElevation:'Sun elevation',shadowBounds:'Shadow bounds',fogDensity:'Fog density',foamThreshold:'Foam threshold'};
  const ranges={waveAmplitude:[.2,2,.01],waveDirection:[-180,180,1],waveSpeed:[.2,2,.01],windSpeed:[0,20,.1],windDirection:[-180,180,1],buoyancyStrength:[100,1200,10],buoyancyDamping:[20,300,5],forwardDrag:[.1,4,.05],sideDrag:[1,9,.1],boatMass:[80,600,5],centreOfMass:[-.5,.5,.01],sailForce:[.1,4,.05],rudderEfficiency:[.1,3,.05],exposure:[.2,1.5,.01],sunElevation:[-10,90,1],shadowBounds:[8,60,1],fogDensity:[0,.01,.0001],foamThreshold:[.1,.9,.01]};
  Object.entries(values).forEach(([key,value])=>{const[min,max,step]=ranges[key],label=document.createElement('label');label.innerHTML=`<span>${labels[key]} <output>${value}</output></span><input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}">`;fields.append(label)});

  const oceanDebug=document.createElement('label');oceanDebug.innerHTML='<span>Ocean debug</span><select data-ocean-debug><option value="final">Final</option><option value="cascades">Cascade bands</option><option value="normals">Normals</option><option value="foam">Foam history</option><option value="fresnel">Fresnel</option><option value="reflection">Reflection</option><option value="absorption">Absorption</option><option value="no-foam">Final without foam</option><option value="no-detail">Final without detail</option><option value="jacobian">Jacobian</option><option value="lod">LOD weights</option><option value="detail">Micro-surface</option><option value="subsurface">Crest subsurface</option></select>';fields.append(oceanDebug);

  const debugGroup=new THREE.Group();debugGroup.name='PhysicsDebug';debugGroup.visible=false;scene.add(debugGroup);
  const localMarkers=new THREE.Group();localMarkers.visible=false;boatRoot.add(localMarkers);
  boatPhysics.buoyancyPoints.forEach(point=>{const marker=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),new THREE.MeshBasicMaterial({color:'#48e8ff',depthTest:false}));marker.position.copy(point);localMarkers.add(marker)});
  const collider=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(BOAT.beam*.84,BOAT.hullHeight*.72,BOAT.length*.86)),new THREE.LineBasicMaterial({color:'#ffcf5a',depthTest:false}));collider.position.y=-.08;localMarkers.add(collider);
  const centre=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),new THREE.MeshBasicMaterial({color:'#ff4f72',depthTest:false}));localMarkers.add(centre);
  const windArrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),boatRoot.position,4,'#ff6a62');debugGroup.add(windArrow);
  const waterSamples=boatPhysics.buoyancyPoints.map(()=>{const marker=new THREE.Mesh(new THREE.SphereGeometry(.04,8,6),new THREE.MeshBasicMaterial({color:'#5cff8d',depthTest:false}));const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),.5,'#5cff8d');debugGroup.add(marker,arrow);return{marker,arrow}});
  const shadowHelper=new THREE.CameraHelper(environment.sunLight.shadow.camera);shadowHelper.visible=false;scene.add(shadowHelper);

  function applyValues(){
    Object.assign(boatPhysics.parameters,{buoyancyStrength:values.buoyancyStrength,buoyancyDamping:values.buoyancyDamping,forwardDrag:values.forwardDrag,sideDrag:values.sideDrag,mass:values.boatMass,centreOfMass:values.centreOfMass,sailForce:values.sailForce,rudderEfficiency:values.rudderEfficiency});
    const volume=BOAT.length*BOAT.beam*BOAT.hullHeight*.52;boatPhysics.collider.setDensity(values.boatMass/volume);
    const waveAngle=THREE.MathUtils.degToRad(values.waveDirection),c=Math.cos(waveAngle),s=Math.sin(waveAngle);
    ocean.waves.forEach(wave=>{const[x,z]=wave.baseDirection;wave.direction[0]=x*c-z*s;wave.direction[1]=x*s+z*c;wave.speed=wave.baseSpeed*values.waveSpeed});
    environment.target.waveIntensity=values.waveAmplitude;environment.target.foam=values.foamThreshold;
    const windAngle=THREE.MathUtils.degToRad(values.windDirection);environment.target.windDirection.set(Math.cos(windAngle),0,Math.sin(windAngle));environment.target.windSpeed=values.windSpeed;environment.target.fogDensity=values.fogDensity;environment.target.exposure=values.exposure;
    const elevation=THREE.MathUtils.clamp(values.sunElevation,0,72),dayT=Math.asin(elevation/72)/Math.PI;environment.target.time=6+dayT*16;
    const bounds=values.shadowBounds,camera=environment.sunLight.shadow.camera;camera.left=camera.bottom=-bounds;camera.right=camera.top=bounds;camera.updateProjectionMatrix();centre.position.y=values.centreOfMass;
  }
  panel.addEventListener('input',event=>{const input=event.target,key=input.dataset.key;if(!key)return;values[key]=+input.value;input.previousElementSibling.querySelector('output').textContent=values[key];applyValues()});
  panel.querySelector('[data-ocean-debug]').addEventListener('change',event=>ocean.setDebugMode(event.target.value));
  panel.querySelector('[data-debug-visuals]').addEventListener('click',event=>{debugGroup.visible=localMarkers.visible=shadowHelper.visible=!debugGroup.visible;event.target.textContent=debugGroup.visible?'ON':'OFF'});
  addEventListener('keydown',event=>{if(event.key==='F8'){event.preventDefault();panel.classList.toggle('open')}});

  function update(time=performance.now()/1000){
    if(!debugGroup.visible)return;boatRoot.updateMatrixWorld();
    windOrigin.copy(boatRoot.position).addScalar(0);windOrigin.y+=3;windArrow.position.copy(windOrigin);windArrow.setDirection(environment.state.windDirection);windArrow.setLength(Math.max(1,environment.state.windSpeed*.5));
    boatPhysics.buoyancyPoints.forEach((point,index)=>{worldPoint.copy(point).applyMatrix4(boatRoot.matrixWorld);const sample=ocean.sampleOceanSurface(worldPoint.x,worldPoint.z,time);const visual=waterSamples[index];visual.marker.position.set(worldPoint.x,sample.height,worldPoint.z);visual.arrow.position.copy(visual.marker.position);visual.arrow.setDirection(normal.copy(sample.normal));visual.arrow.setLength(.45)});
    shadowHelper.update();
  }
  applyValues();
  return{values,panel,update,dispose(){panel.remove();scene.remove(debugGroup,shadowHelper);boatRoot.remove(localMarkers)}};
}
