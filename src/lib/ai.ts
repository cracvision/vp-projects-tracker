// src/lib/ai.ts
type GenOptions = { system?: string; temperature?: number; maxTokens?: number };

export async function generateWithAI(prompt: string, opts: GenOptions = {}): Promise<string> {
  try {
    const ai = (window as any)?.lovable?.ai;
    const system = opts.system ?? "Eres un redactor técnico senior. Escribe en español neutro, claro y profesional. Corrige errores tipográficos y mejora la cohesión. Usa viñetas si conviene, títulos cortos y listas ordenadas. Mantén los números y hechos tal como aparecen.";
    const temperature = opts.temperature ?? 0.3;

    if (ai?.generate) {
      const res = await ai.generate({
        model: "google/gemini-2.5-flash",
        system,
        prompt,
        temperature,
        maxTokens: opts.maxTokens ?? 1200,
      });
      const text = (res as any)?.text ?? "";
      return String(text || "").trim();
    }
  } catch (_e) {}
  return ""; // fallback: sin texto si no hay IA
}
