// Public live-fiche layout viewer: read-only and scoped by the existing sheet token.
// Service role credential never leaves the Vercel function.
const SUPA_URL="https://dwhwbcplgcqvuvnzqmne.supabase.co";
async function query(table,params,key){
 const qs=new URLSearchParams(params);
 const response=await fetch(SUPA_URL+"/rest/v1/"+table+"?"+qs.toString(),{
   headers:{apikey:key,Authorization:"Bearer "+key,Accept:"application/json"},signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw new Error("Supabase query failed ("+response.status+")");
 return response.json();
}
export default async function handler(req,res){
 res.setHeader("Cache-Control","private, no-store, max-age=0");
 res.setHeader("X-Content-Type-Options","nosniff");
 if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
 const token=typeof req.query.t==="string"?req.query.t:"";
 if(!/^[a-fA-F0-9]{32}$/.test(token))return res.status(400).json({error:"Invalid sheet link"});
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)return res.status(503).json({error:"Public layout service not configured"});
 try{
  const sheets=await query("event_sheet",{select:"date_id",sheet_token:"eq."+token,limit:"1"},key);
  if(!sheets.length)return res.status(404).json({error:"Sheet not found"});
  const id=sheets[0].date_id;
  if(!/^[a-fA-F0-9-]{36}$/.test(id))return res.status(404).json({error:"Invalid event"});
  const layouts=await query("room_layouts",{
    select:"id,venue,room_name,layout_id,updated_at,data",
    "data->params->>eventDateId":"eq."+id,
    order:"updated_at.desc",limit:"200"
  },key);
  const list=layouts.filter(x=>x.data&&x.data.params&&x.data.params.eventDateId===id&&Array.isArray(x.data.objects))
    .map(x=>({
      id:x.id,venue:x.venue,room_name:x.room_name,layout_name:x.data.params.layout||x.layout_id,
      updated_at:x.updated_at,
      snapshot:{
        room:x.data.room,
        objects:x.data.objects.slice(0,2000),
        params:{layout:x.data.params.layout||"THEATER"}
      }
    }));
  return res.status(200).json({layouts:list});
 }catch(err){
  console.error("Public event layout query:",err.message||err);
  return res.status(502).json({error:"Layout temporarily unavailable"});
 }
}
