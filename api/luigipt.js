// ============================================================
//  LuigiPT — backend serverless (Vercel) · Google Gemini
//  - Verifica sesión de Supabase + correo autorizado
//  - action "chat": responde preguntas abiertas con el contexto del proyecto
//  - action "doc":  lee un documento (PDF/imagen) y extrae datos clave
//  La clave se lee de la variable de entorno GEMINI_API_KEY (en Vercel).
// ============================================================

const SUPA_URL  = "https://dwhwbcplgcqvuvnzqmne.supabase.co";
const SUPA_ANON = "sb_publishable_t_vSbY1M8moq_BSNWKl5FA_5uSubgxa";
const ALLOWED   = ["global@amorconsciente.com", "noris@amorconsciente.com"];
const MODELS    = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest"];

function readBody(req){
  return new Promise((resolve) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 8e6) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

async function gemini(key, parts){
  let lastErr = "";
  for (const m of MODELS){
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.3, maxOutputTokens: 1024 } })
      });
      if (r.ok){
        const j = await r.json();
        return (j.candidates && j.candidates[0] && j.candidates[0].content &&
                j.candidates[0].content.parts && j.candidates[0].content.parts[0] &&
                j.candidates[0].content.parts[0].text) || "";
      }
      lastErr = (await r.text()).slice(0, 300);
    } catch (e) { lastErr = String(e && e.message || e); }
  }
  throw new Error(lastErr || "Gemini no respondió");
}

module.exports = async function handler(req, res){
  if (req.method !== "POST"){ res.status(405).json({ error: "Usa POST" }); return; }

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY){ res.status(500).json({ error: "Falta GEMINI_API_KEY en Vercel (Settings → Environment Variables)." }); return; }

  // --- Verificar sesión de Supabase + correo autorizado ---
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token){ res.status(401).json({ error: "Sin sesión." }); return; }
  let email = "";
  try {
    const u = await fetch(SUPA_URL + "/auth/v1/user", { headers: { apikey: SUPA_ANON, Authorization: "Bearer " + token } });
    if (!u.ok){ res.status(401).json({ error: "Sesión inválida." }); return; }
    const uj = await u.json();
    email = (uj.email || "").toLowerCase();
  } catch { res.status(401).json({ error: "No pude verificar la sesión." }); return; }
  if (!ALLOWED.includes(email)){ res.status(403).json({ error: "Correo no autorizado." }); return; }

  const body = await readBody(req);

  try {
    if (body.action === "chat"){
      const ctx = JSON.stringify(body.context || {}).slice(0, 14000);
      const prompt =
        `Eres LuigiPT, el asistente del proyecto "Amor Consciente — Venues" (sourcing de salones para eventos de 100–250 personas en 8 ciudades de EE.UU.). ` +
        `Responde en español, claro y breve, usando SOLO el CONTEXTO. Si la respuesta no está en el contexto, dilo y sugiere qué dato falta. ` +
        `Puedes hacer cálculos simples (sumas de montos pendientes, saldos, conteos).\n\n` +
        `CONTEXTO (JSON):\n${ctx}\n\nPREGUNTA DEL USUARIO: ${body.question || ""}`;
      const text = await gemini(KEY, [{ text: prompt }]);
      res.status(200).json({ text: text || "No encontré esa información en el proyecto." });
      return;
    }

    if (body.action === "doc"){
      if (!body.data){ res.status(400).json({ error: "Falta el archivo." }); return; }
      const instr =
        `Eres LuigiPT. Analiza este documento de un proyecto de eventos (contrato, recibo, factura, cotización o diagrama). ` +
        `Devuelve EXCLUSIVAMENTE un JSON válido (sin texto extra, sin markdown) con estas claves exactas: ` +
        `{"tipo":"contrato|recibo|factura|cotizacion|diagrama|otro","titulo":"","proveedor_o_venue":"","ciudad":"","fecha":"YYYY-MM-DD o vacío","monto_total":number o null,"moneda":"USD u otra","monto_pendiente":number o null,"saldo_a_favor":number o null,"vencimiento":"YYYY-MM-DD o vacío","resumen":"2-3 frases en español","sugerencia_guardado":"dónde archivarlo"}. ` +
        `Si un dato no aparece, usa "" o null. Los montos como número sin símbolos.`;
      const parts = [{ text: instr }, { inline_data: { mime_type: body.mimeType || "application/octet-stream", data: body.data } }];
      let text = await gemini(KEY, parts);
      text = String(text).replace(/```json/gi, "").replace(/```/g, "").trim();
      let parsed = null;
      try { parsed = JSON.parse(text); }
      catch { const m = text.match(/\{[\s\S]*\}/); if (m){ try { parsed = JSON.parse(m[0]); } catch {} } }
      res.status(200).json({ data: parsed, raw: text });
      return;
    }

    res.status(400).json({ error: "Acción desconocida." });
  } catch (e){
    res.status(500).json({ error: String(e && e.message || e).slice(0, 300) });
  }
};
