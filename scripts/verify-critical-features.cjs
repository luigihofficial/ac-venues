/* AC Venues regression guard — runs on pull requests and on main. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const checks={
  'City event diagram entry points': ['index.html','data-layoutnew=','data-layoutlist=','acListEventLayouts','acEventChoices'],
  'Event-specific storage': ['index.html','room_layouts','eventDateId','LayoutUI.onListSaved'],
  'Diagram library': ['layout-ui.js','layBrowseSaved','showSavedLibrary','loadEventLayout'],
  'Selected furniture': ['layout-ui.js','layChairType','layTableType','layBackdropType'],
  'Group tools': ['layout-ui.js','rotateSel','dupSel','selectIds','layClearSelection'],
  '3D viewer': ['layout-3d.js','function open(','function export3DReport','Copy view-only link'],
  'HD rendering': ['layout-photo-hd.js','qualityMode','exportPNG'],
  'One-page reports': ['layout-report-3d.js','printCanvas','onePage'],
  'Read-only viewer': ['layout-review.html','VIEW ONLY','layout-share.js'],
  'Live event fiche layout link': ['ficha.html','layoutsWrap','loadEventLayouts','layout-link'],
  'Public token check': ['api/ficha-layouts.js','sheet_token','eventDateId'],
  'Email delivery (retain main changes)': ['api/sheet-send.js','module.exports'],
  'Survey delivery': ['api/survey-send.js','module.exports'],
  'RFP delivery': ['api/rfp-send.js','module.exports']
};
let failed=0;
for(const [name,[path,...parts]] of Object.entries(checks)){
 try{
  const code=read(path);
  for(const part of parts)assert.ok(code.includes(part),`Missing ${part} in ${path}`);
  console.log('PASS',name);
 }catch(e){failed++;console.error('FAIL',name,e.message);}
}
for(const path of ['layout-engine.js','layout-ui.js','layout-3d.js','layout-photo-hd.js','layout-report-3d.js','layout-share.js','api/ficha-layouts.js']){
 try{new vm.Script(read(path),{filename:path});console.log('PASS syntax',path);}
 catch(e){failed++;console.error('FAIL syntax',path,e.message);}
}
for(const html of ['index.html','ficha.html','layout-review.html']){
 const source=read(html);
 for(const [i,m] of [...source.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)].entries()){
  if(!m[1].trim())continue;
  try{new vm.Script(m[1],{filename:html+':inline'+i});}
  catch(e){failed++;console.error('FAIL syntax',html,i,e.message);}
 }
}
if(failed){console.error(`${failed} regression checks failed`);process.exit(1);}
console.log('All critical-module regression checks passed');
