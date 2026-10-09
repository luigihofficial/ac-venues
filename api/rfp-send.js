// ============================================================
//  Envío de RFP (solicitud de cotización) a vendors (Vercel serverless)
//  Solo usuario autorizado (JWT de Supabase). Envía un correo INDIVIDUAL
//  a cada vendor seleccionado (no se ven entre sí), con reply-to al equipo
//  y CCO al equipo en la primera copia. Registra cada envío en rfp_log
//  (best-effort). El cuerpo (subject/html) lo arma el cliente para que la
//  vista previa sea exactamente lo que se envía; el remitente/reply-to/CCO
//  los controla el servidor.
//  Variables de entorno: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
//   SURVEY_FROM / RFP_FROM (opcional), RFP_REPLYTO (opcional), RFP_BCC (opcional).
// ============================================================

const SUPA_URL  = "https://dwhwbcplgcqvuvnzqmne.supabase.co";
const SUPA_ANON = "sb_publishable_t_vSbY1M8moq_BSNWKl5FA_5uSubgxa";
const ALLOWED   = ["global@amorconsciente.com", "noris@amorconsciente.com"];

const FROM    = process.env.RFP_FROM    || process.env.SURVEY_FROM || "Amor Consciente — Venues <onboarding@resend.dev>";
const REPLYTO = process.env.RFP_REPLYTO || "global@amorconsciente.com";
const TEAM_BCC = (process.env.RFP_BCC || "global@amorconsciente.com,noris@amorconsciente.com")
  .split(",").map(s => s.trim()).filter(Boolean);

function readBody(req){
  return new Promise((resolve) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let d = ""; req.on("data", c => { d += c; if (d.length > 2e6) req.destroy(); });
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}
function svc(){ return process.env.SUPABASE_SERVICE_ROLE_KEY; }
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e||"").trim());

async function sendEmail({ to, subject, html, bcc }){
  const payload = { from: FROM, to: [to], reply_to: REPLYTO, subject, html };
  if (bcc && bcc.length) payload.bcc = bcc;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const j = await r.json().catch(()=> ({}));
  if (!r.ok) return { ok:false, err: (j && (j.message||JSON.stringify(j))) || ("HTTP "+r.status) };
  return { ok:true, id: j.id };
}

async function logSend(rows){
  // best-effort: si la tabla rfp_log no existe aún, no rompe el envío
  try{
    if(!svc() || !rows.length) return;
    await fetch(SUPA_URL + "/rest/v1/rfp_log", {
      method: "POST",
      headers: { apikey: svc(), Authorization: "Bearer " + svc(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(rows)
    });
  }catch(e){ /* silencioso */ }
}

module.exports = async function handler(req, res){
  if (req.method !== "POST"){ res.status(405).json({ error: "Método no permitido" }); return; }
  if (!process.env.RESEND_API_KEY){ res.status(500).json({ error: "Falta RESEND_API_KEY en Vercel." }); return; }

  const authRaw = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!authRaw){ res.status(401).json({ error: "Sin sesión." }); return; }
  let email = "";
  try {
    const u = await fetch(SUPA_URL + "/auth/v1/user", { headers: { apikey: SUPA_ANON, Authorization: "Bearer " + authRaw } });
    if (!u.ok){ res.status(401).json({ error: "Sesión inválida." }); return; }
    email = ((await u.json()).email || "").toLowerCase();
  } catch { res.status(401).json({ error: "No pude verificar la sesión." }); return; }
  if (!ALLOWED.includes(email)){ res.status(403).json({ error: "Correo no autorizado." }); return; }

  try {
    const body = await readBody(req);
    const subject = String(body.subject || "").trim();
    const html = String(body.html || "");
    const meta = body.meta || {};
    const recipients = Array.isArray(body.recipients) ? body.recipients : [];
    if (!subject || !html){ res.status(400).json({ error: "Falta el asunto o el contenido del correo." }); return; }
    const valid = recipients.filter(r => validEmail(r && r.email));
    if (!valid.length){ res.status(400).json({ error: "No hay destinatarios con email válido." }); return; }

    let sent = 0, skipped = 0; const errors = []; const logRows = []; let bccPending = true;
    const nowIso = new Date().toISOString();
    for (const r of valid){
      const em = await sendEmail({ to: String(r.email).trim(), subject, html, bcc: bccPending ? TEAM_BCC : undefined });
      if (em.ok){
        sent++; bccPending = false;
        logRows.push({
          date_id: meta.date_id || null, city_slug: meta.city_slug || null,
          to_email: String(r.email).trim(), to_name: r.name || "", venue: r.venue || "",
          subject, lang: meta.lang || "", sent_by: email, sent_at: nowIso
        });
      } else { skipped++; errors.push((r.email) + ": " + em.err); }
    }
    await logSend(logRows);
    res.status(200).json({ ok: true, sent, skipped, total: valid.length, errors: errors.slice(0, 20) });
  } catch(e){
    res.status(500).json({ error: String(e && e.message || e).slice(0, 300) });
  }
};
