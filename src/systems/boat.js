import * as THREE from 'three';
import { BOAT } from '../config.js';

const HULL_STATIONS=[
  {z:-2.175,width:.045,top:.68,depth:.58,rake:.30},{z:-1.78,width:.43,top:.62,depth:.68,rake:.08},
  {z:-.92,width:.72,top:.56,depth:.78,rake:.02},{z:0,width:.79,top:.53,depth:.82,rake:0},
  {z:.92,width:.70,top:.56,depth:.76,rake:-.02},{z:1.72,width:.48,top:.63,depth:.68,rake:-.06},
  {z:2.175,width:.22,top:.69,depth:.60,rake:-.22}
];
const BUOYANCY_POINTS=[[-.52,-.28,-1.55],[.52,-.28,-1.55],[-.68,-.42,-.55],[.68,-.42,-.55],[-.68,-.42,.55],[.68,-.42,.55],[-.42,-.30,1.55],[.42,-.30,1.55]].map(p=>new THREE.Vector3(...p));
const temp={q:new THREE.Quaternion(),qi:new THREE.Quaternion(),position:new THREE.Vector3(),velocity:new THREE.Vector3(),angular:new THREE.Vector3(),point:new THREE.Vector3(),r:new THREE.Vector3(),pointVelocity:new THREE.Vector3(),force:new THREE.Vector3(),forward:new THREE.Vector3(),right:new THREE.Vector3(),up:new THREE.Vector3(),worldUp:new THREE.Vector3(0,1,0),righting:new THREE.Vector3(),rollPitchRate:new THREE.Vector3(),wind:new THREE.Vector3(),apparent:new THREE.Vector3(),apparentUnit:new THREE.Vector3(),sample:{height:0,normal:new THREE.Vector3(),velocity:new THREE.Vector3()}};

