// ============================================================
//  Envío de la FICHA TÉCNICA del evento (Vercel serverless)
//  Dos modos:
//   1) MANUAL → usuario autorizado (JWT de Supabase). Body: { date_id }
//   2) CRON   → Vercel Cron (Authorization: Bearer CRON_SECRET). Envía a los
//               eventos cuyo PRIMER día es EN 2 DÍAS (la ficha llega dos días antes).
//  Variables de entorno: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET,
//   SURVEY_FROM (opcional), SURVEY_REPLYTO (opcional), APP_BASE_URL (opcional).
// ============================================================

const SUPA_URL  = "https://dwhwbcplgcqvuvnzqmne.supabase.co";
const SUPA_ANON = "sb_publishable_t_vSbY1M8moq_BSNWKl5FA_5uSubgxa";
const ALLOWED   = ["global@amorconsciente.com", "noris@amorconsciente.com"];

const BASE    = process.env.APP_BASE_URL || "https://ac-venues.luigihernandez.com";
const LOGO    = BASE + "/logo.png";
const FROM    = process.env.SURVEY_FROM    || "Amor Consciente — Venues <onboarding@resend.dev>";
const REPLYTO = process.env.SURVEY_REPLYTO || "global@amorconsciente.com";

function readBody(req){
  return new Promise((resolve) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let d = ""; req.on("data", c => { d += c; if (d.length > 2e6) req.destroy(); });
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}
function svc(){ return process.env.SUPABASE_SERVICE_ROLE_KEY; }
async function sget(path){
  const r = await fetch(SUPA_URL + "/rest/v1/" + path, { headers: { apikey: svc(), Authorization: "Bearer " + svc() } });
  if (!r.ok) throw new Error("GET " + path + " → " + r.status + " " + (await r.text()).slice(0,200));
  return r.json();
}
async function spatch(path, patch){
  const r = await fetch(SUPA_URL + "/rest/v1/" + path, {
    method: "PATCH",
    headers: { apikey: svc(), Authorization: "Bearer " + svc(), "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (!r.ok) throw new Error("PATCH " + path + " → " + r.status + " " + (await r.text()).slice(0,200));
  return true;
}
const enc = encodeURIComponent;
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e||"").trim());
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
const yn = v => v==='si' ? 'Sí' : (v==='no' ? 'No' : '');

function row(label, val){ if(!val) return ''; return `<tr><td style="padding:9px 12px;border-bottom:1px solid #efe8da;color:#8a9199;font-size:12px;white-space:nowrap;vertical-align:top;font-weight:600">${esc(label)}</td><td style="padding:9px 12px;border-bottom:1px solid #efe8da;color:#22303f;font-size:14px"><b>${val}</b></td></tr>`; }

function filesBlock(files){
  const list = (files||[]).filter(f=>f.url);
  if(!list.length) return '';
  const items = list.map(f=>`<a href="${esc(f.url)}" style="display:inline-block;margin:4px 6px 0 0;padding:9px 14px;background:#fff;border:1px solid #e6ddca;border-radius:10px;color:#1e3a5f;text-decoration:none;font-size:13px;font-weight:600">📎 ${esc(f.name||'archivo')}</a>`).join('');
  return `<div style="margin:6px 0 18px"><div style="font-size:12px;color:#8a9199;font-weight:600;margin:0 0 6px">Archivos para descargar</div>${items}</div>`;
}
function sheetEmailHtml({ ev, sheet, recips, files }){
  const hotel = esc(sheet.hotel_name || "");
  const people = (recips||[]).map(r=>esc(r.name||r.email)).filter(Boolean).join(", ");
  const addr = sheet.address ? (esc(sheet.address) + (sheet.map_url?` · <a href="${esc(sheet.map_url)}" style="color:#1e3a5f">ver mapa</a>`:'')) : (sheet.map_url?`<a href="${esc(sheet.map_url)}" style="color:#1e3a5f">ver mapa</a>`:'');
  const contact = [esc(sheet.contact_name||''), esc(sheet.contact_phone||'')].filter(Boolean).join(' · ');
  const rows = [
    row('Hotel', hotel),
    row('Dirección', addr),
    row('Salón', esc(sheet.room_name||'')),
    row('Líderes y speakers', esc(people)),
    row('Contacto', contact),
    row('Parqueo (por persona)', esc(sheet.parking_cost||'')),
    row('Re-entrada al parqueo', yn(sheet.parking_reentry)),
    row('WiFi incluido', yn(sheet.wifi_included)),
    row('Green room incluido', yn(sheet.greenroom_included)),
    row('Hora de set-up aprobada', esc(sheet.setup_time||'')),
    row('Notas', esc(sheet.notes||'').replace(/\n/g,'<br>'))
  ].join('');
  const contractBtn = sheet.contract_url ? `<p style="text-align:center;margin:0 0 8px"><a href="${esc(sheet.contract_url)}" style="display:inline-block;background-color:#b8860b;background-image:linear-gradient(135deg,#c9970d,#a9790a);color:#ffffff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:12px;border:1px solid #8a6208">Descargar contrato</a></p>` : '';
  const liveUrl = sheet.sheet_token ? (BASE + "/ficha.html?t=" + enc(sheet.sheet_token)) : '';
  const liveBtn = liveUrl ? `<p style="text-align:center;margin:0 0 8px"><a href="${liveUrl}" style="display:inline-block;background-color:#1e3a5f;background-image:linear-gradient(135deg,#1e3a5f,#14263f);color:#ffffff;text-decoration:none;font-weight:700;padding:14px 30px;border-radius:12px;border:1px solid #14263f">Ver ficha del evento — siempre actualizada</a></p><p style="margin:0 0 18px;text-align:center;color:#8a9199;font-size:12px;line-height:1.5">Este enlace muestra <b>siempre la información más reciente</b>. Si algo cambia, no hace falta reenviar este correo — solo abre el mismo enlace.</p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#f5f1e8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#22303f">
  <div style="max-width:600px;margin:0 auto;padding:28px 16px">
    <div style="border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(20,38,63,.10)">
      <div style="background-color:#14263f;background-image:linear-gradient(135deg,#1e3a5f,#14263f);padding:28px 22px 22px;text-align:center">
        <img src="${LOGO}" width="54" height="54" alt="Amor Consciente" style="display:block;margin:0 auto 10px;border:0">
        <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.3px">Amor Consciente</div>
        <div style="color:#e3b23c;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;margin-top:4px">Ficha técnica del evento</div>
      </div>
      <div style="height:3px;background-color:#c99a2e;background-image:linear-gradient(90deg,#b8860b,#e3b23c);line-height:3px;font-size:0">&nbsp;</div>
      <div style="background:#fffdf8;padding:24px">
        <p style="margin:0 0 4px;font-size:16px;color:#1e3a5f"><b>${esc(ev.label||'Evento')}</b></p>
        <p style="margin:0 0 18px;color:#8a9199;font-size:13px;line-height:1.5">Aquí tienes la información logística del evento. Cualquier duda, responde a este correo.</p>
        ${liveBtn}
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #efe8da;border-radius:10px;overflow:hidden;margin-bottom:18px">${rows}</table>
        ${filesBlock(files)}
        ${contractBtn}
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:#8a9199;margin:16px 0 0;letter-spacing:.04em">Amor Consciente · Sourcing de venues</p>
  </div></body></html>`;
}

async function sendEmail({ to, subject, html }){
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLYTO, subject, html })
  });
  const j = await r.json().catch(()=> ({}));
  if (!r.ok) return { ok:false, err: (j && (j.message||JSON.stringify(j))) || ("HTTP "+r.status) };
  return { ok:true, id: j.id };
}

