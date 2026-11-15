/**
 * Turning raw bank-statement descriptions into stable merchant keys and first-guess
 * categories. Rules are tuned for Portuguese bank exports (CGD et al.): descriptions are
 * truncated to ~20 characters, carry transaction prefixes ("COMPRA", "DD", "TRF"),
 * masked phone numbers (MB WAY), legal suffixes ("S A", "LDA") and inconsistent
 * punctuation ("BOLT.EU O" vs "BOLT.EUO").
 */

/** Same category values as domain/expenses EXPENSE_CATEGORIES (the engine doesn't import domain). */
export type GuessedExpenseCategory =
  | "housing"
  | "utilities"
  | "food"
  | "transport"
  | "insurance"
  | "healthcare"
  | "government"
  | "subscriptions"
  | "discretionary"
  | "other";

/** Same values as domain/income INCOME_CATEGORIES. */
export type GuessedIncomeCategory = "salary" | "rent" | "bonus" | "pension" | "freelance" | "investment" | "government" | "other";

/** Upper-case, accents stripped, whitespace collapsed. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokens that say how the money moved, not who it went to. */
const NOISE_TOKENS = new Set(["COMPRA", "DD", "TRF", "PAG", "PAGAMENTO", "SA", "LDA", "LTD", "LIMITED", "UNIP", "UNIPESSOAL", "SL", "CC"]);

/**
 * A grouping key for "the same counterparty": punctuation and spaces removed (so
 * "BOLT.EU O" == "BOLT.EUO" and "ALIEXPRESS.COM" == "ALIEXPRESSCOM"), digits dropped
 * (references, dates) except masked phone numbers ("912XXX001" identifies an MB WAY
 * recipient), transaction/legal noise dropped ("PETROGAL S A" == "PETROGAL").
 */
export function merchantKey(description: string): string {
  const tokens = normalizeText(description)
    .replace(/\bS\s*\.?\s*A\b\.?/g, " ")
    .split(/[^A-Z0-9]+/)
    .map((token) => (/^\d+X+\d+$/.test(token) ? token : token.replace(/\d+/g, "")))
    .filter((token) => token.length > 0 && !NOISE_TOKENS.has(token));
  const key = tokens.join("");
  return key || normalizeText(description).replace(/[^A-Z0-9]/g, "") || "?";
}