function makeTexture(kind,renderer){
  const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
  const dataMap=kind.endsWith('-height')||kind.endsWith('-roughness');
  if(kind==='wood'){
    x.fillStyle='#8b5435';x.fillRect(0,0,512,512);
    for(let i=0;i<92;i++){const y=i*5.6;x.strokeStyle=`rgba(${42+i%30},24,12,${.07+i%4*.02})`;x.lineWidth=1+(i%5===0);x.beginPath();x.moveTo(0,y);for(let u=0;u<=512;u+=20)x.lineTo(u,y+Math.sin(u*.026+i*.8)*3);x.stroke()}
  }else if(kind==='wood-height'){
    x.fillStyle='#7f7f7f';x.fillRect(0,0,512,512);
    for(let i=0;i<96;i++){const y=i*5.35;x.strokeStyle=i%9?'#898989':'#616161';x.lineWidth=i%9?1:2;x.beginPath();x.moveTo(0,y);for(let u=0;u<=512;u+=16)x.lineTo(u,y+Math.sin(u*.031+i*.63)*2.4);x.stroke()}
  }else if(kind==='wood-roughness'){
    x.fillStyle='#a6a6a6';x.fillRect(0,0,512,512);
    for(let i=0;i<72;i++){x.strokeStyle=i%7?'#9b9b9b':'#c0c0c0';x.beginPath();x.moveTo(0,i*7.1);x.lineTo(512,i*7.1+Math.sin(i)*4);x.stroke()}
  }else if(kind==='deck'){
    x.fillStyle='#c39a69';x.fillRect(0,0,512,512);for(let i=0;i<20;i++){x.fillStyle=i%2?'#50321f2c':'#f7dba126';x.fillRect(i*27,0,3,512)}for(let y=0;y<512;y+=86){x.fillStyle='#41271930';x.fillRect(0,y,512,2)}
  }else if(kind==='deck-height'){
    x.fillStyle='#828282';x.fillRect(0,0,512,512);for(let i=0;i<20;i++){x.fillStyle=i%2?'#686868':'#969696';x.fillRect(i*27,0,2,512)}for(let y=0;y<512;y+=86){x.fillStyle='#5b5b5b';x.fillRect(0,y,512,2)}
  }else if(kind==='deck-roughness'){
    x.fillStyle='#ababab';x.fillRect(0,0,512,512);for(let i=0;i<20;i++){x.fillStyle=i%2?'#9c9c9c':'#b9b9b9';x.fillRect(i*27,0,4,512)}
  }else if(kind==='sail'){
    const g=x.createLinearGradient(0,0,512,512);g.addColorStop(0,'#fffaf0');g.addColorStop(.62,'#e8ddc9');g.addColorStop(1,'#b5a58c');x.fillStyle=g;x.fillRect(0,0,512,512);
    for(let y=35;y<512;y+=52){x.strokeStyle='#78664f52';x.lineWidth=2;x.beginPath();x.moveTo(0,y);x.lineTo(512,y+8);x.stroke()}for(let i=0;i<1400;i++){const px=(i*73)%512,py=(i*191)%512,v=214+(i%29);x.fillStyle=`rgba(${v},${v-5},${v-14},.08)`;x.fillRect(px,py,1,1)}
  }else if(kind==='sail-height'){
    x.fillStyle='#858585';x.fillRect(0,0,512,512);for(let y=35;y<512;y+=52){x.strokeStyle='#b8b8b8';x.lineWidth=3;x.beginPath();x.moveTo(0,y);x.lineTo(512,y+8);x.stroke()}for(let x0=0;x0<512;x0+=9){x.fillStyle=x0%18?'#818181':'#898989';x.fillRect(x0,0,1,512)}
  }else if(kind==='sail-roughness'){
    x.fillStyle='#c5c5c5';x.fillRect(0,0,512,512);for(let i=0;i<512;i+=7){x.fillStyle=i%14?'#bdbdbd':'#d2d2d2';x.fillRect(i,0,1,512)}
  }
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=dataMap?THREE.NoColorSpace:THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return texture;
}
function createHullGeometry(detail=12){
  const crossSegments=Math.max(10,detail),vertices=[],indices=[];
  for(const station of HULL_STATIONS){
    for(let j=0;j<=crossSegments;j++){
      const u=j/crossSegments,arc=Math.sin(Math.PI*u);
      const x=-Math.cos(Math.PI*u)*station.width;
      const y=station.top-station.depth*Math.pow(arc,.72);
      const z=station.z+station.rake*Math.pow(arc,.9);
      vertices.push(x,y,z);
    }
  }
  const stride=crossSegments+1;
  for(let station=0;station<HULL_STATIONS.length-1;station++){
    for(let j=0;j<crossSegments;j++){
      const a=station*stride+j,b=a+stride;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
  }
  for(const stationIndex of [0,HULL_STATIONS.length-1]){
    const station=HULL_STATIONS[stationIndex],center=vertices.length/3;
    vertices.push(0,station.top-station.depth*.42,station.z+station.rake*.55);
    const offset=stationIndex*stride;
    for(let j=0;j<crossSegments;j++){
      if(stationIndex===0)indices.push(center,offset+j+1,offset+j);
      else indices.push(center,offset+j,offset+j+1);
    }
    if(stationIndex===0)indices.push(center,offset,offset+crossSegments);
    else indices.push(center,offset+crossSegments,offset);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

function createClothSail(width,height,renderer){
  const columns=16,rows=24,positions=[],uvs=[],indices=[];
  for(let y=0;y<=rows;y++){const v=y/rows,currentWidth=width*(1-v*.94);for(let x=0;x<=columns;x++){const u=x/columns;positions.push(currentWidth*u,v*height,0);uvs.push(u,v)}}
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=y*(columns+1)+x,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.userData.base=Float32Array.from(positions);geometry.userData.columns=columns;geometry.userData.rows=rows;
  const texture=makeTexture('sail',renderer),relief=makeTexture('sail-height',renderer),roughness=makeTexture('sail-roughness',renderer);const material=new THREE.MeshPhysicalMaterial({map:texture,bumpMap:relief,roughnessMap:roughness,bumpScale:.018,color:'#fff6df',side:THREE.DoubleSide,roughness:.72,clearcoat:.05,transmission:.035,thickness:.03,transparent:true,opacity:.985});
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;return mesh;
}

function tube(points,radius,material){return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,radius,7,false),material)}
function createProfileExtrude(points,thickness,bevel=.012){
  const shape=new THREE.Shape();shape.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)shape.lineTo(points[i][0],points[i][1]);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,steps:1,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2});
  geometry.translate(0,0,-thickness*.5);geometry.rotateY(-Math.PI/2);geometry.computeVertexNormals();return geometry;
}

