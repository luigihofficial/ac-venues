// ============================================================
//  Envío de encuestas de evaluación de hoteles (Vercel serverless)
//  Dos modos:
//   1) MANUAL  → usuario autorizado (JWT de Supabase). Body: { date_id, resend? }
//   2) CRON    → Vercel Cron (Authorization: Bearer CRON_SECRET). Envía a los
//                eventos cuyo ÚLTIMO día fue AYER (el día siguiente al evento).
//  Crea un token único por destinatario y manda el correo con Resend.
//  Variables de entorno necesarias (Vercel → Settings → Environment Variables):
//   - SUPABASE_SERVICE_ROLE_KEY   (Supabase → Settings → API → service_role)
//   - RESEND_API_KEY              (Resend → API Keys)
//   - CRON_SECRET                 (cualquier cadena secreta; Vercel la envía en el cron)
//   - SURVEY_FROM   (opcional)    p.ej.  Amor Consciente — Venues <venues@luigihernandez.com>
//   - SURVEY_REPLYTO(opcional)    p.ej.  global@amorconsciente.com
//   - APP_BASE_URL  (opcional)    p.ej.  https://ac-venues.luigihernandez.com
// ============================================================

const SUPA_URL  = "https://dwhwbcplgcqvuvnzqmne.supabase.co";
const SUPA_ANON = "sb_publishable_t_vSbY1M8moq_BSNWKl5FA_5uSubgxa";
const ALLOWED   = ["global@amorconsciente.com", "noris@amorconsciente.com"];

const BASE     = process.env.APP_BASE_URL || "https://ac-venues.luigihernandez.com";
const LOGO     = BASE + "/logo.png";
// Hasta verificar el dominio en Resend, usa el remitente de prueba onboarding@resend.dev
// (sólo permite enviarte a TI). Una vez verificado luigihernandez.com, pon SURVEY_FROM.
const FROM     = process.env.SURVEY_FROM    || "Amor Consciente — Venues <onboarding@resend.dev>";
const REPLYTO  = process.env.SURVEY_REPLYTO || "global@amorconsciente.com";

const { randomUUID } = require("crypto");

