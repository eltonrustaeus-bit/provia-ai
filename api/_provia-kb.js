// api/_provia-kb.js
// Public Provia knowledge for EX1.0. Facts come from central product rules.
import { buildPublicProviaKnowledge } from "./_provia-rules.js";

export const PROVIA_KB = buildPublicProviaKnowledge();

export const SALES_TRIGGER_REGEX =
  /uppgradera|premium|basic|pris|kostar|betala|värt|varför provia|varför ska jag|ska jag köpa|bättre än|jämfört med|vad kostar|vad ingår|vad får jag|membersh|plan|abonnemang|prenumeration|gratis räcker|räcker gratis|hinna|limit|gräns|hur många|chatgpt|chat gpt|gpt-?[0-9]?o?|gemini|copilot|openai|öppen ai|generell.{0,6}ai|annan.{0,6}ai|ai.{0,8}istäl|jämföra med|skillnad mot|google.{0,6}det/i;

export const SUPPORT_TRIGGER_REGEX =
  /avsluta|avbryta|avslutar|avlustar|cancel|säga upp|säg upp|konto|logga ut|byta plan|hantera|portal|stripe|prenumeration|abonnemang|faktura|betalning|kort|support|hjälp med konto|kommer inte in|inlogg|login|glömt|lösenord/i;