function createKeelGeometry(){return createProfileExtrude([[-.66,.02],[-.52,-.13],[.38,-.16],[.62,.02]],.1,.012)}
function createRudderGeometry(){return createProfileExtrude([[-.10,.16],[.16,.10],[.20,-.25],[-.05,-.30],[-.13,-.05]],.075,.01)}
function createDeckGeometry(){
  const shape=new THREE.Shape();shape.moveTo(0,2.03);shape.bezierCurveTo(-.32,1.92,-.64,1.15,-.72,.15);shape.bezierCurveTo(-.72,-.75,-.54,-1.55,0,-1.98);shape.bezierCurveTo(.54,-1.55,.72,-.75,.72,.15);shape.bezierCurveTo(.64,1.15,.32,1.92,0,2.03);
  const geometry=new THREE.ShapeGeometry(shape,36);geometry.rotateX(-Math.PI/2);geometry.computeVertexNormals();return geometry;
}

function createHullBandGeometry(side){
  const vertices=[],indices=[];
  HULL_STATIONS.forEach(station=>{const x=side*station.width*1.018,z=station.z+station.rake*.1,top=station.top-.12;vertices.push(x,top,z,x,top-.2,z)});
  for(let i=0;i<HULL_STATIONS.length-1;i++){const a=i*2,b=a+2;if(side<0)indices.push(a,a+1,b,a+1,b+1,b);else indices.push(a,b,a+1,a+1,b,b+1)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function createPorthole(glass,metal){
  const group=new THREE.Group();group.name='Porthole';
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.105,.018,10,28),metal);rim.rotation.y=Math.PI/2;group.add(rim);
  const pane=new THREE.Mesh(new THREE.CircleGeometry(.088,28),glass);pane.rotation.y=Math.PI/2;pane.position.x=-.006;group.add(pane);return group;
}

function createLifeRing(){
  const group=new THREE.Group();group.name='LifeRing';group.rotation.y=Math.PI/2;
  const canvasMat=new THREE.MeshStandardMaterial({color:'#efe3cf',roughness:.82});
  const redMat=new THREE.MeshStandardMaterial({color:'#b5432d',roughness:.68});
  const ropeMat=new THREE.MeshStandardMaterial({color:'#b69b70',roughness:.94});
  group.add(new THREE.Mesh(new THREE.TorusGeometry(.16,.045,10,40),canvasMat));
  for(let i=0;i<4;i++){const band=new THREE.Mesh(new THREE.TorusGeometry(.16,.049,10,10,Math.PI*.28),redMat);band.rotation.z=i*Math.PI/2+.18;group.add(band)}
  group.add(new THREE.Mesh(new THREE.TorusGeometry(.218,.009,6,40),ropeMat));return group;
}

function createLantern(glass,metal){
  const group=new THREE.Group();group.name='SternLantern';
  const glow=new THREE.Mesh(new THREE.CylinderGeometry(.062,.068,.17,12),glass);group.add(glow);
  for(const y of [-.105,.105]){const cap=new THREE.Mesh(new THREE.CylinderGeometry(y>0?.08:.075,.075,.035,12),metal);cap.position.y=y;group.add(cap)}
  for(let i=0;i<4;i++){const guard=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,.19,6),metal);guard.position.set(Math.cos(i*Math.PI/2)*.072,0,Math.sin(i*Math.PI/2)*.072);group.add(guard)}
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.068,.008,6,16,Math.PI),metal);handle.position.y=.145;group.add(handle);return group;
}

function createRopeCoil(material){
  const group=new THREE.Group();group.name='RopeCoil';
  for(let i=0;i<4;i++){const loop=new THREE.Mesh(new THREE.TorusGeometry(.12-i*.018,.01,6,28),material);loop.rotation.x=Math.PI/2;loop.position.y=i*.006;group.add(loop)}return group;
}

