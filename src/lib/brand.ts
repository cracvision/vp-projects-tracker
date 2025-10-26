// src/lib/brand.ts
export const BRAND_LOGO_URL =
  "https://static.wixstatic.com/media/86b1c8_5b83096c35e8498db5dc4b56b0108526~mv2.png";

export async function fetchAsDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
  } catch {
    // Fallback: si falla CORS, deja el URL directo (algunas veces funciona)
    return url;
  }
}
