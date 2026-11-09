/* AC Venues public review snapshots.
   Enlace CORTO: guarda el diagrama en Supabase (tabla shared_layouts) con un
   token aleatorio y el link queda como layout-review.html#t=<token>.
   Si no hay sesión/Supabase o falla, cae al enlace autocontenido (largo),
   y los enlaces largos antiguos se siguen abriendo igual. */
(function(root){"use strict";
var SUPA_URL="https://dwhwbcplgcqvuvnzqmne.supabase.co";
var SUPA_ANON="sb_publishable_t_vSbY1M8moq_BSNWKl5FA_5uSubgxa";
var REVIEW_BASE="https://ac-venues.luigihernandez.com/layout-review.html";

function bytesToB64(bytes){var parts=[];for(var i=0;i<bytes.length;i+=8192){parts.push(String.fromCharCode.apply(null,bytes.subarray(i,i+8192)));}return btoa(parts.join("")).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function b64ToBytes(str){var plain=atob(str.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((str.length+3)%4));var a=new Uint8Array(plain.length);for(var i=0;i<plain.length;i++)a[i]=plain.charCodeAt(i);return a;}
// Token corto, sin caracteres ambiguos (sin l, o, 0, 1).
function randToken(n){var a="abcdefghijkmnpqrstuvwxyz23456789",s="";var arr=new Uint8Array(n);try{(root.crypto||crypto).getRandomValues(arr);}catch(e){for(var j=0;j<n;j++)arr[j]=Math.floor(Math.random()*256);}for(var i=0;i<n;i++)s+=a[arr[i]%a.length];return s;}

async function encode(layout){
 var payload={v:1,room:layout.room,objects:layout.objects,params:layout.params};
 // 1) Preferido: enlace CORTO guardando el diagrama en Supabase.
 try{
  var _sb=(typeof sb!=="undefined")?sb:(root.sb||null);
  if(_sb&&typeof _sb.from==="function"){
   var by=(typeof USER!=="undefined"&&USER&&USER.email)?USER.email:"";
   for(var attempt=0;attempt<3;attempt++){
    var token=randToken(10);
    var ins=await _sb.from("shared_layouts").insert({token:token,payload:payload,created_by:by});
    if(!ins.error){return REVIEW_BASE+"#t="+token;}
    // Colisión de token muy improbable: reintenta; otro error → cae al largo.
    if(!/duplicate|unique/i.test(ins.error.message||"")) break;
   }
  }
 }catch(e){/* cae al enlace largo */}
 // 2) Respaldo: enlace autocontenido (largo), como antes.
 var json=JSON.stringify(payload);
 var bytes=new TextEncoder().encode(json),prefix="u";
 if(typeof CompressionStream==="function"){
  var stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  bytes=new Uint8Array(await new Response(stream).arrayBuffer());prefix="g";
 }
 var tok=prefix+bytesToB64(bytes);
 if(tok.length>125000)throw new Error("This layout is too large for a self-contained sharing link.");
 return REVIEW_BASE+"#"+tok;
}

async function decode(hash){
 var raw=String(hash||"").replace(/^#/,"");
 // Enlace CORTO: #t=<token> → busca el diagrama en Supabase (sin login).
 var mt=raw.match(/^t=([a-z0-9]{6,40})$/i);
 if(mt){
  var r;
  try{
   r=await fetch(SUPA_URL+"/rest/v1/rpc/get_shared_layout",{method:"POST",
    headers:{apikey:SUPA_ANON,Authorization:"Bearer "+SUPA_ANON,"Content-Type":"application/json"},
    body:JSON.stringify({p_token:mt[1]})});
  }catch(e){throw new Error("No se pudo conectar para cargar el diagrama compartido.");}
  if(!r.ok)throw new Error("No se pudo cargar el diagrama compartido.");
  var obj=await r.json();
  if(obj&&obj.payload&&!obj.objects)obj=obj.payload; // por si viniera envuelto
  if(!obj||obj.v!==1||!obj.room||!Array.isArray(obj.objects)||obj.objects.length>2000)
   throw new Error("Este enlace de revisión no es válido o ya no está disponible.");
  return obj;
 }
 // Enlace LARGO autocontenido (compatibilidad con los enlaces antiguos).
 var token=raw;
 if(!/^[ug][a-zA-Z0-9_-]+$/.test(token)||token.length>125001)throw new Error("Invalid or incomplete review link.");
 var b=b64ToBytes(token.slice(1));
 if(token[0]==="g"){
  if(typeof DecompressionStream!=="function")throw new Error("This browser does not support compressed review links.");
  b=new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
 }
 if(b.length>1500000)throw new Error("Review data exceeds the supported size.");
 var o=JSON.parse(new TextDecoder().decode(b));
 if(!o||o.v!==1||!o.room||!Array.isArray(o.objects)||o.objects.length>2000)throw new Error("Invalid review snapshot.");
 return o;
}
root.ACVShare={encode:encode,decode:decode};
})(typeof window!=="undefined"?window:globalThis);
