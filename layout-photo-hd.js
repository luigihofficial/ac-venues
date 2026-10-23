/* AC Venues Photo HD Preview — independent rendering layer; geometry untouched. */
(function(root){
"use strict";
function init(ctx){
 var R=ctx.renderer,scene=ctx.scene,THREE=ctx.THREE,key=ctx.key,fill=ctx.fill,hemi=ctx.hemi,amb=ctx.amb || ctx.ambient;
 var original={exposure:R.toneMappingExposure,key:key.intensity,fill:fill.intensity,hemi:hemi.intensity,amb:amb ? amb.intensity : 0,pixel:R.getPixelRatio(),shadow:key.shadow.mapSize.x};

 // Visual-only hotel presentation treatment: no placement, geometry, or seat
 // metadata is changed. Original materials are restored in Standard mode.
 var originalMaterials=[], photoMaterials=[], photoTextures=[], photoActive=false;
 function textileTexture(kind){
  var canvas=document.createElement("canvas");canvas.width=canvas.height=256;
  var g=canvas.getContext("2d");
  var carpet=kind==="carpet", upholstery=kind==="upholstery";
  g.fillStyle=carpet?"#9dabb2":upholstery?"#536e81":"#e9ded0";
  g.fillRect(0,0,256,256);
  // Deterministic woven fibres avoid randomized flashes across reloads.
  for(var y=0;y<256;y+=3){
   g.strokeStyle=carpet?"rgba(30,59,74,.10)":upholstery?"rgba(212,226,233,.12)":"rgba(136,114,89,.10)";
   g.lineWidth=1;g.beginPath();g.moveTo(0,y);g.lineTo(256,y);g.stroke();
  }
  for(var x=0;x<256;x+=3){
   g.strokeStyle=carpet?"rgba(240,233,214,.11)":upholstery?"rgba(16,38,57,.10)":"rgba(255,255,255,.22)";
   g.beginPath();g.moveTo(x,0);g.lineTo(x,256);g.stroke();
  }
  if(carpet){
   // Low-contrast hotel carpet lattice with tasteful brass accents.
   g.strokeStyle="rgba(234,213,165,.25)";g.lineWidth=4;
   for(var d=-256;d<512;d+=128){
    g.beginPath();g.moveTo(d,0);g.lineTo(d+256,256);g.stroke();
    g.beginPath();g.moveTo(d,256);g.lineTo(d+256,0);g.stroke();
   }
  }
  var texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  if(THREE.SRGBColorSpace)texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(8,R.capabilities.getMaxAnisotropy?R.capabilities.getMaxAnisotropy():4);
  photoTextures.push(texture);return texture;
 }
 function applyPresentationMaterials(){
  if(photoActive)return;
  var carpet=textileTexture("carpet"),linen=textileTexture("linen"),upholstery=textileTexture("upholstery");
  scene.children.forEach(function(rootObject){
   var role=rootObject.userData&&rootObject.userData.role;
   if(role!=="floor"&&role!=="wall"&&role!=="chair"&&role!=="table")return;
   rootObject.traverse(function(mesh){
    if(!mesh.isMesh||!mesh.material)return;
    var saved=mesh.material;
    var mats=Array.isArray(saved)?saved:[saved];
    var improved=mats.map(function(orig){
     var mat=orig.clone();
     // Metallic frames retain the original finish and are not upholstered.
     var metal=(orig.metalness||0)>0.35;
     if(role==="floor"){
      mat.color.setHex(0xffffff);mat.map=carpet;mat.roughness=0.97;mat.metalness=0;
      // Cover large floors in appropriately scaled textile tiles.
      if(mat.map===carpet&&!carpet.userData.scaled){
       carpet.repeat.set(Math.max(2,ctx.rm.W/12),Math.max(2,ctx.rm.L/12));
       carpet.userData.scaled=true;
      }
     }else if(role==="wall"){
      mat.color.setHex(0xf0e9dd);mat.roughness=0.93;mat.metalness=0;
     }else if(role==="chair"&&!metal){
      mat.color.setHex(0xffffff);mat.map=upholstery;mat.roughness=0.98;mat.metalness=0;
     }else if(role==="table"&&!metal){
      // Linen on covered tables, while retaining the original structural mesh.
      var rgb=orig.color;
      if(rgb&&rgb.r>0.5&&rgb.g>0.5){
       mat.color.setHex(0xffffff);mat.map=linen;mat.roughness=0.99;mat.metalness=0;
      }else{mat.roughness=0.65;}
     }
     mat.needsUpdate=true;photoMaterials.push(mat);return mat;
    });
    originalMaterials.push({mesh:mesh,material:saved});
    mesh.material=Array.isArray(saved)?improved:improved[0];
   });
  });
  photoActive=true;
 }
 function restoreStandardMaterials(){
  if(!photoActive)return;
  originalMaterials.forEach(function(p){p.mesh.material=p.material;});
  originalMaterials=[];
  photoMaterials.forEach(function(m){m.dispose();});photoMaterials=[];
  photoTextures.forEach(function(t){t.dispose();});photoTextures=[];
  photoActive=false;
 }
 function qualityMode(mode){
  var hd=mode==="photo";
  if(hd)applyPresentationMaterials();else restoreStandardMaterials();
  R.toneMappingExposure=hd?1.04:original.exposure;
  key.intensity=hd?1.55:original.key;
  fill.intensity=hd?0.58:original.fill;
  hemi.intensity=hd?0.98:original.hemi;
  if(amb)amb.intensity=hd?0.34:original.amb;
  R.setPixelRatio(hd?Math.min(root.devicePixelRatio||1,2):original.pixel);
  var n=hd?Math.min(2048,R.capabilities.maxTextureSize||2048):original.shadow;
  if(key.shadow.mapSize.x!==n){key.shadow.mapSize.set(n,n);if(key.shadow.map){key.shadow.map.dispose();key.shadow.map=null;}}
  key.shadow.needsUpdate=true;
 }
 function preset(s,type){
  s.setMode("orbit");var o=s.orbit,d=Math.max(s.rm.W,s.rm.L);
  o.tx=0;o.ty=Math.min(4,s.rm.ceil*0.35);o.tz=0;
  if(type==="top"){o.az=1.57;o.pol=0.16;o.rad=d*1.35;}
  if(type==="front"){o.az=-1.57;o.pol=1.15;o.rad=d*1.05;}
  if(type==="corner"){o.az=0.72;o.pol=1;o.rad=d*1.08;}
  if(type==="photo"){o.az=0.56;o.pol=1.17;o.rad=d*0.93;}
 }
 function exportPNG(s,returnData){
  var old=R.getSize(new THREE.Vector2()),pixel=R.getPixelRatio(),aspect=s.cam.aspect;
  var w=2560,h=Math.round(w*old.y/Math.max(old.x,1));
  var max=Math.min(R.capabilities.maxTextureSize||4096,4096),f=Math.min(1,max/w,max/h);
  w=Math.round(w*f);h=Math.round(h*f);
  try{
   R.setPixelRatio(1);R.setSize(w,h,false);s.cam.aspect=w/h;s.cam.updateProjectionMatrix();
   s.updateCamera();s.updateWalls();R.render(scene,s.cam);
   var data=R.domElement.toDataURL("image/png");
   if(!data||data.length<1000)throw Error("The browser did not capture the render.");
   if(returnData)return data;
   var link=document.createElement("a");link.href=data;link.download="ac-venues-photo-hd.png";document.body.appendChild(link);link.click();link.remove();
  }finally{
   R.setPixelRatio(pixel);R.setSize(old.x,old.y,false);s.cam.aspect=aspect;s.cam.updateProjectionMatrix();
   s.updateCamera();s.updateWalls();R.render(scene,s.cam);
  }
 }
 return {qualityMode:qualityMode,preset:preset,exportPNG:exportPNG,dispose:restoreStandardMaterials};
}
root.ACVPhotoHD={init:init};
})(typeof window!=="undefined"?window:globalThis);