function createDetailedVisual(renderer){
  const root=new THREE.Group();root.name='VisualHull';
  const wood=makeTexture('wood',renderer),woodHeight=makeTexture('wood-height',renderer),woodRoughness=makeTexture('wood-roughness',renderer),deckTexture=makeTexture('deck',renderer),deckHeight=makeTexture('deck-height',renderer),deckRoughness=makeTexture('deck-roughness',renderer);
  const hullMaterial=new THREE.MeshPhysicalMaterial({map:wood,bumpMap:woodHeight,roughnessMap:woodRoughness,bumpScale:.026,color:'#ffffff',roughness:.62,metalness:0,clearcoat:.13,clearcoatRoughness:.48});
  const lowerMaterial=new THREE.MeshPhysicalMaterial({bumpMap:woodHeight,roughnessMap:woodRoughness,bumpScale:.012,color:'#24516d',roughness:.48,metalness:0,clearcoat:.18,clearcoatRoughness:.38});
  const outer=new THREE.Mesh(createHullGeometry(10),hullMaterial);outer.name='OuterHull';outer.castShadow=outer.receiveShadow=true;root.add(outer);
  const lower=new THREE.Mesh(createHullGeometry(8),lowerMaterial);lower.name='LowerHull';lower.scale.set(1.012,.62,1.012);lower.position.y=-.22;root.add(lower);
  const stripeMaterial=new THREE.MeshPhysicalMaterial({color:'#eee5d4',roughness:.58,clearcoat:.12,side:THREE.DoubleSide});
  [-1,1].forEach(side=>{const stripe=new THREE.Mesh(createHullBandGeometry(side),stripeMaterial);stripe.name=side<0?'HullStripePort':'HullStripeStarboard';stripe.castShadow=true;root.add(stripe)});
  const keel=new THREE.Mesh(createKeelGeometry(),new THREE.MeshPhysicalMaterial({bumpMap:woodHeight,color:'#3f2d24',roughness:.58,clearcoat:.12}));keel.name='Keel';keel.position.set(0,-.17,.02);root.add(keel);
  const inner=new THREE.Mesh(createHullGeometry(6),new THREE.MeshStandardMaterial({map:wood,color:'#39261e',roughness:.78,side:THREE.BackSide}));inner.name='InnerHull';inner.scale.set(.87,.8,.9);inner.position.y=.13;root.add(inner);

  const deck=new THREE.Group();deck.name='Deck';root.add(deck);
  const deckSurface=new THREE.Mesh(createDeckGeometry(),new THREE.MeshPhysicalMaterial({map:deckTexture,bumpMap:deckHeight,roughnessMap:deckRoughness,bumpScale:.012,color:'#ffffff',roughness:.67,clearcoat:.08,side:THREE.DoubleSide}));deckSurface.name='DeckSurface';deckSurface.position.y=.525;deckSurface.receiveShadow=true;deck.add(deckSurface);
  const cockpit=new THREE.Mesh(new THREE.BoxGeometry(.84,.035,.74),new THREE.MeshPhysicalMaterial({map:wood,bumpMap:woodHeight,color:'#3e2a20',roughness:.78}));cockpit.name='CockpitWell';cockpit.position.set(0,.54,1.08);deck.add(cockpit);
  const gunwaleMat=new THREE.MeshPhysicalMaterial({map:wood,bumpMap:woodHeight,color:'#ffffff',roughness:.55,clearcoat:.14});
  [-1,1].forEach(side=>{root.add(tube([new THREE.Vector3(side*.12,.48,-2.08),new THREE.Vector3(side*.74,.55,-.8),new THREE.Vector3(side*.78,.56,.1),new THREE.Vector3(side*.36,.5,1.95)],.045,gunwaleMat))});
  const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.02,.42,.82),new THREE.MeshPhysicalMaterial({map:wood,bumpMap:woodHeight,color:'#ffffff',roughness:.56,clearcoat:.1}));cabin.name='Cabin';cabin.position.set(0,.72,.35);cabin.castShadow=true;deck.add(cabin);
  const hatch=new THREE.Mesh(new THREE.BoxGeometry(.78,.08,.62),new THREE.MeshPhysicalMaterial({map:deckTexture,bumpMap:deckHeight,color:'#ffffff',roughness:.62}));hatch.name='Hatch';hatch.position.set(0,.97,-.05);deck.add(hatch);
  const glass=new THREE.MeshPhysicalMaterial({color:'#0d3347',roughness:.08,metalness:.15,transmission:.25,thickness:.03,side:THREE.DoubleSide});
  const brass=new THREE.MeshStandardMaterial({color:'#a9783d',metalness:.76,roughness:.3});
  [-1,1].forEach(side=>[-.2,.2].forEach((z,index)=>{const porthole=createPorthole(glass,brass);porthole.name='Porthole-'+(side<0?'Port':'Starboard')+'-'+(index?'Aft':'Fore');porthole.position.set(side*.515,.04,z);cabin.add(porthole)}));

  const mastSystem=new THREE.Group();mastSystem.name='MastSystem';root.add(mastSystem);
  const mastMat=new THREE.MeshPhysicalMaterial({map:wood,bumpMap:woodHeight,color:'#ffffff',roughness:.44,clearcoat:.18});
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.042,.067,3.08,14),mastMat);mast.name='MainMast';mast.position.set(0,2.02,-.22);mast.castShadow=true;mastSystem.add(mast);
  const boom=new THREE.Mesh(new THREE.CylinderGeometry(.026,.042,1.75,12),mastMat);boom.name='Boom';boom.rotation.x=Math.PI/2;boom.position.set(0,.92,.65);mastSystem.add(boom);
  const sail=createClothSail(1.65,2.38,renderer);sail.name='MainSail';sail.rotation.y=-Math.PI/2;sail.position.set(.018,.94,-.18);mastSystem.add(sail);
  const jib=createClothSail(1.75,2.42,renderer);jib.name='JibSail';jib.scale.x=-1;jib.rotation.y=-Math.PI/2;jib.position.set(-.018,.92,-.24);mastSystem.add(jib);
  const ropeMat=new THREE.MeshStandardMaterial({color:'#aa916c',roughness:.92});
  const ropes=new THREE.Group();ropes.name='Ropes';mastSystem.add(ropes);
  [[new THREE.Vector3(0,3.56,-.22),new THREE.Vector3(0,2.1,-1.2),new THREE.Vector3(0,.58,-2.04)],[new THREE.Vector3(0,3.56,-.22),new THREE.Vector3(0,2.05,.95),new THREE.Vector3(0,.58,2.0)],[new THREE.Vector3(0,3.42,-.22),new THREE.Vector3(-.4,1.9,-.05),new THREE.Vector3(-.68,.55,.25)],[new THREE.Vector3(0,3.42,-.22),new THREE.Vector3(.4,1.9,-.05),new THREE.Vector3(.68,.55,.25)]].forEach(points=>ropes.add(tube(points,.012,ropeMat)));

  const steering=new THREE.Group();steering.name='Steering';root.add(steering);
  const rudder=new THREE.Mesh(createRudderGeometry(),new THREE.MeshPhysicalMaterial({map:wood,color:'#67432c',roughness:.6}));rudder.name='Rudder';rudder.position.set(0,.04,1.91);steering.add(rudder);
  const metal=new THREE.MeshStandardMaterial({color:'#b48438',metalness:.88,roughness:.3});
  const wheel=new THREE.Group();wheel.name='Wheel';const rim=new THREE.Mesh(new THREE.TorusGeometry(.31,.026,8,28),gunwaleMat);rim.rotation.y=Math.PI/2;wheel.add(rim);for(let i=0;i<8;i++){const spoke=new THREE.Mesh(new THREE.CylinderGeometry(.009,.014,.62,6),gunwaleMat);spoke.rotation.z=Math.PI/2;spoke.rotation.x=i*Math.PI/4;wheel.add(spoke)}wheel.position.set(.48,.88,.8);steering.add(wheel);

  const accessories=new THREE.Group();accessories.name='Accessories';root.add(accessories);
  for(let i=0;i<4;i++){const cleat=new THREE.Mesh(new THREE.CapsuleGeometry(.025,.15,3,6),metal);cleat.rotation.z=Math.PI/2;cleat.position.set(i<2?-.62:.62,.62,i%2?-1.15:.72);cleat.name='Cleat';accessories.add(cleat)}
  const iron=new THREE.MeshStandardMaterial({color:'#31363a',metalness:.9,roughness:.42});
  const anchor=new THREE.Group();anchor.name='Anchor';const shank=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,.48,8),iron);shank.rotation.z=Math.PI/2;anchor.add(shank);anchor.position.set(-.67,.38,-1.3);accessories.add(anchor);
  const lanternGlass=new THREE.MeshPhysicalMaterial({color:'#ffd27a',emissive:'#ff9d32',emissiveIntensity:2,transmission:.5,roughness:.08});
  const lantern=createLantern(lanternGlass,iron);lantern.position.set(0,1.02,1.62);accessories.add(lantern);
  const lifeRing=createLifeRing();lifeRing.position.set(-.79,.58,.78);accessories.add(lifeRing);
  [-.72,.72].forEach((x,sideIndex)=>[-.72,.18,1.08].forEach((z,index)=>{const fender=new THREE.Mesh(new THREE.CapsuleGeometry(.055,.24,5,10),new THREE.MeshStandardMaterial({color:'#e8deca',roughness:.84}));fender.name='Fender-'+(sideIndex?'Starboard':'Port')+'-'+(index+1);fender.position.set(x,.43,z);accessories.add(fender)}));
  [[-.34,.55,-.95],[.36,.55,.98]].forEach((p,index)=>{const coil=createRopeCoil(ropeMat);coil.name='RopeCoil-'+(index+1);coil.position.set(...p);accessories.add(coil)});
  const flag=createClothSail(.56,.27,renderer);flag.name='Flag';flag.rotation.y=-Math.PI/2;flag.position.set(0,3.34,-.2);accessories.add(flag);

  root.traverse(node=>{if(node.name)node.userData.sculptComponent={id:node.name,pickable:true,destructionGroup:node.parent?.name||'VisualHull'}});
  root.userData={hullMaterial,lowerMaterial,sail,jib,rudder,flag,wetness:0,sculptRuntime:{rootNode:'VisualHull',nodes:['OuterHull','Deck','Cabin','MastSystem','Steering','Accessories'],sockets:{mastBase:[0,.48,-.22],bowRig:[0,.58,-2.04],sternRig:[0,.58,2],rudderStock:[0,.55,1.83]},colliders:['hull-convex','keel-box','mast-capsule'],picking:{enabled:true},explode:{groups:['Hull','Rig','Deck','Accessories']}}};
  return root;
}

