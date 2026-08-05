import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { chooseInitialQuality, QUALITY_PRESETS, BOAT } from './src/config.js';
import { createRenderer, createCamera } from './src/core/renderer.js';
import { createOceanSystem } from './src/systems/ocean.js';
import { createEnvironmentSystem } from './src/systems/environment.js';
import { createBoatVisual, createBoatPhysics } from './src/systems/boat.js';
import { createFollowCamera } from './src/systems/camera.js';
import { createWorldSystem } from './src/systems/world.js';
import { createWakeSystem } from './src/systems/effects.js';
import { createDebugPanel } from './src/systems/debug.js';
import { createAudioSystem } from './src/systems/audio.js';
import { createVisualValidation } from './src/systems/visual-validation.js';

await RAPIER.init({});

const $=(selector,parent=document)=>parent.querySelector(selector);
const $$=(selector,parent=document)=>[...parent.querySelectorAll(selector)];
const clamp=THREE.MathUtils.clamp;
const launchParams=new URLSearchParams(location.search);
const preferencesKey='sail-away-preferences-v2';
const savedPreferences=(()=>{try{return JSON.parse(localStorage.getItem(preferencesKey))||{}}catch{return {}}})();
const weatherNames=['clear','cloudy','sunset','fog','night'];
const savedHour=Number(savedPreferences.hour),savedWaveIntensity=Number(savedPreferences.waveIntensity);
const requestedQuality=launchParams.get('quality');
const initialQuality=QUALITY_PRESETS[requestedQuality]?requestedQuality:(QUALITY_PRESETS[savedPreferences.quality]?savedPreferences.quality:chooseInitialQuality());
const appState={mode:'menu',weather:weatherNames.includes(savedPreferences.weather)?savedPreferences.weather:'clear',hour:clamp(Number.isFinite(savedHour)?savedHour:14.5,0,23.5),waveIntensity:clamp(Number.isFinite(savedWaveIntensity)?savedWaveIntensity:1,.35,1.6),quality:initialQuality,speed:0,heading:0,anchored:false,camera:0,freeView:false,sailTrim:.82,rudder:0,touchRudder:0,touchTrim:0,sail:'classic',hull:'#8f5539',motion:savedPreferences.motion!==false,keys:new Set()};

const scene=new THREE.Scene();
const camera=createCamera();
const {renderer,applyQuality}=createRenderer($('#world'),appState.quality);
const environment=createEnvironmentSystem(scene,renderer);
const ocean=createOceanSystem(scene,renderer,appState.quality);
const worldSystem=createWorldSystem(scene);
const boatRoot=createBoatVisual(renderer);scene.add(boatRoot);
const physicsWorld=new RAPIER.World({x:0,y:-9.81,z:0});physicsWorld.timestep=1/60;
const boatPhysics=createBoatPhysics(RAPIER,physicsWorld,boatRoot,ocean);
const wake=createWakeSystem(scene,ocean,appState.quality);
const followCamera=createFollowCamera(camera);
const freeViewControls=new OrbitControls(camera,renderer.domElement);
freeViewControls.enabled=false;freeViewControls.enableDamping=true;freeViewControls.dampingFactor=.08;freeViewControls.enablePan=false;
freeViewControls.minDistance=BOAT.length*1.05;freeViewControls.maxDistance=BOAT.length*9;
freeViewControls.minPolarAngle=.09;freeViewControls.maxPolarAngle=Math.PI*.48;freeViewControls.enableKeys=false;
const freeViewAnchor=new THREE.Vector3(),freeViewPreviousAnchor=new THREE.Vector3(),freeViewDelta=new THREE.Vector3();
const audio=createAudioSystem();
const debug=createDebugPanel(scene,boatRoot,boatPhysics,ocean,environment);
const visualValidation=createVisualValidation({renderer,camera,ocean,followCamera});
applyQuality(appState.quality,environment.sunLight);

