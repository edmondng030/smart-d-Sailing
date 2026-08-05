import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { WEATHER_PRESETS, QUALITY_PRESETS } from '../config.js';

const colour = hex => new THREE.Color(hex);
const SUN_DISTANCE = 3400;
const SUN_ANGULAR_RADIUS = .004675;
const SUN_VISUAL_RADIUS = .0135;
const SKY_SUN_DISTANCE = 450000;
const DAY_SUN = colour('#fff7df');
const LOW_SUN = colour('#ff7b48');
const OVERCAST_SUN = colour('#d8dfdd');
const WHITE = colour('#ffffff');
const sunPosition = new THREE.Vector3();
const sunDirection = new THREE.Vector3();
const litCloudColour = new THREE.Color();

function smoothstep(min, max, value) {
  const t = THREE.MathUtils.clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function createRadialTexture(stops) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([offset, value]) => gradient.addColorStop(offset, value));
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSunVisual() {
  const coreTexture = createRadialTexture([
    [0, 'rgba(255,255,255,1)'], [.78, 'rgba(255,252,235,1)'],
    [.94, 'rgba(255,236,190,.98)'], [1, 'rgba(255,220,160,0)']
  ]);
  const haloTexture = createRadialTexture([
    [0, 'rgba(255,245,211,.95)'], [.08, 'rgba(255,224,155,.42)'],
    [.28, 'rgba(255,180,105,.12)'], [1, 'rgba(255,160,80,0)']
  ]);
  const coreMaterial = new THREE.SpriteMaterial({
    map:coreTexture, color:'#fff7df', transparent:true, depthWrite:false,
    depthTest:true, fog:false, toneMapped:false
  });
  const haloMaterial = new THREE.SpriteMaterial({
    map:haloTexture, color:'#ffc077', transparent:true, opacity:.34,
    depthWrite:false, depthTest:true, fog:false, toneMapped:false,
    blending:THREE.AdditiveBlending
  });
  const group = new THREE.Group(); group.name = 'AtmosphericSun';
  const halo = new THREE.Sprite(haloMaterial); halo.name = 'SunHalo'; halo.scale.setScalar(420); halo.renderOrder = -8;
  const core = new THREE.Sprite(coreMaterial); core.name = 'SunDisc';
  core.scale.setScalar(2 * Math.tan(SUN_VISUAL_RADIUS) * SUN_DISTANCE); core.renderOrder = -7;
  group.add(halo, core);
  return {group, core, halo, coreTexture, haloTexture};
}