function createSimplifiedVisual(renderer,distant=false){
  const root=new THREE.Group(),wood=makeTexture('wood',renderer);
  const hull=new THREE.Mesh(createHullGeometry(distant?3:5),new THREE.MeshStandardMaterial({map:wood,color:'#76503a',roughness:.68}));hull.castShadow=!distant;root.add(hull);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.04,.06,3.05,distant?6:10),new THREE.MeshStandardMaterial({color:'#4b3222',roughness:.65}));mast.position.set(0,2,-.22);root.add(mast);
  const sail=createClothSail(2,2.55,renderer);sail.rotation.y=-Math.PI/2;sail.position.set(.02,.94,-.18);root.add(sail);const jib=createClothSail(1.3,2.25,renderer);jib.scale.x=-1;jib.rotation.y=-Math.PI/2;jib.position.set(-.02,.92,-.23);root.add(jib);
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
    // Rapier user forces persist until explicitly reset. Rebuild the force and
    // torque budget every fixed step so buoyancy, sail and rudder loads do not
    // accumulate into an uncontrolled spin after the rudder is released.
    body.resetForces(false);body.resetTorques(false);
    const p=body.translation(),r=body.rotation(),v=body.linvel(),av=body.angvel();
    temp.position.set(p.x,p.y,p.z);temp.q.set(r.x,r.y,r.z,r.w);temp.velocity.set(v.x,v.y,v.z);temp.angular.set(av.x,av.y,av.z);
    temp.forward.set(0,0,-1).applyQuaternion(temp.q);temp.right.set(1,0,0).applyQuaternion(temp.q);temp.up.set(0,1,0).applyQuaternion(temp.q);
    for(const pointLocal of BUOYANCY_POINTS){
      temp.point.copy(pointLocal);temp.point.y-=parameters.centreOfMass;temp.point.applyQuaternion(temp.q).add(temp.position);const sample=ocean.sampleOceanSurface(temp.point.x,temp.point.z,time,temp.sample);const depth=sample.height-temp.point.y;
      if(depth>0){temp.r.copy(temp.point).sub(temp.position);temp.pointVelocity.copy(temp.angular).cross(temp.r).add(temp.velocity);const relativeY=temp.pointVelocity.y-sample.velocity.y;const upward=THREE.MathUtils.clamp(depth*parameters.buoyancyStrength-relativeY*parameters.buoyancyDamping,0,720);body.addForceAtPoint({x:0,y:upward,z:0},{x:temp.point.x,y:temp.point.y,z:temp.point.z},true)}
    }
    forwardSpeed=temp.velocity.dot(temp.forward);const sideSpeed=temp.velocity.dot(temp.right);
    temp.force.copy(temp.forward).multiplyScalar(-forwardSpeed*Math.abs(forwardSpeed)*parameters.forwardDrag).addScaledVector(temp.right,-sideSpeed*Math.abs(sideSpeed)*parameters.sideDrag);temp.force.y+=-temp.velocity.y*parameters.verticalDrag*parameters.mass;
    body.addForce({x:temp.force.x,y:temp.force.y,z:temp.force.z},true);
    // Approximate the righting moment of ballast below the centre of buoyancy.
    // Only roll/pitch rates are damped, so steering yaw remains fully dynamic.
    temp.righting.crossVectors(temp.up,temp.worldUp).multiplyScalar(parameters.rightingStrength);
    temp.rollPitchRate.copy(temp.angular).addScaledVector(temp.up,-temp.angular.dot(temp.up));
    temp.righting.addScaledVector(temp.rollPitchRate,-parameters.rollPitchDamping);
    body.addTorque({x:temp.righting.x,y:temp.righting.y,z:temp.righting.z},true);
    if(anchored){body.addForce({x:-v.x*180,y:0,z:-v.z*180},true)}else{
      temp.wind.copy(environment.windDirection).multiplyScalar(environment.windSpeed);temp.apparent.copy(temp.wind).sub(temp.velocity);const apparentSpeed=temp.apparent.length();temp.apparentUnit.copy(temp.apparent).normalize();const angle=Math.acos(THREE.MathUtils.clamp(temp.apparentUnit.dot(temp.forward),-1,1));const sideWind=temp.apparentUnit.dot(temp.right);const efficiency=Math.max(.12,Math.abs(Math.sin(angle)))*sailTrim;
      const heelEfficiency=.15+.85*Math.pow(Math.max(0,temp.up.y),1.5);const sailForce=THREE.MathUtils.clamp(apparentSpeed*apparentSpeed*2.6*parameters.sailForce*efficiency*heelEfficiency,0,520);temp.force.copy(temp.forward).multiplyScalar(sailForce).addScaledVector(temp.right,-sideWind*sailForce*.28);const sailPoint=temp.point.set(0,2.45,-.1).applyQuaternion(temp.q).add(temp.position);body.addForceAtPoint({x:temp.force.x,y:temp.force.y,z:temp.force.z},{x:sailPoint.x,y:sailPoint.y,z:sailPoint.z},true);
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
  return {body,collider,parameters,buoyancyPoints:BUOYANCY_POINTS,update,setVelocity(z){
    body.resetForces(true);body.resetTorques(true);body.setAngvel({x:0,y:0,z:0},true);body.setLinvel({x:0,y:0,z},true);
  }};
}
