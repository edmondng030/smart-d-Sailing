import * as THREE from 'three';
import { createBoatVisual } from '/src/systems/boat.js';

const params=new URLSearchParams(location.search);
const view=params.get('view')||'side';
const mode=params.get('mode')||'clay';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1200,900,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#eef1f3');
const camera=new THREE.PerspectiveCamera(34,1200/900,.1,100);
const views={side:{p:[-8.1,1.35,0],t:[0,1.25,0],u:[0,1,0]},front:{p:[0,1.3,-8.1],t:[0,1.25,0],u:[0,1,0]},top:{p:[0,9,.25],t:[0,.5,0],u:[0,0,-1]},three:{p:[-6.2,3.35,-6.4],t:[0,1.25,0],u:[0,1,0]},stern:{p:[-5.8,2.8,6.5],t:[0,1.05,.25],u:[0,1,0]}};
const chosen=views[view]||views.side;camera.position.fromArray(chosen.p);camera.up.fromArray(chosen.u);camera.lookAt(...chosen.t);
scene.add(new THREE.HemisphereLight('#f8fbff','#655849',1.45));
const key=new THREE.DirectionalLight('#fff0d5',3.4);key.position.set(-4,8,-5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;scene.add(key);
const rim=new THREE.DirectionalLight('#cbe5ff',1.3);rim.position.set(5,4,6);scene.add(rim);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({color:'#24313a',opacity:.18}));ground.rotation.x=-Math.PI/2;ground.position.y=-.94;ground.receiveShadow=true;scene.add(ground);
const boat=createBoatVisual(renderer);boat.userData.lod.levels.slice(1).forEach(level=>level.object.visible=false);scene.add(boat);
if(mode==='clay'){const clay=new THREE.MeshStandardMaterial({color:'#b9ad99',roughness:.74,metalness:0,side:THREE.DoubleSide});boat.traverse(o=>{if(o.name==='LowerHull'||o.name==='InnerHull')o.visible=false;if(o.isMesh){o.material=clay;o.castShadow=true;o.receiveShadow=true}})}
if(mode==='silhouette'){scene.background=new THREE.Color('#ffffff');renderer.shadowMap.enabled=false;ground.visible=false;const ink=new THREE.MeshBasicMaterial({color:'#080808',side:THREE.DoubleSide});boat.traverse(o=>{if(o.name==='LowerHull'||o.name==='InnerHull')o.visible=false;if(o.isMesh){o.material=ink;o.castShadow=false;o.receiveShadow=false}})}
boat.updateMatrixWorld(true);renderer.render(scene,camera);window.__ready=true;document.documentElement.dataset.ready='true';