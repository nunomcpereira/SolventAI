/**
 * Generic persistence contract every domain repository implements. Defined here (in
 * domain, not in lib/db) so the financial engine and domain layer never import
 * anything from the persistence implementation — only the reverse. A repository may
 * be backed by SQLite today and something else tomorrow without this contract, or any
 * domain/engine code, changing.
 */
export interface Repository<T, Id = string> {
  findById(id: Id): Promise<T | undefined>;
  list(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: Id): Promise<void>;
}
