import * as THREE from 'three';

function seededRandom(seed){let value=seed%2147483647;if(value<=0)value+=2147483646;return()=>((value=value*16807%2147483647)-1)/2147483646}

function createTerrain(radius,seed){
  const random=seededRandom(seed),rings=22,segments=72,vertices=[],colours=[],indices=[];
  const wet=new THREE.Color('#8f8266'),sand=new THREE.Color('#c8ae78'),grass=new THREE.Color('#496b43'),rock=new THREE.Color('#657064');
  for(let ring=0;ring<=rings;ring++){const t=ring/rings,r=t*radius;for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;const irregular=1+Math.sin(a*3+seed)*.08+Math.sin(a*7-seed)*.035;const rr=r*irregular;const dome=Math.pow(Math.max(0,1-t),1.55)*radius*.22;const noise=(random()-.5)*Math.min(1,t*4)*1.2;const y=t<.12?-.55+t*4.4:dome+noise;vertices.push(Math.cos(a)*rr,y,Math.sin(a)*rr);const c=t<.12?wet:t<.28?sand:t>.88?rock:grass;colours.push(c.r*(.93+random()*.1),c.g*(.93+random()*.1),c.b*(.93+random()*.1))}}
  for(let ring=0;ring<rings;ring++)for(let i=0;i<segments;i++){const n=(i+1)%segments,a=ring*segments+i,b=ring*segments+n,c=(ring+1)*segments+i,d=(ring+1)*segments+n;indices.push(a,c,b,b,c,d)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function createIsland(radius,seed,lighthouse=false){
  const root=new THREE.Group();root.name=lighthouse?'LighthouseIsland':'Island';
  const shelf=new THREE.Mesh(new THREE.CylinderGeometry(radius*.92,radius*1.25,2.4,64),new THREE.MeshStandardMaterial({color:'#42696b',roughness:1}));shelf.position.y=-1.7;root.add(shelf);
  const terrain=new THREE.Mesh(createTerrain(radius,seed),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0}));terrain.receiveShadow=true;terrain.castShadow=true;root.add(terrain);
  const random=seededRandom(seed+71),rockCount=Math.floor(radius*.45),treeCount=Math.floor(radius*1.1);
  const rockGeometry=new THREE.DodecahedronGeometry(1.5,2),rockMaterial=new THREE.MeshStandardMaterial({color:'#5c675d',roughness:.92});
  const rocks=new THREE.InstancedMesh(rockGeometry,rockMaterial,rockCount);rocks.castShadow=true;const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3();
  for(let i=0;i<rockCount;i++){const a=random()*Math.PI*2,r=radius*(.42+random()*.5);position.set(Math.cos(a)*r,.3+random()*1.2,Math.sin(a)*r);q.setFromEuler(new THREE.Euler(random()*Math.PI,random()*Math.PI,random()*Math.PI));scale.set(.5+random()*1.4,.55+random()*2,.5+random()*1.4);matrix.compose(position,q,scale);rocks.setMatrixAt(i,matrix)}root.add(rocks);
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.1,.16,2.4,7),new THREE.MeshStandardMaterial({color:'#503927',roughness:1}),treeCount);
  const crowns=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.15,1),new THREE.MeshStandardMaterial({color:'#355b39',roughness:1}),treeCount);crowns.castShadow=true;
  const treeData=[];
  for(let i=0;i<treeCount;i++){const a=random()*Math.PI*2,r=radius*(.16+Math.sqrt(random())*.58),size=.7+random()*.75,y=Math.pow(Math.max(0,1-r/radius),1.55)*radius*.22;position.set(Math.cos(a)*r,y+1.2*size,Math.sin(a)*r);q.identity();scale.set(size,size,size);matrix.compose(position,q,scale);trunks.setMatrixAt(i,matrix);position.y+=1.8*size;scale.set(size*.8,size*1.15,size*.8);matrix.compose(position,q,scale);crowns.setMatrixAt(i,matrix);treeData.push({a,r,size,y,phase:random()*Math.PI*2})}root.add(trunks,crowns);root.userData={crowns,treeData,radius};

  if(lighthouse){const tower=new THREE.Group();tower.name='Lighthouse';const white=new THREE.MeshStandardMaterial({color:'#eee7db',roughness:.7}),red=new THREE.MeshStandardMaterial({color:'#a8473d',roughness:.62});const body=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.8,14,24),white);body.position.y=7;body.castShadow=true;tower.add(body);const band=new THREE.Mesh(new THREE.CylinderGeometry(1.52,1.52,2,24),red);band.position.y=8;tower.add(band);const balcony=new THREE.Mesh(new THREE.CylinderGeometry(1.75,1.75,.18,24),new THREE.MeshStandardMaterial({color:'#303a3d',metalness:.75,roughness:.36}));balcony.position.y=14.25;tower.add(balcony);const glass=new THREE.MeshPhysicalMaterial({color:'#fff0b0',emissive:'#ffc75f',emissiveIntensity:4,transmission:.55,roughness:.08});const housing=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,1.35,20),glass);housing.position.y=15;tower.add(housing);const roof=new THREE.Mesh(new THREE.ConeGeometry(1.25,1.25,20),red);roof.position.y=16.3;tower.add(roof);
    const beacon=new THREE.Group(),beamMaterial=new THREE.MeshBasicMaterial({color:'#ffe7a5',transparent:true,opacity:.13,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});const beam=new THREE.Mesh(new THREE.ConeGeometry(4.5,70,20,1,true),beamMaterial);beam.rotation.z=-Math.PI/2;beam.position.x=35;beacon.position.y=15;tower.add(beacon);beacon.add(beam);const light=new THREE.PointLight('#ffd477',22,80);light.position.y=15;tower.add(light);tower.userData.beacon=beacon;tower.position.y=radius*.17;root.add(tower);root.userData.lighthouse=tower}
  return root;
}

