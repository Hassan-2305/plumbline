// Local mock of the Gemini REST API for testing failure handling.
// Usage: node scripts/mock-gemini.mjs  (port 3999). POST /mode with body: ok|fakeids|badjson|ratelimit|down
import http from "node:http";

let mode = "ok";
let lastBody = "";
const findings = (ids) => ({
  findings: [
    {
      juror: "Risk & Compliance", severity: "high", category: "clinical_claim",
      title: "Unsupported clinical claim", offending_text: "clinically proven",
      explanation: "No approved fact supports this.", evidence: [{ type: "guideline", id: ids[0] }, { type: "no_fact" }],
      suggested_fix: "Remove it.", replacement: "made with plant-based protein", confidence: 0.9,
    },
    {
      juror: "Brand Guardian", severity: "low", category: "tone", title: "Invented quote",
      offending_text: "this text is not in the draft", explanation: "Should be dropped.", evidence: [{ type: "guideline", id: "R-001" }],
      suggested_fix: "-", confidence: 0.5,
    },
    {
      juror: "Fact-Checker", severity: "medium", category: "unsupported_claim", title: "Cites missing fact",
      offending_text: "Each scoop", explanation: "Cites a fact ID that does not exist.", evidence: [{ type: "approved_fact", id: ids[1] }],
      suggested_fix: "-", confidence: 0.4,
    },
  ],
});

http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.url === "/mode") { mode = body.trim(); res.end(mode); return; }
    // Test hook: returns the last generateContent body, to verify redaction.
    if (req.url === "/last") { res.end(lastBody); return; }
    if (req.method === "POST") lastBody = body;
    if (mode === "down") { res.writeHead(503); res.end("unavailable"); return; }
    if (mode === "ratelimit") { res.writeHead(429); res.end("quota"); return; }
    if (req.method === "GET") { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
    if (body.includes("enforceable brand guidelines")) {
      const rules = {
        rules: [
          { title: "Captions", rule: "Every video must include captions.", quote: "All videos must include captions.", role: "accessibility" },
          { title: "Invented", rule: "Always mention our awards.", quote: "We have won many awards.", role: "none" },
        ],
      };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(rules) }] } }] }));
      return;
    }
    if (body.includes("GUIDELINE CONFLICTS")) {
      const conflicts = {
        conflicts: [
          { rule_a: "R-002", rule_b: "R-001", why: "Confident voice can drift into superlatives.", example_context: "\"The most delicious shake\"", proposed_clarification: "Be confident using specific approved facts, never unsupported superlatives.", target_rule: "R-002", confidence: 0.6 },
          { rule_a: "R-001", rule_b: "R-999", why: "Invented rule — must be dropped.", example_context: "-", proposed_clarification: "-", target_rule: "R-999", confidence: 0.9 },
        ],
      };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: mode === "badjson" ? "{oops" : JSON.stringify(conflicts) }] } }] }));
      return;
    }
    const text = mode === "badjson" ? "{not json" : JSON.stringify(findings(mode === "fakeids" ? ["R-999", "F-999"] : ["R-005", "F-999"]));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));
  });
}).listen(3999, () => console.log("mock gemini on :3999"));