async function sendSheetForEvent(dateId, { markSent = true } = {}){
  const ev = (await sget(`event_dates?id=eq.${enc(dateId)}&select=id,label,start_date`))[0];
  if (!ev) return { dateId, sent:0, skipped:0, reason:"evento no encontrado" };
  const sheet = (await sget(`event_sheet?date_id=eq.${enc(dateId)}&select=*`))[0];
  if (!sheet) return { dateId, label: ev.label, sent:0, skipped:0, reason:"sin ficha técnica — llena los datos antes de enviar" };
  const recips = await sget(`event_recipients?date_id=eq.${enc(dateId)}&select=name,email,role`);
  const valid = (recips||[]).filter(r => validEmail(r.email));
  if (!valid.length) return { dateId, label: ev.label, sent:0, skipped:0, reason:"sin destinatarios con email válido" };

  let files = [];
  try { files = await sget(`event_files?date_id=eq.${enc(dateId)}&share=eq.true&select=name,url,mime,size&order=created_at.asc`); } catch(e){}
  const html = sheetEmailHtml({ ev, sheet, recips: valid, files });
  let sent = 0, skipped = 0; const errors = [];
  for (const r of valid){
    const em = await sendEmail({ to: r.email.trim(), subject: `Ficha técnica del evento — ${ev.label}`, html });
    if (em.ok) sent++; else { skipped++; errors.push(r.email + ": " + em.err); }
  }
  if (markSent && sent > 0) { try { await spatch(`event_sheet?date_id=eq.${enc(dateId)}`, { sheet_sent_at: new Date().toISOString() }); } catch {} }
  return { dateId, label: ev.label, sent, skipped, errors: errors.slice(0,10) };
}