export function createWorldSystem(scene){
  const root=new THREE.Group();root.name='Archipelago';scene.add(root);
  const islands=[createIsland(42,13,false),createIsland(55,29,true),createIsland(78,47,false),createIsland(34,63,false)];
  [[-110,-210],[135,-275],[-280,-440],[270,-520]].forEach(([x,z],i)=>{islands[i].position.set(x,0,z);root.add(islands[i])});
  const birds=new THREE.Group();for(let i=0;i<12;i++){const shape=new THREE.Shape();shape.moveTo(-.5,0);shape.quadraticCurveTo(-.2,.28,0,0);shape.quadraticCurveTo(.2,.28,.5,0);const bird=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:'#213d49',side:THREE.DoubleSide}));bird.position.set((i-6)*4,12+i%3*1.5,-30-i*2);bird.scale.setScalar(.45+i%2*.2);birds.add(bird)}root.add(birds);

  const treeMatrix=new THREE.Matrix4(),treePosition=new THREE.Vector3(),treeRotation=new THREE.Quaternion(),treeScale=new THREE.Vector3(),treeEuler=new THREE.Euler();
  function update(dt,time,environment){
    islands.forEach(island=>{const data=island.userData;data.treeData.forEach((tree,index)=>{const lean=Math.sin(time*environment.windSpeed*.08+tree.phase)*.035*environment.windSpeed/6;treePosition.set(Math.cos(tree.a)*tree.r,tree.y+3*tree.size,Math.sin(tree.a)*tree.r);treeEuler.set(lean,0,lean*.4);treeRotation.setFromEuler(treeEuler);treeScale.set(tree.size*.8,tree.size*1.15,tree.size*.8);treeMatrix.compose(treePosition,treeRotation,treeScale);data.crowns.setMatrixAt(index,treeMatrix)});data.crowns.instanceMatrix.needsUpdate=true;if(data.lighthouse)data.lighthouse.userData.beacon.rotation.y=time*.32});
    birds.children.forEach((bird,index)=>{const angle=time*.11+index*.52;bird.position.x=Math.cos(angle)*35;bird.position.z=-50+Math.sin(angle)*25;bird.position.y=13+Math.sin(time*1.3+index)*1.8;bird.rotation.z=Math.sin(time*3+index)*.18});
  }
  return {root,islands,update};
}