function readBody(req){
  return new Promise((resolve) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let d = ""; req.on("data", c => { d += c; if (d.length > 2e6) req.destroy(); });
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

// --- REST helpers (service role: saltan RLS) ---
function svc(){ return process.env.SUPABASE_SERVICE_ROLE_KEY; }
async function sget(path){
  const r = await fetch(SUPA_URL + "/rest/v1/" + path, {
    headers: { apikey: svc(), Authorization: "Bearer " + svc() }
  });
  if (!r.ok) throw new Error("GET " + path + " → " + r.status + " " + (await r.text()).slice(0,200));
  return r.json();
}
async function spost(path, rows){
  const r = await fetch(SUPA_URL + "/rest/v1/" + path, {
    method: "POST",
    headers: { apikey: svc(), Authorization: "Bearer " + svc(), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(rows)
  });
  if (!r.ok) throw new Error("POST " + path + " → " + r.status + " " + (await r.text()).slice(0,200));
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

function emailHtml({ name, eventLabel, venue, link }){
  return `<!doctype html><html><body style="margin:0;background:#f5f1e8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#22303f">
  <div style="max-width:560px;margin:0 auto;padding:28px 16px">
    <div style="border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(20,38,63,.10)">
      <div style="background:linear-gradient(135deg,#1e3a5f,#14263f);padding:28px 22px 22px;text-align:center">
        <img src="${LOGO}" width="54" height="54" alt="Amor Consciente" style="display:block;margin:0 auto 10px;border:0">
        <div style="color:#fff;font-size:20px;font-weight:700;letter-spacing:.3px">Amor Consciente</div>
        <div style="color:#e3b23c;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;margin-top:4px">Evaluación del venue</div>
      </div>
      <div style="height:3px;background:linear-gradient(90deg,#b8860b,#e3b23c)"></div>
      <div style="background:#fffdf8;padding:26px 24px">
        <p style="margin:0 0 12px;font-size:15px">Hola ${esc(name||"")},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.55">Gracias por acompañarnos en <b>${esc(eventLabel||"el evento")}</b>. Nos ayudaría muchísimo tu evaluación del hotel <b style="color:#1e3a5f">${esc(venue||"")}</b> donde se realizó.</p>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.55">Es una encuesta corta —12 aspectos del 1 al 5— con un espacio para tus comentarios. Toma menos de 2 minutos.</p>
        <p style="text-align:center;margin:0 0 22px">
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#b8860b,#a9790a);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:15px 34px;border-radius:12px;box-shadow:0 2px 6px rgba(184,134,11,.35)">Completar evaluación</a>
        </p>
        <p style="margin:0;font-size:12px;color:#8a9199;border-top:1px solid #efe8da;padding-top:14px">Si el botón no funciona, copia y pega este enlace:<br><a href="${link}" style="color:#1e3a5f;word-break:break-all">${link}</a></p>
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

// Envía la encuesta de UN evento a su lista de destinatarios.
async function sendForEvent(dateId, { markSent = true } = {}){
  const ev = (await sget(`event_dates?id=eq.${enc(dateId)}&select=id,city_slug,label,end_date`))[0];
  if (!ev) return { dateId, sent:0, skipped:0, reason:"evento no encontrado" };

  const meta = (await sget(`date_meta?date_id=eq.${enc(dateId)}&select=chosen_venue`))[0];
  const venue = (meta && meta.chosen_venue || "").trim();
  if (!venue) return { dateId, label: ev.label, sent:0, skipped:0, reason:"sin venue elegido — define el hotel antes de enviar" };

  const recips = await sget(`event_recipients?date_id=eq.${enc(dateId)}&select=name,email,role`);
  const valid = (recips||[]).filter(r => validEmail(r.email));
  if (!valid.length) return { dateId, label: ev.label, sent:0, skipped:0, reason:"sin destinatarios con email válido" };

  let sent = 0, skipped = 0; const errors = [];
  for (const r of valid){
    const email = r.email.trim();
    try {
      // reutilizar token pendiente si existe (evita duplicar en re-envíos)
      let tok = (await sget(`survey_tokens?date_id=eq.${enc(dateId)}&recipient_email=eq.${enc(email)}&responded_at=is.null&select=token`))[0];
      let token = tok && tok.token;
      if (!token){
        token = randomUUID();
        await spost("survey_tokens", [{
          token, date_id: dateId, city_slug: ev.city_slug, event_label: ev.label,
          venue_name: venue, recipient_name: r.name || "", recipient_email: email, sent_at: new Date().toISOString()
        }]);
      } else {
        await spatch(`survey_tokens?token=eq.${enc(token)}`, { sent_at: new Date().toISOString() });
      }
      const link = `${BASE}/survey?t=${token}`;
      const em = await sendEmail({
        to: email,
        subject: `Tu evaluación del venue — ${ev.label}`,
        html: emailHtml({ name: r.name, eventLabel: ev.label, city: ev.city_slug, venue, link })
      });
      if (em.ok) sent++; else { skipped++; errors.push(email + ": " + em.err); }
    } catch(e){ skipped++; errors.push(email + ": " + String(e && e.message || e).slice(0,120)); }
  }
  if (markSent && sent > 0) { try { await spatch(`event_dates?id=eq.${enc(dateId)}`, { survey_sent_at: new Date().toISOString() }); } catch {} }
  return { dateId, label: ev.label, venue, sent, skipped, errors: errors.slice(0,10) };
}

function yesterdayISO(){
  const d = new Date(Date.now() - 24*3600*1000);
  return d.toISOString().slice(0,10);
}

module.exports = async function handler(req, res){
  if (req.method !== "POST" && req.method !== "GET"){ res.status(405).json({ error: "Método no permitido" }); return; }
  if (!svc()){ res.status(500).json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en Vercel." }); return; }
  if (!process.env.RESEND_API_KEY){ res.status(500).json({ error: "Falta RESEND_API_KEY en Vercel." }); return; }

  const authRaw = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const CRON = process.env.CRON_SECRET;
  const isCron = !!(CRON && authRaw === CRON);

  // --- Autorización ---
  if (!isCron){
    // modo manual: verificar usuario de Supabase + correo autorizado
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
      // eventos cuyo último día fue AYER y aún no se ha enviado
      const y = yesterdayISO();
      const due = await sget(`event_dates?end_date=eq.${y}&survey_sent_at=is.null&select=id`);
      const results = [];
      for (const e of (due||[])) results.push(await sendForEvent(e.id, { markSent: true }));
      res.status(200).json({ ok:true, mode:"cron", fecha:y, eventos: results.length, results });
      return;
    }
    // modo manual
    const body = await readBody(req);
    if (!body.date_id){ res.status(400).json({ error: "Falta date_id." }); return; }
    const result = await sendForEvent(body.date_id, { markSent: true });
    res.status(200).json({ ok:true, mode:"manual", ...result });
  } catch(e){
    res.status(500).json({ error: String(e && e.message || e).slice(0,300) });
  }
};
