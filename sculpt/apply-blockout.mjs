import fs from 'node:fs';
const file=new URL('../src/systems/boat.js',import.meta.url);
let text=fs.readFileSync(file,'utf8');
const oldStations=`const HULL_STATIONS=[
  {z:-2.15,width:.08,height:.50},{z:-1.70,width:.46,height:.78},{z:-.90,width:.73,height:.96},
  {z:0,width:.79,height:1.02},{z:.95,width:.68,height:.92},{z:1.75,width:.40,height:.75},{z:2.20,width:.10,height:.56}
];`;
const newStations=`const HULL_STATIONS=[
  {z:-2.175,width:.045,top:.68,depth:.66},{z:-1.78,width:.43,top:.62,depth:.84},
  {z:-.92,width:.72,top:.56,depth:.98},{z:0,width:.79,top:.53,depth:1.04},
  {z:.92,width:.70,top:.56,depth:.96},{z:1.72,width:.48,top:.63,depth:.82},
  {z:2.175,width:.22,top:.69,depth:.72}
];`;
if(!text.includes(oldStations))throw new Error('HULL_STATIONS source not found');
text=text.replace(oldStations,newStations);
const start=text.indexOf('function createHullGeometry(detail=8){');
const end=text.indexOf('\n\nfunction createClothSail',start);
if(start<0||end<0)throw new Error('createHullGeometry source not found');
const hullFn=`function createHullGeometry(detail=12){
  const crossSegments=Math.max(10,detail),vertices=[],indices=[];
  for(const station of HULL_STATIONS){
    for(let j=0;j<=crossSegments;j++){
      const u=j/crossSegments,arc=Math.sin(Math.PI*u);
      const x=-Math.cos(Math.PI*u)*station.width;
      const y=station.top-station.depth*Math.pow(arc,.72);
      vertices.push(x,y,station.z);
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
    vertices.push(0,station.top-station.depth*.42,station.z);
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
}`;
text=text.slice(0,start)+hullFn+text.slice(end);
const replacements=[
[`const mast=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,4.2,12),mastMat);mast.name='MainMast';mast.position.set(0,2.55,-.22);mast.castShadow=true;mastSystem.add(mast);`,`const mast=new THREE.Mesh(new THREE.CylinderGeometry(.042,.067,3.08,14),mastMat);mast.name='MainMast';mast.position.set(0,2.02,-.22);mast.castShadow=true;mastSystem.add(mast);`],
[`const boom=new THREE.Mesh(new THREE.CylinderGeometry(.026,.038,2.25,10),mastMat);boom.name='Boom';boom.rotation.z=Math.PI/2;boom.position.set(1.02,1.05,-.2);mastSystem.add(boom);`,`const boom=new THREE.Mesh(new THREE.CylinderGeometry(.026,.042,2.2,12),mastMat);boom.name='Boom';boom.rotation.x=Math.PI/2;boom.position.set(0,.92,.86);mastSystem.add(boom);`],
[`const sail=createClothSail(2.05,3.55,renderer);sail.name='MainSail';sail.position.set(.045,1.03,-.19);mastSystem.add(sail);`,`const sail=createClothSail(2.05,2.58,renderer);sail.name='MainSail';sail.rotation.y=-Math.PI/2;sail.position.set(.018,.94,-.18);mastSystem.add(sail);`],
[`const jib=createClothSail(1.18,2.7,renderer);jib.name='JibSail';jib.scale.x=-1;jib.position.set(-.03,1.02,-.2);mastSystem.add(jib);`,`const jib=createClothSail(1.36,2.32,renderer);jib.name='JibSail';jib.scale.x=-1;jib.rotation.y=-Math.PI/2;jib.position.set(-.018,.92,-.24);mastSystem.add(jib);`],
[`[[new THREE.Vector3(0,4.65,-.22),new THREE.Vector3(-.15,2.1,-.5),new THREE.Vector3(-.52,.58,-1.72)],[new THREE.Vector3(0,4.65,-.22),new THREE.Vector3(.18,2.4,.3),new THREE.Vector3(.48,.58,1.62)],[new THREE.Vector3(0,4.65,-.22),new THREE.Vector3(0,2.2,1.0),new THREE.Vector3(0,.56,2.02)]].forEach(points=>ropes.add(tube(points,.012,ropeMat)));`,`[[new THREE.Vector3(0,3.56,-.22),new THREE.Vector3(0,2.1,-1.2),new THREE.Vector3(0,.58,-2.04)],[new THREE.Vector3(0,3.56,-.22),new THREE.Vector3(0,2.05,.95),new THREE.Vector3(0,.58,2.0)],[new THREE.Vector3(0,3.42,-.22),new THREE.Vector3(-.4,1.9,-.05),new THREE.Vector3(-.68,.55,.25)],[new THREE.Vector3(0,3.42,-.22),new THREE.Vector3(.4,1.9,-.05),new THREE.Vector3(.68,.55,.25)]].forEach(points=>ropes.add(tube(points,.012,ropeMat)));`],
[`const flag=createClothSail(.55,.28,renderer);flag.name='Flag';flag.rotation.z=-Math.PI/2;flag.position.set(0,4.58,-.2);accessories.add(flag);`,`const flag=createClothSail(.56,.27,renderer);flag.name='Flag';flag.rotation.y=-Math.PI/2;flag.position.set(0,3.34,-.2);accessories.add(flag);`],
[`const mast=new THREE.Mesh(new THREE.CylinderGeometry(.04,.055,4.1,distant?6:8),new THREE.MeshStandardMaterial({color:'#4b3222',roughness:.65}));mast.position.set(0,2.5,-.22);root.add(mast);`,`const mast=new THREE.Mesh(new THREE.CylinderGeometry(.04,.06,3.05,distant?6:10),new THREE.MeshStandardMaterial({color:'#4b3222',roughness:.65}));mast.position.set(0,2,-.22);root.add(mast);`],
[`const sail=createClothSail(2,3.5,renderer);sail.position.set(.04,1.04,-.19);root.add(sail);`,`const sail=createClothSail(2,2.55,renderer);sail.rotation.y=-Math.PI/2;sail.position.set(.02,.94,-.18);root.add(sail);const jib=createClothSail(1.3,2.25,renderer);jib.scale.x=-1;jib.rotation.y=-Math.PI/2;jib.position.set(-.02,.92,-.23);root.add(jib);`]
];
for(const [from,to] of replacements){if(!text.includes(from))throw new Error('blockout replacement missing: '+from.slice(0,48));text=text.replace(from,to);}
fs.writeFileSync(file,text);
console.log('Applied blockout hull loft and longitudinal rig orientation.');