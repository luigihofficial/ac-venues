/* AC Venues Photo HD Preview — independent rendering layer; geometry untouched. */
(function(root){
"use strict";
function init(ctx){
 var R=ctx.renderer,scene=ctx.scene,THREE=ctx.THREE,key=ctx.key,fill=ctx.fill,hemi=ctx.hemi,amb=ctx.amb || ctx.ambient;
 var original={exposure:R.toneMappingExposure,key:key.intensity,fill:fill.intensity,hemi:hemi.intensity,amb:amb ? amb.intensity : 0,pixel:R.getPixelRatio(),shadow:key.shadow.mapSize.x};
 function qualityMode(mode){
  var hd=mode==="photo";
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
 function exportPNG(s){
  var old=R.getSize(new THREE.Vector2()),pixel=R.getPixelRatio(),aspect=s.cam.aspect;
  var w=2560,h=Math.round(w*old.y/Math.max(old.x,1));
  var max=Math.min(R.capabilities.maxTextureSize||4096,4096),f=Math.min(1,max/w,max/h);
  w=Math.round(w*f);h=Math.round(h*f);
  try{
   R.setPixelRatio(1);R.setSize(w,h,false);s.cam.aspect=w/h;s.cam.updateProjectionMatrix();
   s.updateCamera();s.updateWalls();R.render(scene,s.cam);
   var data=R.domElement.toDataURL("image/png");
   if(!data||data.length<1000)throw Error("The browser did not capture the render.");
   var link=document.createElement("a");link.href=data;link.download="ac-venues-photo-hd.png";document.body.appendChild(link);link.click();link.remove();
  }finally{
   R.setPixelRatio(pixel);R.setSize(old.x,old.y,false);s.cam.aspect=aspect;s.cam.updateProjectionMatrix();
   s.updateCamera();s.updateWalls();R.render(scene,s.cam);
  }
 }
 return {qualityMode:qualityMode,preset:preset,exportPNG:exportPNG};
}
root.ACVPhotoHD={init:init};
})(typeof window!=="undefined"?window:globalThis);
