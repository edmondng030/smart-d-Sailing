import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { chooseInitialQuality, QUALITY_PRESETS } from './src/config.js';
import { createRenderer, createCamera } from './src/core/renderer.js';
import { createOceanSystem } from './src/systems/ocean.js';
import { createEnvironmentSystem } from './src/systems/environment.js';
import { createBoatVisual, createBoatPhysics } from './src/systems/boat.js';
import { createFollowCamera } from './src/systems/camera.js';
import { createWorldSystem } from './src/systems/world.js';
import { createWakeSystem } from './src/systems/effects.js';
import { createDebugPanel } from './src/systems/debug.js';
import { createAudioSystem } from './src/systems/audio.js';

await RAPIER.init({});

const $=(selector,parent=document)=>parent.querySelector(selector);
const $$=(selector,parent=document)=>[...parent.querySelectorAll(selector)];
const clamp=THREE.MathUtils.clamp;
const appState={mode:'menu',weather:'clear',hour:14.5,quality:chooseInitialQuality(),speed:0,heading:0,anchored:false,camera:0,sailTrim:.82,rudder:0,sail:'classic',hull:'#8f5539',motion:true,keys:new Set()};

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
const audio=createAudioSystem();
const debug=createDebugPanel(scene,boatRoot,boatPhysics,ocean,environment);
applyQuality(appState.quality,environment.sunLight);

const overlay=$('#overlay'),toast=$('#toast');
function openModal(id){$$('.modal').forEach(modal=>modal.classList.remove('open'));const modal=$('#'+id);if(!modal)return;overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');modal.classList.add('open');if(id==='customize')requestAnimationFrame(initPreview)}
function closeModal(){overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');$$('.modal').forEach(modal=>modal.classList.remove('open'))}
function showToast(message){toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),1800)}
function showScreen(id){$$('.screen').forEach(screen=>screen.classList.remove('active'));$('#'+id).classList.add('active');appState.mode=id}
function applyBoatStyle(root=boatRoot){const high=root.userData.high;if(!high)return;const sailColours={classic:['#fff6df','#eee3cc'],navy:['#173b53','#274f67'],regatta:['#e4ad52','#f3e7d1']}[appState.sail];high.userData.sail.material.color.set(sailColours[0]);high.userData.jib.material.color.set(sailColours[1]);high.userData.hullMaterial.color.set(appState.hull)}

$$('[data-open]').forEach(button=>button.addEventListener('click',()=>openModal(button.dataset.open)));
$$('[data-close]').forEach(button=>button.addEventListener('click',closeModal));
overlay.addEventListener('pointerdown',event=>{if(event.target===overlay)closeModal()});