/** The most frequent original spelling, cleaned up for display. */
export function displayLabel(descriptions: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const d of descriptions) {
    const clean = d.replace(/\s+/g, " ").trim();
    counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  let best = "";
  let bestCount = -1;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

/** Ordered keyword rules: the first matching pattern wins. Matched against normalizeText(description). */
const EXPENSE_RULES: readonly [RegExp, GuessedExpenseCategory][] = [
  [/\bATM\b|LEVANTAMENTO/, "discretionary"],
  [/PRESTACAO|EMPRESTIMO|CREDITO HAB/, "housing"],
  [/CONDOMINIO|RENDA |LEROY MERLIN|IKEA|BRICOLAGE|\bAKI\b|MAXMAT|WORTEN/, "housing"],
  [/\bEDP\b|GALP ENERGIA|GOLD ENERGY|ENDESA|IBERDROLA|REPSOL ELEC|\bGAS\b|AGUAS|\bAGUA\b|SMAS|INDAQUA|SIMAR/, "utilities"],
  [/\bNOS\b|\bMEO\b|VODAFONE|NOWO|\bDIGI\b|ALTICE|TELECOM/, "utilities"],
  [/NETFLIX|SPOTIFY|DISNEY|\bHBO\b|MAX\.COM|PRIME VIDEO|AMAZON PRIME|APPLE\.COM|ICLOUD|GOOGLE|YOUTUBE|MICROSOFT|ADOBE|OPENAI|ANTHROPIC|CLAUDE|PATREON|GYM|GINASIO|FITNESS|SOLINCA/, "subscriptions"],
  [/SEGURO|FIDELIDADE|TRANQUILIDADE|GENERALI|ALLIANZ|AGEAS|LIBERTY|ZURICH|MAPFRE|PREVOIR|LOGO SEG|\bOK TELESEG|SQUARETRADE|MEDIS|MULTICARE|ADVANCECARE/, "insurance"],
  [/FARMACIA|SAUDE|CLINICA|HOSPITAL|\bCUF\b|LUSIADAS|DENTAL|DENTIST|OPTICA|LABORATORIO|MEDIC/, "healthcare"],
  [/PAG-ESTADO|PAG ESTADO|FINANCAS|AUTORIDADE TRIBUT|SEG SOCIAL|SEGURANCA SOCIAL|\bIMI\b|\bIUC\b|CAMARA MUN|MUNICIPIO|FREGUESIA/, "government"],
  [/CONTINENTE|PINGO DOCE|\bLIDL\b|\bALDI\b|MINIPRECO|INTERMARCHE|MERCADONA|AUCHAN|JUMBO|\bDIA\b|SUPERMERC|HIPERMERC|CARNES|TALHO|PADARIA|PASTELARIA|FRUTARIA|MERCEARIA|GLOVO|UBER ?EATS|BOLT FOOD|RESTAURANTE|CAFE|SNACK|MCDONALD|BURGER|PIZZA|TELEPIZZA|SUSHI|QUIOSQUE/, "food"],
  [/VIA VERDE|PETROGAL|\bGALP\b|REPSOL|\bBP\b|CEPSA|\bPRIO\b|\bUBER\b|\bBOLT\b|\bCP\b|COMBOIOS|METRO|\bSTCP\b|CARRIS|PARQUE|PARKING|EMEL|BRISA|PORTAGEM|ESTACIONAMENTO|POSTO|PNEU|OFICINA/, "transport"],
];

/** The bank's own category labels, as a fallback when no keyword rule matches. */
const BANK_CATEGORY_RULES: readonly [RegExp, GuessedExpenseCategory][] = [
  [/GAS|ELETRICIDADE|ELECTRICIDADE|AGUA|TELE|TV|INTERNET/, "utilities"],
  [/SEGURO/, "insurance"],
  [/CAMARA|MUNICIPIO|ESTADO|IMPOSTO/, "government"],
  [/SAUDE|FARMACIA/, "healthcare"],
  [/ENSINO|EDUCACAO/, "other"],
  [/COMPRAS|LEVANTAMENTO/, "discretionary"],
];

export function guessExpenseCategory(description: string, bankCategory?: string): GuessedExpenseCategory {
  const text = normalizeText(description);
  for (const [pattern, category] of EXPENSE_RULES) if (pattern.test(text)) return category;
  if (bankCategory) {
    const bank = normalizeText(bankCategory);
    for (const [pattern, category] of BANK_CATEGORY_RULES) if (pattern.test(bank)) return category;
  }
  return "other";
}

export function guessIncomeCategory(description: string): GuessedIncomeCategory | undefined {
  const text = normalizeText(description);
  if (/SALARIO|VENCIMENTO|ORDENADO|REMUNERAC/.test(text)) return "salary";
  if (/PENSAO|REFORMA|\bCGA\b|CENTRO NACIONAL DE PENS/.test(text)) return "pension";
  if (/SEG SOCIAL|SEGURANCA SOCIAL|\bIRS\b|REEMBOLSO AT|AUTORIDADE TRIBUT|FINANCAS/.test(text)) return "government";
  if (/RENDA|ARRENDAMENTO/.test(text)) return "rent";
  if (/JUROS|DIVIDEND|RENDIMENTO/.test(text)) return "investment";
  return undefined;
}

export function looksLikeLoanPayment(description: string): boolean {
  return /PRESTACAO|EMPRESTIMO|CREDITO HAB|AMORTIZ/.test(normalizeText(description));
}

/** Descriptions that usually mean money moved to another of the holder's own accounts. */
export function looksLikeOwnTransfer(description: string): boolean {
  return /POUP|CAIXAPOUP|POUPANCA|DEPOSITO A PRAZO|\bDP\b|REVOLUT|ACTIVOBANK|ACTIVO BANK|MOEY|N26|WISE|TRADE REPUBLIC|XTB|DEGIRO|CXDAPP|TRANSFERENCIA INICIA|AG GEST TESOURARIA|\bIGCP\b|AFORRO|CERTIFICADOS DO TESOURO/.test(
    normalizeText(description),
  );
}

/** Descriptions that mean savings specifically (so the target is a savings account). */
export function looksLikeSavings(description: string): boolean {
  return /POUP|POUPANCA|DEPOSITO A PRAZO/.test(normalizeText(description));
}