const overlay=$('#overlay'),toast=$('#toast');
function openModal(id){$$('.modal').forEach(modal=>modal.classList.remove('open'));const modal=$('#'+id);if(!modal)return;overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');modal.classList.add('open');if(id==='customize')requestAnimationFrame(initPreview);if(id==='settings')syncSettingsControls()}
function closeModal(){overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');$$('.modal').forEach(modal=>modal.classList.remove('open'))}
function showToast(message){toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),1800)}
function syncFreeViewControls(){$$('[data-action="free-view"]').forEach(button=>{button.classList.toggle('active',appState.freeView);button.setAttribute('aria-pressed',String(appState.freeView))})}
function updateFreeViewAnchor(){freeViewAnchor.copy(boatRoot.position);freeViewAnchor.y+=BOAT.length*.42}
function setFreeView(enabled){const next=Boolean(enabled);if(next===appState.freeView)return;updateFreeViewAnchor();if(next){freeViewControls.target.copy(camera.userData.target||freeViewAnchor);freeViewPreviousAnchor.copy(freeViewAnchor);freeViewControls.enabled=true;freeViewControls.update()}else{freeViewControls.enabled=false;if(appState.mode==='game')followCamera.resume()}appState.freeView=next;syncFreeViewControls();showToast(next?'自由視角：拖曳旋轉、滾輪縮放':'已返回跟隨視角')}
function updateFreeView(){updateFreeViewAnchor();freeViewDelta.subVectors(freeViewAnchor,freeViewPreviousAnchor);camera.position.add(freeViewDelta);freeViewControls.target.add(freeViewDelta);freeViewPreviousAnchor.copy(freeViewAnchor);freeViewControls.update()}
function showScreen(id){$$('.screen').forEach(screen=>screen.classList.remove('active'));$('#'+id).classList.add('active');appState.mode=id}
function applyBoatStyle(root=boatRoot){const high=root.userData.high;if(!high)return;const sailColours={classic:['#fff6df','#eee3cc'],navy:['#173b53','#274f67'],regatta:['#e4ad52','#f3e7d1']}[appState.sail];high.userData.sail.material.color.set(sailColours[0]);high.userData.jib.material.color.set(sailColours[1]);high.userData.hullMaterial.color.set(appState.hull)}

function formatTime(value){const totalMinutes=Math.round(value*60)%(24*60),hour=Math.floor(totalMinutes/60),minutes=totalMinutes%60;return String(hour).padStart(2,'0')+':'+String(minutes).padStart(2,'0')}
function describeWaves(value){if(value<.58)return '平靜';if(value<.9)return '和緩';if(value<1.2)return '適中';if(value<1.43)return '強浪';return '洶湧'}
function persistPreferences(){try{localStorage.setItem(preferencesKey,JSON.stringify({weather:appState.weather,hour:appState.hour,waveIntensity:appState.waveIntensity,quality:appState.quality,motion:appState.motion}))}catch{}}
function syncSettingsControls(){
  const timeText=formatTime(appState.hour),waveText=describeWaves(appState.waveIntensity)+' · '+Math.round(appState.waveIntensity*100)+'%';
  const settingsWeather=$('#settingsWeatherSelect');if(settingsWeather)settingsWeather.value=appState.weather;
  for(const selector of ['#timeRange','#settingsTimeRange']){const control=$(selector);if(control){control.value=appState.hour;control.setAttribute('aria-valuetext',timeText)}}
  if($('#timeLabel'))$('#timeLabel').textContent=timeText;if($('#settingsTimeValue'))$('#settingsTimeValue').textContent=timeText;
  const sun=$('.time-sun');if(sun)sun.style.left=(8+(appState.hour/23.5)*84)+'%';
  const waveControl=$('#waveIntensityRange');if(waveControl){waveControl.value=appState.waveIntensity;waveControl.setAttribute('aria-valuetext',waveText)}
  if($('#waveIntensityValue'))$('#waveIntensityValue').textContent=waveText;
  $$('.weather-card:not(.locked)').forEach((card,index)=>card.classList.toggle('selected',weatherNames[index]===appState.weather));
  if($('#qualitySelect'))$('#qualitySelect').value=appState.quality;if($('#motionToggle'))$('#motionToggle').checked=appState.motion;
}
function applyWeather(name,{announce=true}={}){if(!weatherNames.includes(name))return;appState.weather=name;environment.setPreset(name);environment.setTime(appState.hour);environment.target.waveIntensity=appState.waveIntensity;syncSettingsControls();persistPreferences();if(announce)showToast({clear:'晴朗',cloudy:'多雲',sunset:'黃昏',fog:'霧氣',night:'夜晚'}[name]+'環境載入中')}
function setSailingTime(value){appState.hour=clamp(Number(value),0,23.5);environment.setTime(appState.hour);syncSettingsControls();persistPreferences()}
function setWaveIntensity(value){appState.waveIntensity=clamp(Number(value),.35,1.6);environment.target.waveIntensity=appState.waveIntensity;syncSettingsControls();persistPreferences()}

