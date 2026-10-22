/* AC Venues: self-contained 3D/2D report exporter; planning geometry remains untouched. */
(function(root){
"use strict";
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function value(v){return v==null||v===""?"—":String(v);}
function image(src){
 return new Promise(function(resolve,reject){
  var im=new Image();im.onload=function(){resolve(im);};im.onerror=function(){reject(new Error("Report image could not be decoded."));};im.src=src;
 });
}
function planImage(svg){
 if(!svg)return Promise.reject(new Error("The 2D floor plan is unavailable; return to the planner and reopen 3D."));
 // Render a complete snapshot of the 2D plan with its embedded SVG styles.
 var url="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
 return image(url);
}
function textBlock(ctx,text,x,y,maxWidth,lineH){
 // Wrap long report details without silently omitting any furniture or warning.
 var words=String(text).split(/\s+/),line="",used=0;
 words.forEach(function(word){
  var next=line?line+" "+word:word;
  if(ctx.measureText(next).width>maxWidth&&line){
   ctx.fillText(line,x,y+used*lineH);used++;line=word;
  }else line=next;
 });
 if(line){ctx.fillText(line,x,y+used*lineH);used++;}
 return used*lineH;
}
function drawFit(ctx,img,x,y,w,h,bg){
 if(bg){ctx.fillStyle=bg;ctx.fillRect(x,y,w,h);}
 if(!img)return;
 var ratio=Math.min(w/img.width,h/img.height);
 var dw=img.width*ratio,dh=img.height*ratio;
 ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
}
function prepSheet(report,photo,plan,onePage){
 var W=1800,M=68;var counts=report.counts||[],checks=report.checks||{};
 var allIssues=(checks.violations||[]).map(function(s){return "Conflict: "+s;}).concat((checks.clearance||[]).map(function(s){return "Clearance: "+s;}));
 if(!allIssues.length)allIssues.push("No hard conflicts or clearance warnings reported.");
 // Generous sheet height; a single PNG sheet and a single scaled PDF page.
 var headline=onePage?350:310;
 var imageH=onePage?660:950;
 var planH=onePage?670:0;
 var reportH=Math.max(900,440+counts.length*52+allIssues.length*64);
 var H=headline+imageH+planH+reportH+110;
 var canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;
 var g=canvas.getContext("2d");g.fillStyle="#ffffff";g.fillRect(0,0,W,H);
 g.fillStyle="#162c49";g.fillRect(0,0,W,16);
 g.fillStyle="#162c49";g.font="bold 47px Arial,sans-serif";
 var title=value(report.venue)+" — "+value(report.room);
 textBlock(g,title,M,101,W-2*M,54);
 g.font="26px Arial,sans-serif";g.fillStyle="#60718a";
 var dim=report.dimensions||{};
 g.fillText(value(report.layout)+"  |  "+value(dim.width)+" x "+value(dim.length)+" ft  |  "+value(dim.area)+" ft²  |  ceiling "+value(dim.ceiling)+" ft",M,169);
 g.fillText("AC VENUES  •  ROOM PLANNING REPORT  •  "+value(report.generatedAt),M,215);
 if(report.event&&report.event.label){
  g.fillStyle="#172b49";g.font="bold 21px Arial";
  g.fillText("EVENT: "+value(report.event.city)+" • "+value(report.event.label)+" • "+value(report.event.start)+" — "+value(report.event.end),M,239);
 }
 g.fillStyle="#a27b35";g.fillRect(M,244,W-2*M,4);
 var y=280;
 g.fillStyle="#162c49";g.font="bold 31px Arial";g.fillText("3D ROOM PERSPECTIVE",M,y);
 y+=24;drawFit(g,photo,M,y,W-2*M,imageH-80,"#e8edf1");y+=imageH-52;
 if(onePage){
  g.fillStyle="#162c49";g.font="bold 31px Arial";g.fillText("2D TOP VIEW • FLOOR PLAN",M,y);y+=25;
  drawFit(g,plan,M,y,W-2*M,planH-80,"#f6f5f1");y+=planH-52;
 }
 g.fillStyle="#a27b35";g.fillRect(M,y,W-2*M,3);y+=49;
 var left=M,right=940;
 g.font="bold 31px Arial";g.fillStyle="#162c49";g.fillText("CAPACITY & FIT",left,y);g.fillText("FURNITURE & EQUIPMENT",right,y);y+=48;
 var cap=report.capacities||{};
 var lines=[["Published",cap.published],["Estimated",cap.estimated],["Validated",cap.validated],["Requested",cap.requested],["Fit",value(cap.fit).replace(/_/g," ")]];
 g.font="25px Arial,sans-serif";g.fillStyle="#25384e";
 lines.forEach(function(it,i){g.fillText(it[0]+": "+value(it[1]),left,y+i*45);});
 var cy=y;
 counts.forEach(function(c){
  cy+=textBlock(g,value(c.name)+"  × "+value(c.qty),right,cy,770,35)+11;
 });
 y=Math.max(y+lines.length*45,cy)+44;
 g.fillStyle="#162c49";g.font="bold 31px Arial";g.fillText("CHECKS & CLEARANCE",M,y);y+=43;
 g.fillStyle=(checks.feasible===false)?"#a6342b":"#25384e";g.font="24px Arial";
 allIssues.forEach(function(issue){y+=textBlock(g,issue,M,y,W-2*M,34)+13;});
 y+=30;g.fillStyle="#6a7686";g.font="22px Arial";
 y+=textBlock(g,report.assumptions||"For planning only; confirm dimensions and code compliance on site.",M,y,W-2*M,31);
 if(cap.fitReason){y+=22;y+=textBlock(g,"Fit explanation: "+cap.fitReason,M,y,W-2*M,31);}
 g.font="21px Arial";g.fillText("Rendered visualization is illustrative, not a manufacturer-certified photograph.",M,H-35);
 if(y>H-65){
  // Unexpectedly long warnings: make sure no text is clipped.
  var expanded=document.createElement("canvas");expanded.width=W;expanded.height=y+110;
  expanded.getContext("2d").fillStyle="#ffffff";
  expanded.getContext("2d").fillRect(0,0,W,expanded.height);
  expanded.getContext("2d").drawImage(canvas,0,0);
  return expanded;
 }
 return canvas;
}
function saveCanvas(canvas,name){
 var a=document.createElement("a");a.href=canvas.toDataURL("image/png");a.download=name;document.body.appendChild(a);a.click();a.remove();
}
function printCanvas(canvas,windowRef,filename,link){
 if(!windowRef)throw new Error("Please allow pop-ups to export a PDF.");
 var src=canvas.toDataURL("image/png");
 var href=link||"";
 // Text and hyperlink are real HTML, not just pixels, so printing to PDF
 // creates an actual clickable annotation in compatible browsers.
 var action=href?'<a class="share" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">OPEN INTERACTIVE 2D + 3D VIEW (READ ONLY) ↗</a>':"";
 var html='<!doctype html><html><head><meta charset="utf-8"><title>'+esc(filename)+'</title>'+
  '<style>@page{size:letter portrait;margin:0}html,body{padding:0;margin:0;background:white}img{width:100%;height:100vh;object-fit:contain;display:block}.share{position:absolute;left:6%;bottom:1.2%;background:#172b49;color:#fff;text-decoration:underline;font:700 10pt Arial;padding:8pt 14pt;border-radius:5pt}@media print{.share{position:fixed;bottom:1.2%;left:6%}}</style></head><body>'+
  '<img id="sheet" src="'+src+'">'+action+'<script>document.getElementById("sheet").onload=function(){setTimeout(function(){window.print();},450)};</scr'+'ipt></body></html>';
 windowRef.document.open();windowRef.document.write(html);windowRef.document.close();
}
async function build(view,report,format,onePage,popup,shareUrl){
 if(!report)throw new Error("Report details unavailable; reopen this viewer from the layout designer.");
 var pictures=await Promise.all([image(view.photo),onePage?planImage(report.planSvg):Promise.resolve(null)]);
 var canvas=prepSheet(report,pictures[0],pictures[1],onePage);
 // PNG files do not support clickable links. Include a caption; the PDF
 // version embeds a real hyperlink to the interactive read-only viewer.
 if(shareUrl){
  var g=canvas.getContext("2d");
  g.fillStyle="#ffffff";g.fillRect(60,canvas.height-100,canvas.width-120,90);
  g.fillStyle="#172b49";g.font="bold 24px Arial";
  g.fillText("INTERACTIVE 2D + 3D · Read-only viewing link available in PDF version",68,canvas.height-55);
 }
 if(format==="pdf")printCanvas(canvas,popup,"AC Venues room report",shareUrl);
 else saveCanvas(canvas,onePage?"ac-venues-one-page-report.png":"ac-venues-3d-report.png");
}
function exportReport(args){
 var popup=args.format==="pdf"?(args.popup||root.open("","_blank")):null;
 if(args.format==="pdf"&&!popup)throw new Error("Allow pop-ups to save the report as PDF.");
 if(popup){popup.document.write("<p style='font:16px Arial;padding:24px'>Generating AC Venues report…</p>");}
 return Promise.resolve(args.shareUrl).catch(function(){return null;}).then(function(link){return build({photo:args.photo},args.report,args.format,args.onePage,popup,link);}).catch(function(err){
  if(popup){popup.document.body.innerHTML="<p style='font:16px Arial;padding:24px'>"+esc(err.message||err)+"</p>";}
  throw err;
 });
}
root.ACVReport3D={exportReport:exportReport};
})(typeof window!=="undefined"?window:globalThis);
