// src/lib/ai.ts
import { supabase } from "@/integrations/supabase/client";

type GenOptions = { system?: string; temperature?: number; maxTokens?: number };

export async function generateWithAI(prompt: string, opts: GenOptions = {}): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('improve-notes', {
      body: { notes: prompt }
    });

    if (error) {
      console.error('Error calling improve-notes:', error);
      throw new Error(error.message || 'Error al mejorar las notas');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data?.improvedNotes || '';
  } catch (error) {
    console.error('Error in generateWithAI:', error);
    throw error;
  }
}
