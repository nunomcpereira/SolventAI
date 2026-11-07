/**
 * Ordered, append-only migrations. Each entry's `sql` runs exactly once, tracked in
 * `schema_migrations`. Never edit a migration once it has shipped — add a new one.
 */
export interface Migration {
  id: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: "0001_init",
    sql: `
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        currency TEXT NOT NULL,
        initial_balance_minor_units TEXT NOT NULL,
        minimum_reserve_minor_units TEXT NOT NULL,
        active INTEGER NOT NULL
      );

      CREATE TABLE loans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        principal_minor_units TEXT NOT NULL,
        currency TEXT NOT NULL,
        start_date TEXT NOT NULL,
        number_of_periods INTEGER NOT NULL,
        payment_frequency TEXT NOT NULL,
        amortization_type TEXT NOT NULL,
        day_count_convention TEXT NOT NULL,
        rate_json TEXT NOT NULL,
        source_account_id TEXT NOT NULL,
        prepayment_penalty_json TEXT NOT NULL
      );

      CREATE TABLE loan_fees (
        id TEXT PRIMARY KEY,
        loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        amount_minor_units TEXT NOT NULL,
        currency TEXT NOT NULL,
        timing TEXT NOT NULL
      );

      CREATE TABLE incomes (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        amount_minor_units TEXT NOT NULL,
        currency TEXT NOT NULL,
        frequency TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        category TEXT NOT NULL,
        inflation_rule_json TEXT
      );

      CREATE TABLE expenses (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        amount_minor_units TEXT NOT NULL,
        currency TEXT NOT NULL,
        frequency TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        category TEXT NOT NULL,
        inflation_rule_json TEXT
      );

      CREATE TABLE exchange_rates (
        id TEXT PRIMARY KEY,
        from_currency TEXT NOT NULL,
        to_currency TEXT NOT NULL,
        rate TEXT NOT NULL,
        effective_date TEXT NOT NULL
      );

      CREATE TABLE settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        base_currency TEXT NOT NULL,
        rounding_mode TEXT NOT NULL,
        day_count_default TEXT NOT NULL,
        language TEXT NOT NULL,
        llm_endpoint TEXT NOT NULL,
        llm_enabled INTEGER NOT NULL,
        allow_cloud_llm_fallback INTEGER NOT NULL
      );
    `,
  },
  {
    id: "0002_contracts",
    sql: `
      CREATE TABLE contract_documents (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        uploaded_at TEXT NOT NULL,
        source_type TEXT NOT NULL,
        page_count INTEGER,
        status TEXT NOT NULL
      );

      CREATE TABLE contract_extractions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES contract_documents(id) ON DELETE CASCADE,
        extracted_at TEXT NOT NULL,
        fields_json TEXT NOT NULL
      );
    `,
  },
  {
    id: "0003_scenarios",
    sql: `
      CREATE TABLE scenarios (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        base_scenario_id TEXT,
        events_json TEXT NOT NULL
      );
    `,
  },
  {
    id: "0004_loan_contract_id",
    sql: `
      ALTER TABLE loans ADD COLUMN contract_document_id TEXT REFERENCES contract_documents(id) ON DELETE SET NULL;
    `,
  },
  {
    id: "0005_settings_type_labels",
    sql: `
      ALTER TABLE settings ADD COLUMN account_type_labels_json TEXT NOT NULL DEFAULT '{"checking":"Checking","savings":"Savings","emergency":"Emergency","investment":"Investment","other":"Other"}';
      ALTER TABLE settings ADD COLUMN loan_category_labels_json TEXT NOT NULL DEFAULT '{"mortgage":"Mortgage","auto":"Auto","personal":"Personal","consumer":"Consumer","student":"Student","other":"Other"}';
    `,
  },
  {
    id: "0006_settings_custom_categories",
    sql: `
      ALTER TABLE settings ADD COLUMN custom_loan_categories_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE settings ADD COLUMN custom_income_categories_json TEXT NOT NULL DEFAULT '[]';
    `,
  },
  {
    id: "0007_contract_chunk_progress",
    sql: `
      ALTER TABLE contract_documents ADD COLUMN chunk_total INTEGER;
      ALTER TABLE contract_documents ADD COLUMN chunk_done INTEGER;
      ALTER TABLE contract_documents ADD COLUMN chunk_label TEXT;
    `,
  },
  {
    id: "0008_contract_partial_fields",
    sql: `
      ALTER TABLE contract_documents ADD COLUMN partial_fields_json TEXT;
      ALTER TABLE contract_documents ADD COLUMN error TEXT;
    `,
  },
  {
    id: "0009_account_is_default",
    sql: `
      ALTER TABLE accounts ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    id: "0010_entity_history",
    sql: `
      CREATE TABLE entity_history (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        change_type TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        snapshot_json TEXT NOT NULL
      );

      CREATE INDEX idx_entity_history_lookup ON entity_history(entity_type, entity_id, recorded_at);
    `,
  },
  {
    id: "0011_contract_source_and_progress",
    sql: `
      ALTER TABLE contract_documents ADD COLUMN progress_at TEXT;
      ALTER TABLE contract_documents ADD COLUMN content_hash TEXT;
      ALTER TABLE contract_documents ADD COLUMN source_text TEXT;
      ALTER TABLE contract_documents ADD COLUMN source_pages_json TEXT;

      CREATE INDEX idx_contract_documents_hash ON contract_documents(content_hash);
    `,
  },
];

