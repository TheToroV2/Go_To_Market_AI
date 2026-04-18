import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { config } from '../config/config';

let database: Database<sqlite3.Database, sqlite3.Statement> | null = null;

export async function getDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  if (!database) {
    database = await open({
      filename: config.databaseUrl.replace('sqlite:', ''),
      driver: sqlite3.Database,
    });
  }
  return database;
}

export const db = {
  query: async <T = any>(sql: string, params: any[] = []): Promise<{ rows: T[] }> => {
    const dbInstance = await getDb();
    const result = await dbInstance.all<T>(sql, ...params);
    return { rows: result as T[] };
  },
  end: async () => {
    if (database) {
      await database.close();
      database = null;
    }
  },
};