$$('[data-open]').forEach(button=>button.addEventListener('click',()=>openModal(button.dataset.open)));
$$('[data-close]').forEach(button=>button.addEventListener('click',closeModal));
overlay.addEventListener('pointerdown',event=>{if(event.target===overlay)closeModal()});

$$('.weather-card:not(.locked)').forEach((card,index)=>card.addEventListener('click',()=>applyWeather(weatherNames[index])));
$('#timeRange')?.addEventListener('input',event=>setSailingTime(event.target.value));
$('#settingsWeatherSelect')?.addEventListener('change',event=>applyWeather(event.target.value));
$('#settingsTimeRange')?.addEventListener('input',event=>setSailingTime(event.target.value));
$('#waveIntensityRange')?.addEventListener('input',event=>setWaveIntensity(event.target.value));
$$('.segmented button').forEach((button,index)=>button.addEventListener('click',()=>{$$('.segmented button').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');environment.target.windSpeed=[3,6,10][index]}));
$$('.tabs button').forEach(button=>button.addEventListener('click',()=>{$$('.tabs button').forEach(item=>item.classList.remove('active'));button.classList.add('active');$$('.tab-content').forEach(panel=>panel.classList.add('hidden'));$('#'+button.dataset.tab)?.classList.remove('hidden')}));
$$('.sail-options button').forEach((button,index)=>button.addEventListener('click',()=>{$$('.sail-options button').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');appState.sail=['classic','navy','regatta'][index];applyBoatStyle();if(previewBoat)applyBoatStyle(previewBoat);showToast('帆布已裝備')}));
$$('.color-options button').forEach(button=>button.addEventListener('click',()=>{$$('.color-options button').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');appState.hull=getComputedStyle(button).getPropertyValue('--c').trim()||'#8f5539';applyBoatStyle();if(previewBoat)applyBoatStyle(previewBoat);showToast('船身塗裝已更新')}));

function setQuality(name){if(!QUALITY_PRESETS[name])return;appState.quality=name;applyQuality(name,environment.sunLight);ocean.setQuality(name);wake.setQuality(name);environment.setQuality(name);persistPreferences();showToast(`畫面品質：${name.toUpperCase()}`)}
$('#qualitySelect')?.addEventListener('change',event=>setQuality(event.target.value));
$('#brightness')?.addEventListener('input',event=>{environment.target.exposure=+event.target.value/100});
$('#motionToggle')?.addEventListener('change',event=>{appState.motion=event.target.checked;persistPreferences()});

function handleAction(action,button){
  if(action==='start'){closeModal();showScreen('game');audio.start();audio.resume();boatPhysics.setVelocity(-2.6);showToast('航程開始 — 一路順風！')}
  if(action==='continue'){showScreen('game');audio.start();audio.resume();showToast('已載入上次航程')}
  if(action==='home'){showScreen('menu')}
  if(action==='anchor'){appState.anchored=!appState.anchored;button.querySelector('span').textContent=appState.anchored?'起錨':'下錨';showToast(appState.anchored?'船隻已下錨':'重新揚帆')}
  if(action==='camera'){if(appState.freeView)setFreeView(false);appState.camera=followCamera.setMode(appState.camera+1);showToast(['跟隨視角','甲板視角','遠景視角','舷側視角'][appState.camera])}
  if(action==='free-view')setFreeView(!appState.freeView);
}
$$('[data-action]').forEach(button=>button.addEventListener('click',()=>handleAction(button.dataset.action,button)));

function bindTouchHold(selector,stateKey,dataKey){
  $$(selector).forEach(button=>{
    const value=Number(button.dataset[dataKey]);
    const setActive=active=>{appState[stateKey]=active?value:0;button.classList.toggle('pressed',active)};
    button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture?.(event.pointerId);setActive(true)});
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>button.addEventListener(type,()=>setActive(false)));
    button.addEventListener('contextmenu',event=>event.preventDefault());
  });
}
bindTouchHold('[data-steer]','touchRudder','steer');
bindTouchHold('[data-trim]','touchTrim','trim');
addEventListener('blur',()=>{appState.touchRudder=0;appState.touchTrim=0});

addEventListener('keydown',event=>{
  const key=event.key.toLowerCase();appState.keys.add(key);
  if(key==='v'&&!event.repeat&&!overlay.classList.contains('open')){event.preventDefault();setFreeView(!appState.freeView);return}
  if(event.key==='Escape'){if(overlay.classList.contains('open'))closeModal();else if(appState.mode==='game')handleAction('home')}
  if(appState.mode==='game'&&key==='m')openModal('map');
});
addEventListener('keyup',event=>appState.keys.delete(event.key.toLowerCase()));

let previewRenderer=null,previewScene=null,previewCamera=null,previewBoat=null,previewControls=null;
function initPreview(){
  const host=$('.boat-preview');if(!host)return;host.querySelectorAll('.preview-water,.preview-boat').forEach(element=>element.style.display='none');
  let canvas=$('#threePreview');if(!canvas){canvas=document.createElement('canvas');canvas.id='threePreview';host.prepend(canvas)}
  if(previewRenderer){previewRenderer.setSize(host.clientWidth,host.clientHeight,false);return}
  previewRenderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});previewRenderer.outputColorSpace=THREE.SRGBColorSpace;previewRenderer.toneMapping=THREE.ACESFilmicToneMapping;previewRenderer.toneMappingExposure=.95;previewRenderer.shadowMap.enabled=true;previewRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));previewRenderer.setSize(host.clientWidth,host.clientHeight,false);
  previewScene=new THREE.Scene();previewScene.background=new THREE.Color('#709eb0');previewScene.add(new THREE.HemisphereLight('#ffffff','#173849',2.1));const light=new THREE.DirectionalLight('#fff0cf',3);light.position.set(-5,9,6);light.castShadow=true;previewScene.add(light);
  previewCamera=new THREE.PerspectiveCamera(42,host.clientWidth/host.clientHeight,.1,100);previewCamera.position.set(7,4.3,8);
  const sea=new THREE.Mesh(new THREE.CircleGeometry(18,64),new THREE.MeshStandardMaterial({color:'#246d80',roughness:.32,metalness:.05}));sea.rotation.x=-Math.PI/2;sea.position.y=-.5;previewScene.add(sea);
  previewBoat=createBoatVisual(previewRenderer);previewBoat.userData.lod.levels.slice(1).forEach(level=>level.object.visible=false);applyBoatStyle(previewBoat);previewScene.add(previewBoat);
  previewControls=new OrbitControls(previewCamera,canvas);previewControls.enablePan=false;previewControls.minDistance=6;previewControls.maxDistance=14;previewControls.target.set(0,1.6,0);previewControls.enableDamping=true;
}

const clock=new THREE.Clock(),menuCameraTarget=new THREE.Vector3(),menuCameraPosition=new THREE.Vector3();
let diagnosticsPublished=false;
function updateHud(physics){
  const q=boatRoot.quaternion,forward=new THREE.Vector3(0,0,-1).applyQuaternion(q),heading=(THREE.MathUtils.radToDeg(Math.atan2(forward.x,-forward.z))+360)%360,dirs=['N','NE','E','SE','S','SW','W','NW'];
  $('#heading').textContent=dirs[Math.round(heading/45)%8];$('.compass span').textContent=String(Math.round(heading)).padStart(3,'0')+'°';$('#speed').textContent=physics.speedKnots.toFixed(1);
  $('.weather-pill').textContent=`${{clear:'☀ 晴朗',cloudy:'☁ 多雲',sunset:'◐ 黃昏',fog:'≋ 霧氣',night:'☾ 夜晚'}[appState.weather]} · 風力 ${Math.max(1,Math.round(environment.state.windSpeed/2))} 級`;
}

function animate(){
  requestAnimationFrame(animate);visualValidation.beginFrame();const dt=Math.min(clock.getDelta(),.05),elapsed=clock.elapsedTime,simulationTime=visualValidation.simulationTime(elapsed);
  const rudder=clamp((appState.keys.has('a')?1:0)-(appState.keys.has('d')?1:0)+appState.touchRudder,-1,1);const trimInput=(appState.keys.has('w')?1:0)-(appState.keys.has('s')?1:0)+appState.touchTrim;if(trimInput)appState.sailTrim=clamp(appState.sailTrim+Math.sign(trimInput)*dt*.45,.2,1);
  const env=environment.update(dt,simulationTime,boatRoot.position);ocean.setWaveIntensity(env.waveIntensity);ocean.update(dt,simulationTime,env,boatRoot.position);
  const physics=boatPhysics.update(dt,simulationTime,env,{rudder,sailTrim:appState.sailTrim,anchored:appState.anchored||appState.mode==='menu'});
  boatRoot.userData.lod.update(camera);worldSystem.update(dt,simulationTime,env);wake.update(dt,simulationTime,boatRoot,physics.speedKnots);audio.update(physics.speedKnots,env);debug.update(simulationTime);
  if(appState.freeView){updateFreeView()}
  else if(appState.mode==='game'){followCamera.update(dt,{position:boatRoot.position,quaternion:boatRoot.quaternion,angularHint:rudder},physics.speedKnots,env,appState.motion)}
  else{const portraitFrame=clamp((.82-camera.aspect)/.42,0,1);menuCameraPosition.set(BOAT.length*(2.3+portraitFrame*.72+Math.sin(elapsed*.08)*.57),BOAT.length*(1.33+portraitFrame*.28),BOAT.length*(2.53+portraitFrame*.78)).add(boatRoot.position);camera.position.lerp(menuCameraPosition,1-Math.exp(-dt*2));menuCameraTarget.copy(boatRoot.position);menuCameraTarget.y+=BOAT.length*(.39+portraitFrame*.05);camera.lookAt(menuCameraTarget)}
  renderer.render(scene,camera);
  visualValidation.endFrame();visualValidation.publish(elapsed);
  if(import.meta.env.DEV&&!diagnosticsPublished&&elapsed>1){
    const failedPrograms=renderer.info.programs.filter(program=>program.diagnostics&&program.diagnostics.runnable===false);
    document.documentElement.dataset.spectralOcean=JSON.stringify(ocean.diagnostics);
    document.documentElement.dataset.shaderFailures=String(failedPrograms.length);
    document.documentElement.dataset.webgl2=String(renderer.capabilities.isWebGL2);
    diagnosticsPublished=true;
  }
  if(previewRenderer&&$('#customize')?.classList.contains('open')){previewControls.update();previewRenderer.render(previewScene,previewCamera)}
  updateHud(physics);
}
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight,false);renderer.setPixelRatio(Math.min(devicePixelRatio,QUALITY_PRESETS[appState.quality].pixelRatio));camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(previewRenderer){const host=$('.boat-preview');previewRenderer.setSize(host.clientWidth,host.clientHeight,false);previewCamera.aspect=host.clientWidth/host.clientHeight;previewCamera.updateProjectionMatrix()}});
applyBoatStyle();syncFreeViewControls();applyWeather(appState.weather,{announce:false});setSailingTime(appState.hour);setWaveIntensity(appState.waveIntensity);if(visualValidation.enabled){showScreen('game');appState.anchored=true;boatPhysics.setVelocity(0)}document.body.classList.add('three-ready');animate();
