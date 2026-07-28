import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { WEATHER_PRESETS, QUALITY_PRESETS } from '../config.js';

const colour = hex => new THREE.Color(hex);
const sunPosition = new THREE.Vector3();

export function createEnvironmentSystem(scene, renderer) {
  const sky = new Sky(); sky.scale.setScalar(4500); scene.add(sky);
  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 6; skyUniforms.rayleigh.value = 2.2; skyUniforms.mieCoefficient.value = .006; skyUniforms.mieDirectionalG.value = .82;

  const hemisphere = new THREE.HemisphereLight('#dff5ff', '#15353d', 1.8); scene.add(hemisphere);
  const sunLight = new THREE.DirectionalLight('#fff0c0', 3.4);
  sunLight.castShadow = true; sunLight.shadow.camera.left = -24; sunLight.shadow.camera.right = 24;
  sunLight.shadow.camera.top = 24; sunLight.shadow.camera.bottom = -24; sunLight.shadow.camera.near = .5; sunLight.shadow.camera.far = 90;
  scene.add(sunLight);scene.add(sunLight.target);
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(2.3, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff0c0', fog: false }));
  scene.add(sunDisc);

  const state = {
    preset:'clear', time:14.5, windDirection:new THREE.Vector3(1,0,.25).normalize(), windSpeed:6, gustStrength:.16,
    rainIntensity:0, cloudCoverage:.25, waveIntensity:1, fogDensity:.0007, sunElevation:45, sunAzimuth:220,
    wetness:.15, foam:.48, deep:colour('#082f4f'), mid:colour('#0f6681'), shallow:colour('#3ca6a0'),
    sky:colour('#8fc6df'), horizon:colour('#c9dde0'), sun:colour('#fff0c0'), exposure:1
  };
  const target = { ...state, windDirection:state.windDirection.clone(), deep:state.deep.clone(), mid:state.mid.clone(), shallow:state.shallow.clone(), sky:state.sky.clone(), horizon:state.horizon.clone(), sun:state.sun.clone() };
  scene.fog = new THREE.FogExp2(state.horizon, state.fogDensity);

  const cloudTexture = (() => {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const context=canvas.getContext('2d');
    const gradient=context.createRadialGradient(128,128,12,128,128,118);
    gradient.addColorStop(0,'rgba(255,255,255,.92)');gradient.addColorStop(.48,'rgba(245,250,248,.58)');gradient.addColorStop(1,'rgba(255,255,255,0)');
    context.fillStyle=gradient;context.fillRect(0,0,256,256);return new THREE.CanvasTexture(canvas);
  })();
  const highClouds=new THREE.Group(),mediumClouds=new THREE.Group();scene.add(highClouds,mediumClouds);
  for(let i=0;i<18;i++){const material=new THREE.SpriteMaterial({map:cloudTexture,transparent:true,opacity:.12,depthWrite:false,fog:false});const sprite=new THREE.Sprite(material);sprite.position.set((Math.random()-.5)*650,100+Math.random()*35,-80-Math.random()*450);sprite.scale.set(90+Math.random()*130,24+Math.random()*35,1);highClouds.add(sprite)}
  for(let i=0;i<16;i++){const group=new THREE.Group();const material=new THREE.MeshStandardMaterial({color:'#f4f6f2',transparent:true,opacity:.36,roughness:1,depthWrite:false});for(let j=0;j<5;j++){const puff=new THREE.Mesh(new THREE.SphereGeometry(5+Math.random()*5,10,7),material);puff.position.set(j*6,Math.sin(j)*2,Math.random()*4);puff.scale.y=.55;group.add(puff)}group.position.set((Math.random()-.5)*420,55+Math.random()*40,-90-Math.random()*380);mediumClouds.add(group)}

  const rainGeometry=new THREE.BufferGeometry(),rainPositions=new Float32Array(900*3);
  for(let i=0;i<900;i++){rainPositions[i*3]=(Math.random()-.5)*70;rainPositions[i*3+1]=Math.random()*45;rainPositions[i*3+2]=(Math.random()-.5)*70}
  rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rain=new THREE.Points(rainGeometry,new THREE.PointsMaterial({color:'#b8d2dd',size:.045,transparent:true,opacity:0,depthWrite:false}));scene.add(rain);

  function setPreset(name){
    const preset=WEATHER_PRESETS[name]||WEATHER_PRESETS.clear;target.preset=name;
    target.sky.set(preset.sky);target.horizon.set(preset.horizon);target.sun.set(preset.sun);target.deep.set(preset.deep);target.mid.set(preset.mid);target.shallow.set(preset.shallow);
    target.exposure=preset.exposure;target.fogDensity=preset.fog;target.windSpeed=preset.windSpeed;target.waveIntensity=preset.waveIntensity;
    target.cloudCoverage=preset.cloudCoverage;target.rainIntensity=preset.rain;target.wetness=preset.wetness;target.foam=preset.foam;
  }
  function setTime(hour){target.time=hour}
  function setQuality(name){const limit=QUALITY_PRESETS[name]?.cloudCount||28;highClouds.children.forEach((cloud,index)=>cloud.visible=index<Math.ceil(limit*.45));mediumClouds.children.forEach((cloud,index)=>cloud.visible=index<Math.ceil(limit*.55));rain.geometry.setDrawRange(0,Math.min(900,limit*24))}

  function update(dt,elapsed,focusPosition){
    const blend=1-Math.exp(-dt*.55);
    for(const key of ['time','exposure','fogDensity','windSpeed','waveIntensity','cloudCoverage','rainIntensity','wetness','foam'])state[key]=THREE.MathUtils.lerp(state[key],target[key],blend);
    for(const key of ['sky','horizon','sun','deep','mid','shallow'])state[key].lerp(target[key],blend);state.windDirection.lerp(target.windDirection,blend).normalize();
    const dayT=THREE.MathUtils.clamp((state.time-6)/16,0,1),elevation=Math.sin(dayT*Math.PI)*72,azimuth=205+dayT*70;
    state.sunElevation=elevation;state.sunAzimuth=azimuth;
    const phi=THREE.MathUtils.degToRad(90-elevation),theta=THREE.MathUtils.degToRad(azimuth);sunPosition.setFromSphericalCoords(100,phi,theta);
    skyUniforms.sunPosition.value.copy(sunPosition);sunLight.position.copy(focusPosition).addScaledVector(sunPosition,.45);
    sunLight.target.position.copy(focusPosition);sunLight.color.copy(state.sun);sunLight.intensity=THREE.MathUtils.lerp(.25,3.6,Math.max(0,Math.sin(THREE.MathUtils.degToRad(elevation))));
    sunDisc.position.copy(focusPosition).addScaledVector(sunPosition,.74);sunDisc.material.color.copy(state.sun);
    hemisphere.color.copy(state.sky);hemisphere.groundColor.copy(state.deep);hemisphere.intensity=.55+Math.max(0,Math.sin(THREE.MathUtils.degToRad(elevation)))*1.45;
    scene.fog.color.copy(state.horizon);scene.fog.density=state.fogDensity;renderer.toneMappingExposure=THREE.MathUtils.damp(renderer.toneMappingExposure,state.exposure,.8,dt);
    mediumClouds.children.forEach((cloud,index)=>{cloud.position.x+=state.windDirection.x*state.windSpeed*dt*.18;cloud.position.z+=state.windDirection.z*state.windSpeed*dt*.18;cloud.rotation.z=Math.sin(elapsed*.07+index)*.025;cloud.children[0].material.opacity=state.cloudCoverage*.55;if(cloud.position.x>260)cloud.position.x=-260});
    highClouds.position.x+=state.windDirection.x*state.windSpeed*dt*.04;if(highClouds.position.x>180)highClouds.position.x=-180;
    rain.position.copy(focusPosition);rain.material.opacity=state.rainIntensity*.8;const positions=rain.geometry.attributes.position;for(let i=0;i<900;i++){positions.array[i*3+1]-=dt*(28+state.windSpeed);positions.array[i*3]+=state.windDirection.x*dt*state.windSpeed;if(positions.array[i*3+1]<0)positions.array[i*3+1]=45}positions.needsUpdate=true;
    return state;
  }

  return {state,target,sky,sunLight,sunDisc,setPreset,setTime,setQuality,update,dispose(){cloudTexture.dispose();rainGeometry.dispose()}};
}
