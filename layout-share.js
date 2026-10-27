/* AC Venues public review snapshots: no credentials, write APIs or persistent tokens. */
(function(root){"use strict";
function bytesToB64(bytes){var parts=[];for(var i=0;i<bytes.length;i+=8192){parts.push(String.fromCharCode.apply(null,bytes.subarray(i,i+8192)));}return btoa(parts.join("")).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function b64ToBytes(str){var plain=atob(str.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((str.length+3)%4));var a=new Uint8Array(plain.length);for(var i=0;i<plain.length;i++)a[i]=plain.charCodeAt(i);return a;}
async function encode(layout){
 var json=JSON.stringify({v:1,room:layout.room,objects:layout.objects,params:layout.params});
 var bytes=new TextEncoder().encode(json),prefix="u";
 if(typeof CompressionStream==="function"){
  var stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  bytes=new Uint8Array(await new Response(stream).arrayBuffer());prefix="g";
 }
 var token=prefix+bytesToB64(bytes);
 if(token.length>125000)throw new Error("This layout is too large for a self-contained sharing link.");
 return "https://ac-venues.luigihernandez.com/layout-review.html#"+token;
}
async function decode(hash){
 var token=String(hash||"").replace(/^#/,"");
 if(!/^[ug][a-zA-Z0-9_-]+$/.test(token)||token.length>125001)throw new Error("Invalid or incomplete review link.");
 var bytes=b64ToBytes(token.slice(1));
 if(token[0]==="g"){
  if(typeof DecompressionStream!=="function")throw new Error("This browser does not support compressed review links.");
  bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
 }
 if(bytes.length>1500000)throw new Error("Review data exceeds the supported size.");
 var obj=JSON.parse(new TextDecoder().decode(bytes));
 if(!obj||obj.v!==1||!obj.room||!Array.isArray(obj.objects)||obj.objects.length>2000)throw new Error("Invalid review snapshot.");
 return obj;
}
root.ACVShare={encode:encode,decode:decode};
})(typeof window!=="undefined"?window:globalThis);
