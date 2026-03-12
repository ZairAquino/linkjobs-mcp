// LinkJobs MCP Server — Node.js puro, sin dependencias externas
import { createServer } from "node:http";
import { knowledge, buscarEnKnowledge } from "./knowledge.js";

const PORT = process.env.PORT || 3000;

const TOOLS = [
  { name: "linkjobs_resumen", description: "Devuelve un resumen ejecutivo completo del proyecto LinkJobs.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "linkjobs_empresa", description: "Información de la empresa: nombre, tagline, ubicación, website, estado del proyecto y equipo fundador.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "linkjobs_problema", description: "El problema que resuelve LinkJobs: datos del mercado laboral mexicano, costos ocultos para empresas.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "linkjobs_solucion", description: "La solución de LinkJobs: descripción de la plataforma, los 3 pilares y el posicionamiento.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "linkjobs_como_funciona", description: "El proceso completo de LinkJobs: las 4 fases del ciclo de talento, entregables por ciclo.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "linkjobs_precios", description: "Planes y precios de LinkJobs en MXN.", inputSchema: { type: "object", properties: { plan: { type: "string" } }, required: [] } },
  { name: "linkjobs_roi", description: "Análisis de ROI: ahorro vs empleado formal, retorno 46%-205%.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "linkjobs_mercado", description: "Datos del mercado: TAM/SAM/SOM, HR Tech México.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "linkjobs_testimonios", description: "Testimonios y social proof: KIGO, Padla Universitas.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "linkjobs_marketing", description: "Contenido de marketing: post LinkedIn, propuesta B2B/B2C.", inputSchema: { type: "object", properties: { tipo: { type: "string" } }, required: [] } },
  { name: "linkjobs_buscar", description: "Busca texto libre en toda la base de conocimiento de LinkJobs.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }
];

function ejecutarHerramienta(name, args = {}) {
  const k = knowledge;
  switch (name) {
    case "linkjobs_resumen": return JSON.stringify({ empresa: k.empresa, problema_resumen: k.problema.resumen, solucion_resumen: k.solucion.descripcion }, null, 2);
    case "linkjobs_empresa": return JSON.stringify(k.empresa, null, 2);
    case "linkjobs_problema": return JSON.stringify(k.problema, null, 2);
    case "linkjobs_solucion": return JSON.stringify(k.solucion, null, 2);
    case "linkjobs_como_funciona": return JSON.stringify(k.como_funciona, null, 2);
    case "linkjobs_precios": {
      if (!args.plan) return JSON.stringify(k.precios, null, 2);
      const p = args.plan.toLowerCase();
      const map = { starter: 0, growth: 1, scale: 2, enterprise: 3 };
      const idx = map[p];
      return idx !== undefined ? JSON.stringify(k.precios.planes_B2B_membresia.planes[idx], null, 2) : JSON.stringify(k.precios, null, 2);
    }
    case "linkjobs_roi": return JSON.stringify(k.roi, null, 2);
    case "linkjobs_mercado": return JSON.stringify(k.mercado, null, 2);
    case "linkjobs_testimonios": return JSON.stringify(k.testimonios, null, 2);
    case "linkjobs_marketing": return JSON.stringify(k.marketing, null, 2);
    case "linkjobs_buscar": {
      const resultados = buscarEnKnowledge(args.query || "");
      if (!resultados.length) return "No se encontraron resultados para: " + args.query;
      return resultados.map(r => r.ruta + ":\n" + r.fragmento).join("\n\n");
    }
    default: throw new Error("Herramienta desconocida: " + name);
  }
}

function handleJsonRpc(message) {
  const { id, method, params } = message;
  if (method === "initialize") return { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "linkjobs", version: "1.0.0" } } };
  if (method === "notifications/initialized") return null;
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  if (method === "tools/call") {
    try {
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: ejecutarHerramienta(params.name, params.arguments || {}) }] } };
    } catch (err) {
      return { jsonrpc: "2.0", id, error: { code: -32601, message: err.message } };
    }
  }
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Metodo no soportado: " + method } };
}

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost:" + PORT);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "LinkJobs MCP Server", version: "1.0.0", tools: TOOLS.length }));
    return;
  }
  if (url.pathname === "/mcp") {
    if (req.method === "GET") { res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }); res.write("data: {}\n\n"); req.on("close", () => res.end()); return; }
    if (req.method === "DELETE") { res.writeHead(200); res.end(JSON.stringify({ ok: true })); return; }
    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const msg = JSON.parse(body);
          const resp = handleJsonRpc(msg);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(resp === null ? { jsonrpc: "2.0", result: {} } : resp));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: "JSON invalido" })); }
      });
      return;
    }
  }
  res.writeHead(404); res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => console.log("LinkJobs MCP Server corriendo en puerto " + PORT));
