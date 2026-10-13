const base = (process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1/").replace(/\/?$/, "/");
const key = process.env.NEBIUS_API_KEY?.trim();
const model = process.env.NEMOTRON_TRIAGE_MODEL?.trim() || "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";

if (!key) {
  console.log("DEMO_MODE: NEBIUS_API_KEY is not set. Skipping the live Nemotron call.");
  process.exit(0);
}

const response = await fetch(`${base}chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    temperature: 0.2,
    max_tokens: 800,
    messages: [{ role: "user", content: "Reply with the single word ready." }],
  }),
});

if (!response.ok) {
  console.error(`Nemotron call failed: ${response.status}`);
  process.exit(1);
}

const payload = await response.json();
const content = payload.choices?.[0]?.message?.content?.trim() ?? "";
if (!content) {
  console.error("Nemotron returned empty content.");
  process.exit(1);
}
console.log(`${model}: ${content.slice(0, 200)}`);