const weatherNames=['clear','cloudy','sunset','fog','night'];
$$('.weather-card:not(.locked)').forEach((card,index)=>card.addEventListener('click',()=>{$$('.weather-card').forEach(item=>item.classList.remove('selected'));card.classList.add('selected');appState.weather=weatherNames[index];environment.setPreset(appState.weather);showToast(card.querySelector('span').textContent+'環境載入中')}));
$('#timeRange')?.addEventListener('input',event=>{const value=+event.target.value,hour=Math.floor(value),minutes=value%1?'30':'00';$('#timeLabel').textContent=`${String(hour).padStart(2,'0')}:${minutes}`;appState.hour=value;environment.setTime(value)});
$$('.segmented button').forEach((button,index)=>button.addEventListener('click',()=>{$$('.segmented button').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');environment.target.windSpeed=[3,6,10][index]}));
$$('.tabs button').forEach(button=>button.addEventListener('click',()=>{$$('.tabs button').forEach(item=>item.classList.remove('active'));button.classList.add('active');$$('.tab-content').forEach(panel=>panel.classList.add('hidden'));$('#'+button.dataset.tab)?.classList.remove('hidden')}));
$$('.sail-options button').forEach((button,index)=>button.addEventListener('click',()=>{$$('.sail-options button').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');appState.sail=['classic','navy','regatta'][index];applyBoatStyle();if(previewBoat)applyBoatStyle(previewBoat);showToast('帆布已裝備')}));
$$('.color-options button').forEach(button=>button.addEventListener('click',()=>{$$('.color-options button').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');appState.hull=getComputedStyle(button).getPropertyValue('--c').trim()||'#8f5539';applyBoatStyle();if(previewBoat)applyBoatStyle(previewBoat);showToast('船身塗裝已更新')}));

function setQuality(name){if(!QUALITY_PRESETS[name])return;appState.quality=name;applyQuality(name,environment.sunLight);ocean.setQuality(name);wake.setQuality(name);environment.setQuality(name);showToast(`畫面品質：${name.toUpperCase()}`)}
$('#qualitySelect')?.addEventListener('change',event=>setQuality(event.target.value));
$('#brightness')?.addEventListener('input',event=>{environment.target.exposure=+event.target.value/100});
$('#motionToggle')?.addEventListener('change',event=>{appState.motion=event.target.checked});

function handleAction(action,button){
  if(action==='start'){closeModal();showScreen('game');audio.start();audio.resume();boatPhysics.setVelocity(-2.6);showToast('航程開始 — 一路順風！')}
  if(action==='continue'){showScreen('game');audio.start();audio.resume();showToast('已載入上次航程')}
  if(action==='home'){showScreen('menu')}
  if(action==='anchor'){appState.anchored=!appState.anchored;button.querySelector('span').textContent=appState.anchored?'起錨':'下錨';showToast(appState.anchored?'船隻已下錨':'重新揚帆')}
  if(action==='camera'){appState.camera=followCamera.setMode(appState.camera+1);showToast(['跟隨視角','甲板視角','遠景視角'][appState.camera])}
}
$$('[data-action]').forEach(button=>button.addEventListener('click',()=>handleAction(button.dataset.action,button)));

addEventListener('keydown',event=>{appState.keys.add(event.key.toLowerCase());if(event.key==='Escape'){if(overlay.classList.contains('open'))closeModal();else if(appState.mode==='game')handleAction('home')}if(appState.mode==='game'&&event.key.toLowerCase()==='m')openModal('map')});
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
  requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),elapsed=clock.elapsedTime;
  const rudder=(appState.keys.has('a')?1:0)-(appState.keys.has('d')?1:0);if(appState.keys.has('w'))appState.sailTrim=clamp(appState.sailTrim+dt*.45,.2,1);if(appState.keys.has('s'))appState.sailTrim=clamp(appState.sailTrim-dt*.45,.2,1);
  const env=environment.update(dt,elapsed,boatRoot.position);ocean.setWaveIntensity(env.waveIntensity);ocean.update(dt,elapsed,env,boatRoot.position);
  const physics=boatPhysics.update(dt,elapsed,env,{rudder,sailTrim:appState.sailTrim,anchored:appState.anchored||appState.mode==='menu'});
  boatRoot.userData.lod.update(camera);worldSystem.update(dt,elapsed,env);wake.update(dt,elapsed,boatRoot,physics.speedKnots);audio.update(physics.speedKnots,env);debug.update();
  if(appState.mode==='game'){followCamera.update(dt,{position:boatRoot.position,quaternion:boatRoot.quaternion,angularHint:rudder},physics.speedKnots,env,appState.motion)}
  else{menuCameraPosition.set(10+Math.sin(elapsed*.08)*2.5,5.8,11).add(boatRoot.position);camera.position.lerp(menuCameraPosition,1-Math.exp(-dt*2));menuCameraTarget.copy(boatRoot.position).add(new THREE.Vector3(0,1.7,0));camera.lookAt(menuCameraTarget)}
  renderer.render(scene,camera);
  if(import.meta.env.DEV&&!diagnosticsPublished&&elapsed>1){
    const failedPrograms=renderer.info.programs.filter(program=>program.diagnostics&&program.diagnostics.runnable===false);
    document.documentElement.dataset.spectralOcean=JSON.stringify(ocean.spectral.diagnostics);
    document.documentElement.dataset.shaderFailures=String(failedPrograms.length);
    document.documentElement.dataset.webgl2=String(renderer.capabilities.isWebGL2);
    diagnosticsPublished=true;
  }
  if(previewRenderer&&$('#customize')?.classList.contains('open')){previewControls.update();previewRenderer.render(previewScene,previewCamera)}
  updateHud(physics);
}
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight,false);renderer.setPixelRatio(Math.min(devicePixelRatio,QUALITY_PRESETS[appState.quality].pixelRatio));camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(previewRenderer){const host=$('.boat-preview');previewRenderer.setSize(host.clientWidth,host.clientHeight,false);previewCamera.aspect=host.clientWidth/host.clientHeight;previewCamera.updateProjectionMatrix()}});
applyBoatStyle();if($('#qualitySelect'))$('#qualitySelect').value=appState.quality;environment.setPreset('clear');environment.setTime(14.5);document.body.classList.add('three-ready');animate();