export function createEnvironmentSystem(scene, renderer) {
  const sky = new Sky(); sky.name = 'AnalyticAtmosphere'; sky.scale.setScalar(5000); scene.add(sky);
  const skyUniforms = sky.material.uniforms;
  skyUniforms.sunTint = {value:DAY_SUN.clone()};
  skyUniforms.sunDiscIntensity = {value:4200};
  skyUniforms.clearSkyColor = {value:colour('#4c9fd6')};
  skyUniforms.clearSkyAmount = {value:1};
  skyUniforms.skyRadianceScale = {value:.024};
  sky.material.fragmentShader = sky.material.fragmentShader
    .replace('uniform vec3 up;', 'uniform vec3 up; uniform vec3 sunTint; uniform float sunDiscIntensity; uniform float skyRadianceScale; uniform vec3 clearSkyColor; uniform float clearSkyAmount;')
    .replace('L0 += ( vSunE * 19000.0 * Fex ) * sundisk;', 'L0 += sunTint * (vSunE * sunDiscIntensity * Fex) * sundisk;')
    .replace('gl_FragColor = vec4( retColor, 1.0 );', 'float skyHeight = clamp(direction.y, 0.0, 1.0);\n       vec3 blueSky = mix(vec3(.62, .84, 1.18), clearSkyColor * 1.65, pow(skyHeight, .6));\n       float sunProtection = 1.0 - smoothstep(.97, .99992, cosTheta);\n       float blueGrade = clearSkyAmount * smoothstep(-.04, .36, direction.y) * sunProtection;\n       retColor = mix(retColor, max(retColor, blueSky * .58), blueGrade * .8);\n       gl_FragColor = vec4( retColor, 1.0 );')
    .replace('( Lin + L0 ) * 0.04', '( Lin + L0 ) * skyRadianceScale')
    .replace(
      '#include <colorspace_fragment>',
      `float lowSunGrade = pow(1.0 - clamp(dot(up, vSunDirection), 0.0, 1.0), 3.0);
       gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * (sunTint * 1.15 + .08), lowSunGrade * .7);
       float atmosphereDither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
       gl_FragColor.rgb += (atmosphereDither - .5) / 255.0;
       #include <colorspace_fragment>`
    );
  sky.material.needsUpdate = true;

  const hemisphere = new THREE.HemisphereLight('#dff5ff', '#15353d', 1.8); scene.add(hemisphere);
  const sunLight = new THREE.DirectionalLight('#fff0c0', 3.4);
  sunLight.castShadow = true; sunLight.shadow.camera.left = -24; sunLight.shadow.camera.right = 24;
  sunLight.shadow.camera.top = 24; sunLight.shadow.camera.bottom = -24; sunLight.shadow.camera.near = .5; sunLight.shadow.camera.far = 90;
  scene.add(sunLight); scene.add(sunLight.target);
  const sunVisual = createSunVisual(); scene.add(sunVisual.group);

  const state = {
    preset:'clear', time:14.5, windDirection:new THREE.Vector3(1,0,.25).normalize(), windSpeed:6, gustStrength:.16,
    rainIntensity:0, cloudCoverage:.25, waveIntensity:1, fogDensity:.0007, sunElevation:45, sunAzimuth:220,
    sunDirection:new THREE.Vector3(), sunRadiance:colour('#fff0c0'), sunIntensity:1,
    wetness:.15, foam:.48, deep:colour('#082f4f'), mid:colour('#0f6681'), shallow:colour('#3ca6a0'),
    sky:colour('#8fc6df'), horizon:colour('#c9dde0'), sun:colour('#fff0c0'), exposure:1
  };
  const target = {
    ...state, windDirection:state.windDirection.clone(), sunDirection:state.sunDirection.clone(),
    sunRadiance:state.sunRadiance.clone(), deep:state.deep.clone(), mid:state.mid.clone(), shallow:state.shallow.clone(),
    sky:state.sky.clone(), horizon:state.horizon.clone(), sun:state.sun.clone()
  };
  const diagnostics = {
    tier:'analytic-ground-atmosphere', sunAngularRadius:SUN_ANGULAR_RADIUS,
    unitScale:'one-metre-per-unit', dither:true, sharedSunDirection:true,
    turbidity:6, rayleigh:2.2, mieCoefficient:.006, mieDirectionalG:.82, sunVisibility:1
  };
  scene.fog = new THREE.FogExp2(state.horizon, state.fogDensity);

  const random = seededRandom(0x5A17A7);
  const cloudTexture = createRadialTexture([
    [0,'rgba(255,255,255,.94)'], [.48,'rgba(245,250,248,.58)'], [1,'rgba(255,255,255,0)']
  ]);
  const highCloudMaterial = new THREE.SpriteMaterial({
    map:cloudTexture, color:'#ffffff', transparent:true, opacity:.12, depthWrite:false, fog:false
  });
  const mediumCloudMaterial = new THREE.MeshStandardMaterial({
    color:'#f4f6f2', transparent:true, opacity:.36, roughness:1, depthWrite:false
  });
  const puffGeometry = new THREE.SphereGeometry(1,10,7);
  const highClouds=new THREE.Group(), mediumClouds=new THREE.Group(); scene.add(highClouds,mediumClouds);
  for(let i=0;i<18;i++){
    const sprite=new THREE.Sprite(highCloudMaterial);
    sprite.position.set((random()-.5)*650,100+random()*35,-80-random()*450);
    sprite.scale.set(90+random()*130,24+random()*35,1); highClouds.add(sprite);
  }
  for(let i=0;i<16;i++){
    const group=new THREE.Group(); group.userData.phase=random()*Math.PI*2;
    for(let j=0;j<5;j++){
      const puff=new THREE.Mesh(puffGeometry,mediumCloudMaterial);
      const size=5+random()*5; puff.position.set(j*6,Math.sin(j)*2,random()*4); puff.scale.set(size,size*.55,size); group.add(puff);
    }
    group.position.set((random()-.5)*420,55+random()*40,-90-random()*380); mediumClouds.add(group);
  }

  const rainGeometry=new THREE.BufferGeometry(),rainPositions=new Float32Array(900*3);
  for(let i=0;i<900;i++){rainPositions[i*3]=(random()-.5)*70;rainPositions[i*3+1]=random()*45;rainPositions[i*3+2]=(random()-.5)*70}
  rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rainMaterial=new THREE.PointsMaterial({color:'#b8d2dd',size:.045,transparent:true,opacity:0,depthWrite:false});
  const rain=new THREE.Points(rainGeometry,rainMaterial);scene.add(rain);

  const launchParams = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
  const requestedHour = launchParams?.has('hour') ? Number(launchParams.get('hour')) : null;
  const lockedHour = Number.isFinite(requestedHour) ? requestedHour : null;
  const lockedWeather = launchParams?.get('weather');
  const presetHours = {clear:14.5, cloudy:15, sunset:18.25, fog:8.5, night:23};

  function setPreset(name){
    const resolvedName = lockedWeather && WEATHER_PRESETS[lockedWeather] ? lockedWeather : name;
    const preset=WEATHER_PRESETS[resolvedName]||WEATHER_PRESETS.clear; target.preset=resolvedName;
    target.sky.set(preset.sky);target.horizon.set(preset.horizon);target.sun.set(preset.sun);target.deep.set(preset.deep);target.mid.set(preset.mid);target.shallow.set(preset.shallow);
    const exposureScale={clear:1.02,cloudy:.84,sunset:.72,fog:.82,night:1}[resolvedName]||1;
    target.exposure=preset.exposure*exposureScale;target.fogDensity=preset.fog;target.windSpeed=preset.windSpeed;target.waveIntensity=preset.waveIntensity;
    target.cloudCoverage=resolvedName==='clear'?preset.cloudCoverage*.45:preset.cloudCoverage;target.rainIntensity=preset.rain;target.wetness=preset.wetness;target.foam=preset.foam;
    if (lockedHour == null && presetHours[resolvedName] != null) target.time=presetHours[resolvedName];
  }
  function setTime(hour){target.time=lockedHour ?? hour}
  function setQuality(name){
    const limit=QUALITY_PRESETS[name]?.cloudCount||28;
    highClouds.children.forEach((cloud,index)=>cloud.visible=index<Math.ceil(limit*.45));
    mediumClouds.children.forEach((cloud,index)=>cloud.visible=index<Math.ceil(limit*.55));
    rain.geometry.setDrawRange(0,Math.min(900,limit*24)); sunVisual.halo.visible=name!=='low';
  }

  function update(dt,elapsed,focusPosition){
    const blend=1-Math.exp(-dt*.55);
    for(const key of ['time','exposure','fogDensity','windSpeed','waveIntensity','cloudCoverage','rainIntensity','wetness','foam'])state[key]=THREE.MathUtils.lerp(state[key],target[key],blend);
    for(const key of ['sky','horizon','sun','deep','mid','shallow'])state[key].lerp(target[key],blend);
    state.preset=target.preset; state.windDirection.lerp(target.windDirection,blend).normalize();

    const dayT=(state.time-6)/13;
    const elevation=Math.sin(dayT*Math.PI)*72;
    const azimuth=205+THREE.MathUtils.clamp(dayT,0,1)*70;
    const phi=THREE.MathUtils.degToRad(90-elevation),theta=THREE.MathUtils.degToRad(azimuth);
    sunPosition.setFromSphericalCoords(SKY_SUN_DISTANCE,phi,theta); sunDirection.copy(sunPosition).normalize();
    state.sunElevation=elevation;state.sunAzimuth=azimuth;state.sunDirection.copy(sunDirection);

    const daylight=smoothstep(-6,6,elevation);
    const altitudeLight=Math.max(0,Math.sin(THREE.MathUtils.degToRad(elevation)));
    const horizonWeight=1-smoothstep(7,38,elevation);
    const haze=THREE.MathUtils.clamp(state.fogDensity/.0042,0,1);
    const clearConditions=state.preset==='clear';
    const aerosol=clearConditions
      ? Math.max(state.cloudCoverage*.42,haze*.6,horizonWeight*.28)
      : Math.max(state.cloudCoverage*.72,haze*.9,horizonWeight*.42);
    const targetTurbidity=THREE.MathUtils.lerp(clearConditions?2.6:3.8,13.5,aerosol);
    const targetRayleigh=THREE.MathUtils.lerp(clearConditions?3.45:2.7,1.35,state.cloudCoverage*.62);
    const targetMie=THREE.MathUtils.lerp(clearConditions ? .0015 : .0028,.0125,aerosol);
    const targetG=THREE.MathUtils.lerp(clearConditions ? .72 : .76,.9,Math.max(horizonWeight*.72,state.cloudCoverage*.38));
    skyUniforms.turbidity.value=THREE.MathUtils.damp(skyUniforms.turbidity.value,targetTurbidity,1.1,dt);
    skyUniforms.rayleigh.value=THREE.MathUtils.damp(skyUniforms.rayleigh.value,targetRayleigh,1.1,dt);
    skyUniforms.mieCoefficient.value=THREE.MathUtils.damp(skyUniforms.mieCoefficient.value,targetMie,1.1,dt);
    skyUniforms.mieDirectionalG.value=THREE.MathUtils.damp(skyUniforms.mieDirectionalG.value,targetG,1.1,dt);
    skyUniforms.sunPosition.value.copy(sunPosition);

    state.sunRadiance.copy(DAY_SUN).lerp(LOW_SUN,horizonWeight*.88).lerp(OVERCAST_SUN,state.cloudCoverage*.38).lerp(state.sun,.28);
    skyUniforms.sunTint.value.copy(state.sunRadiance);
    skyUniforms.clearSkyColor.value.copy(state.sky);
    skyUniforms.clearSkyAmount.value=THREE.MathUtils.damp(skyUniforms.clearSkyAmount.value,clearConditions ? 1 : 0,1.5,dt);
    skyUniforms.sunDiscIntensity.value=THREE.MathUtils.damp(skyUniforms.sunDiscIntensity.value,4200*(1-state.cloudCoverage*.55),1.1,dt);
    const skyRadianceScale=clearConditions ? .024+state.cloudCoverage*.0015+horizonWeight*.001 : .021+state.cloudCoverage*.003+horizonWeight*.001;
    skyUniforms.skyRadianceScale.value=THREE.MathUtils.damp(skyUniforms.skyRadianceScale.value,skyRadianceScale,1.1,dt);
    state.sunIntensity=daylight*(.2+.8*altitudeLight)*(1-state.cloudCoverage*.58);
    sunLight.position.copy(focusPosition).addScaledVector(sunDirection,55); sunLight.target.position.copy(focusPosition);
    sunLight.color.copy(state.sunRadiance);
    sunLight.intensity=daylight*(.25+altitudeLight*3.65)*(1-state.cloudCoverage*.52);
    sunVisual.group.position.copy(focusPosition).addScaledVector(sunDirection,SUN_DISTANCE);
    sunVisual.core.material.color.copy(state.sunRadiance); sunVisual.core.material.opacity=daylight*(1-state.cloudCoverage*.62);
    sunVisual.halo.material.color.copy(state.sunRadiance).lerp(LOW_SUN,horizonWeight*.42);
    sunVisual.halo.material.opacity=daylight*(.18+horizonWeight*.25)*(1-state.cloudCoverage*.55);

    hemisphere.color.copy(state.sky).lerp(state.horizon,horizonWeight*.12);
    hemisphere.groundColor.copy(state.deep);hemisphere.intensity=.48+daylight*altitudeLight*1.52;
    scene.fog.color.copy(state.horizon).lerp(state.sunRadiance,horizonWeight*.08);
    scene.fog.density=state.fogDensity;renderer.toneMappingExposure=THREE.MathUtils.damp(renderer.toneMappingExposure,state.exposure,.8,dt);
    litCloudColour.copy(state.horizon).lerp(WHITE,.42+daylight*.38).lerp(state.sunRadiance,horizonWeight*.16);
    mediumCloudMaterial.color.copy(litCloudColour); mediumCloudMaterial.opacity=state.cloudCoverage*.48;
    highCloudMaterial.color.copy(litCloudColour); highCloudMaterial.opacity=state.cloudCoverage*.26;

    mediumClouds.children.forEach((cloud,index)=>{
      cloud.position.x+=state.windDirection.x*state.windSpeed*dt*.18;cloud.position.z+=state.windDirection.z*state.windSpeed*dt*.18;
      cloud.rotation.z=Math.sin(elapsed*.07+cloud.userData.phase+index)*.025;
      if(cloud.position.x>300)cloud.position.x=-300;if(cloud.position.x<-300)cloud.position.x=300;
      if(cloud.position.z>80)cloud.position.z=-480;if(cloud.position.z<-500)cloud.position.z=60;
    });
    highClouds.position.x+=state.windDirection.x*state.windSpeed*dt*.04;
    if(highClouds.position.x>180)highClouds.position.x=-180;if(highClouds.position.x<-180)highClouds.position.x=180;
    rain.position.copy(focusPosition);rain.material.opacity=state.rainIntensity*.8;const positions=rain.geometry.attributes.position;
    for(let i=0;i<900;i++){positions.array[i*3+1]-=dt*(28+state.windSpeed);positions.array[i*3]+=state.windDirection.x*dt*state.windSpeed;if(positions.array[i*3+1]<0)positions.array[i*3+1]=45}positions.needsUpdate=true;

    diagnostics.turbidity=Number(skyUniforms.turbidity.value.toFixed(3));diagnostics.rayleigh=Number(skyUniforms.rayleigh.value.toFixed(3));
    diagnostics.mieCoefficient=Number(skyUniforms.mieCoefficient.value.toFixed(5));diagnostics.mieDirectionalG=Number(skyUniforms.mieDirectionalG.value.toFixed(3));
    diagnostics.sunVisibility=Number(state.sunIntensity.toFixed(3));diagnostics.sunElevation=Number(elevation.toFixed(2));diagnostics.preset=state.preset;
    return state;
  }

  return {
    state,target,sky,sunLight,sunDisc:sunVisual.core,sunHalo:sunVisual.halo,diagnostics,
    setPreset,setTime,setQuality,update,
    dispose(){
      cloudTexture.dispose();sunVisual.coreTexture.dispose();sunVisual.haloTexture.dispose();puffGeometry.dispose();
      highCloudMaterial.dispose();mediumCloudMaterial.dispose();sunVisual.core.material.dispose();sunVisual.halo.material.dispose();rainGeometry.dispose();rainMaterial.dispose();
    }
  };
}
