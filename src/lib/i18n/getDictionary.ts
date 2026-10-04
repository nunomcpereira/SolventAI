import "server-only";
import en from "./dictionaries/en.json" with { type: "json" };
import pt from "./dictionaries/pt.json" with { type: "json" };
import es from "./dictionaries/es.json" with { type: "json" };
import de from "./dictionaries/de.json" with { type: "json" };
import fr from "./dictionaries/fr.json" with { type: "json" };
import { type Language } from "../../domain/settings/settings.js";

export type Dictionary = typeof en;

const dictionaries: Record<Language, Dictionary> = { en, pt, es, de, fr };

export function getDictionary(lang: Language): Dictionary {
  return dictionaries[lang];
}
