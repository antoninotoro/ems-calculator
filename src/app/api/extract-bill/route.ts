import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY non configurata" },
      { status: 500 }
    );
  }

  let rawText: string;
  try {
    const body = await request.json();
    rawText = body.rawText;
  } catch {
    return NextResponse.json(
      { error: "Body JSON invalido" },
      { status: 400 }
    );
  }

  if (!rawText || typeof rawText !== "string") {
    return NextResponse.json(
      { error: "rawText mancante o invalido" },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey });
  const truncatedText = rawText.substring(0, 15000);

  const systemPrompt = `Sei un esperto di bollette energetiche italiane. Analizza il testo grezzo estratto da un PDF di una bolletta elettrica e estrai i dati strutturati.

REGOLE IMPORTANTI:
- I consumi F1, F2, F3 sono in kWh e rappresentano le fasce orarie italiane
- F1 = fascia di punta (lun-ven 8-19), F2 = intermedia, F3 = fuori punta
- Se la bolletta contiene una tabella storico consumi con piu mesi, SOMMA i valori di tutti i mesi per ottenere il totale. Se copre meno di 12 mesi, ANNUALIZZA proporzionalmente (moltiplica per 12/mesi_coperti)
- Il totale deve essere coerente: totalConsumption = f1 + f2 + f3 (dopo annualizzazione)
- I numeri italiani usano il punto come separatore migliaia e la virgola come decimale (es. 12.345 = dodicimilatrecentoquarantacinque, 1.234,56 = milleduecentotrentaquattro virgola cinquantasei)
- Il POD italiano inizia sempre con IT001E
- Il prezzo medio e in euro/kWh (tipicamente tra 0.15 e 0.45)
- La potenza impegnata e in kW
- Estrai la citta e la provincia dall'indirizzo di fornitura/punto di prelievo. Se ci sono piu indirizzi, usa quello del punto di fornitura (non l'indirizzo di fatturazione)
- Se non riesci a determinare un valore con certezza, usa null

Rispondi SOLO con un oggetto JSON valido, senza markdown, senza spiegazioni, senza commenti.`;

  const userPrompt = `Estrai i seguenti dati dalla bolletta elettrica italiana. Se un campo non e trovabile nel testo, usa null.

Campi richiesti (JSON):
{
  "ragioneSociale": "nome del cliente/azienda intestatario",
  "podCode": "codice POD (formato IT001E...)",
  "supplier": "nome fornitore energia (es. Enel, Sorgenia, Eni, A2A, Edison)",
  "potenzaImpegnata": numero_kW,
  "potenzaDisponibile": numero_kW,
  "f1": consumo_F1_annualizzato_kWh,
  "f2": consumo_F2_annualizzato_kWh,
  "f3": consumo_F3_annualizzato_kWh,
  "totalConsumption": consumo_totale_annuale_kWh,
  "billingMonths": numero_mesi_coperti_dalla_bolletta,
  "prezzoMedio": prezzo_medio_euro_per_kWh,
  "city": "citta del punto di fornitura",
  "province": "sigla provincia (es. MI, RM, NA)"
}

TESTO BOLLETTA:
${truncatedText}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((c) => c.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Nessuna risposta testuale dal modello");
    }

    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const data = JSON.parse(jsonStr);

    if (typeof data.f1 !== "number") data.f1 = 0;
    if (typeof data.f2 !== "number") data.f2 = 0;
    if (typeof data.f3 !== "number") data.f3 = 0;
    if (!data.totalConsumption || typeof data.totalConsumption !== "number") {
      data.totalConsumption = data.f1 + data.f2 + data.f3;
    }
    if (!data.billingMonths || data.billingMonths < 1) {
      data.billingMonths = 1;
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[extract-bill] Errore LLM:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Errore estrazione LLM",
      },
      { status: 500 }
    );
  }
}
