import type { DatabaseSync, SQLInputValue } from 'node:sqlite';

/** Run the real queries against SQLite; adapt only D1's transport and result format. */
export function sqliteD1(sql: DatabaseSync): D1Database {
  return {
    prepare(query: string) {
      const statement = sql.prepare(query);
      function bound(values: SQLInputValue[] = []) {
        return {
          bind: (...next: SQLInputValue[]) => bound(next),
          first: async () => statement.get(...values) ?? null,
          all: async () => ({ results: statement.all(...values), success: true }),
          raw: async () => {
            statement.setReturnArrays(true);
            try { return statement.all(...values); }
            finally { statement.setReturnArrays(false); }
          },
          run: async () => ({ success: true, meta: { changes: Number(statement.run(...values).changes) } }),
        };
      }
      return bound();
    },
  } as unknown as D1Database;
}