function notifyEmailHtml({ ev, hotel, liveUrl }){
  return `<!doctype html><html><body style="margin:0;background:#f5f1e8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#22303f">
  <div style="max-width:600px;margin:0 auto;padding:28px 16px">
    <div style="border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(20,38,63,.10)">
      <div style="background-color:#14263f;background-image:linear-gradient(135deg,#1e3a5f,#14263f);padding:26px 22px 20px;text-align:center">
        <img src="${LOGO}" width="50" height="50" alt="Amor Consciente" style="display:block;margin:0 auto 10px;border:0">
        <div style="color:#ffffff;font-size:19px;font-weight:700">Amor Consciente</div>
        <div style="color:#e3b23c;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;margin-top:4px">Ficha actualizada</div>
      </div>
      <div style="height:3px;background-color:#c99a2e;background-image:linear-gradient(90deg,#b8860b,#e3b23c);line-height:3px;font-size:0">&nbsp;</div>
      <div style="background:#fffdf8;padding:24px;text-align:center">
        <p style="margin:0 0 6px;font-size:16px;color:#1e3a5f"><b>${esc(ev.label||'Evento')}</b>${hotel?` · ${esc(hotel)}`:''}</p>
        <p style="margin:0 0 20px;color:#8a9199;font-size:13px;line-height:1.5">Se actualizó la información logística del evento. Abre la ficha para ver los datos más recientes.</p>
        <p style="text-align:center;margin:0 0 8px"><a href="${liveUrl}" style="display:inline-block;background-color:#1e3a5f;background-image:linear-gradient(135deg,#1e3a5f,#14263f);color:#ffffff;text-decoration:none;font-weight:700;padding:14px 30px;border-radius:12px;border:1px solid #14263f">Ver ficha actualizada</a></p>
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:#8a9199;margin:16px 0 0;letter-spacing:.04em">Amor Consciente · Sourcing de venues</p>
  </div></body></html>`;
}

async function notifySheetUpdate(dateId){
  const ev = (await sget(`event_dates?id=eq.${enc(dateId)}&select=id,label`))[0];
  if (!ev) return { dateId, sent:0, skipped:0, reason:"evento no encontrado" };
  const sheet = (await sget(`event_sheet?date_id=eq.${enc(dateId)}&select=sheet_token,hotel_name`))[0];
  if (!sheet || !sheet.sheet_token) return { dateId, label: ev.label, sent:0, skipped:0, reason:"aún no hay ficha/enlace — envía la ficha primero" };
  const recips = await sget(`event_recipients?date_id=eq.${enc(dateId)}&select=name,email`);
  const valid = (recips||[]).filter(r => validEmail(r.email));
  if (!valid.length) return { dateId, label: ev.label, sent:0, skipped:0, reason:"sin destinatarios con email válido" };
  const liveUrl = BASE + "/ficha.html?t=" + enc(sheet.sheet_token);
  const html = notifyEmailHtml({ ev, hotel: sheet.hotel_name||'', liveUrl });
  let sent = 0, skipped = 0; const errors = [];
  for (const r of valid){
    const em = await sendEmail({ to: r.email.trim(), subject: `Ficha actualizada — ${ev.label}`, html });
    if (em.ok) sent++; else { skipped++; errors.push(r.email + ": " + em.err); }
  }
  return { dateId, label: ev.label, sent, skipped, errors: errors.slice(0,10), mode:"notify" };
}

// La ficha se envía DOS días antes del primer día del evento
function sheetTargetISO(){ return new Date(Date.now() + 2*24*3600*1000).toISOString().slice(0,10); }

module.exports = async function handler(req, res){
  if (req.method !== "POST" && req.method !== "GET"){ res.status(405).json({ error: "Método no permitido" }); return; }
  if (!svc()){ res.status(500).json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en Vercel." }); return; }
  if (!process.env.RESEND_API_KEY){ res.status(500).json({ error: "Falta RESEND_API_KEY en Vercel." }); return; }

  const authRaw = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const CRON = process.env.CRON_SECRET;
  const isCron = !!(CRON && authRaw === CRON);

  if (!isCron){
    if (!authRaw){ res.status(401).json({ error: "Sin sesión." }); return; }
    let email = "";
    try {
      const u = await fetch(SUPA_URL + "/auth/v1/user", { headers: { apikey: SUPA_ANON, Authorization: "Bearer " + authRaw } });
      if (!u.ok){ res.status(401).json({ error: "Sesión inválida." }); return; }
      email = ((await u.json()).email || "").toLowerCase();
    } catch { res.status(401).json({ error: "No pude verificar la sesión." }); return; }
    if (!ALLOWED.includes(email)){ res.status(403).json({ error: "Correo no autorizado." }); return; }
  }

  try {
    if (isCron){
      const tm = sheetTargetISO();
      const due = await sget(`event_dates?start_date=eq.${tm}&select=id`);
      const results = [];
      for (const e of (due||[])){
        const sheet = (await sget(`event_sheet?date_id=eq.${enc(e.id)}&select=date_id,sheet_sent_at`))[0];
        if (!sheet || sheet.sheet_sent_at) continue;   // sin ficha o ya enviada
        results.push(await sendSheetForEvent(e.id, { markSent: true }));
      }
      res.status(200).json({ ok:true, mode:"cron", fecha:tm, eventos: results.length, results });
      return;
    }
    const body = await readBody(req);
    if (!body.date_id){ res.status(400).json({ error: "Falta date_id." }); return; }
    if (body.notify){
      const result = await notifySheetUpdate(body.date_id);
      res.status(200).json({ ok:true, mode:"notify", ...result });
      return;
    }
    const result = await sendSheetForEvent(body.date_id, { markSent: true });
    res.status(200).json({ ok:true, mode:"manual", ...result });
  } catch(e){
    res.status(500).json({ error: String(e && e.message || e).slice(0,300) });
  }
};
