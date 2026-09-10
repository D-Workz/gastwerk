/**
 * Explicit schema/catalog migration through migrate. Owns a transaction and a
 * shared migration lock; importing db.ts initializes the environment and pool.
 */
import { productSchema } from "../../../../packages/contracts/src/index";
import { pool, transaction } from "./db";

/**
 * Run initial IF NOT EXISTS DDL on every invocation, then apply migration 2 only
 * if its marker is missing. Schema/catalog writes and markers share a transaction.
 * This lock coordinates migrate invocations; normal services do not take it.
 */
export async function migrate() {
  await transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(812731)");
    await tx.query(`
CREATE TABLE IF NOT EXISTS migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users(id text PRIMARY KEY,username text UNIQUE NOT NULL,password text NOT NULL,role text NOT NULL CHECK(role IN ('manager','waiter','kitchen','bar')),preferences jsonb NOT NULL,active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS sessions(token text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS catalog(kind text NOT NULL CHECK(kind IN ('ingredient','product','table')),id text NOT NULL,data jsonb NOT NULL,version integer NOT NULL DEFAULT 1,PRIMARY KEY(kind,id));
CREATE UNIQUE INDEX IF NOT EXISTS table_number_unique ON catalog ((data->>'number')) WHERE kind='table';
CREATE TABLE IF NOT EXISTS configuration(id integer PRIMARY KEY CHECK(id=1),data jsonb NOT NULL,version integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders(id text PRIMARY KEY,table_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),closed_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_order ON orders(table_id) WHERE closed_at IS NULL;
CREATE TABLE IF NOT EXISTS lines(id text PRIMARY KEY,order_id text NOT NULL REFERENCES orders(id),version integer NOT NULL DEFAULT 1,state text NOT NULL CHECK(state IN ('draft','submitted','preparing','ready','served','cancelled')),input jsonb NOT NULL,snapshot jsonb NOT NULL,created_by text NOT NULL REFERENCES users(id),changed_by text NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),reason text,replacement_of text REFERENCES lines(id));
CREATE TABLE IF NOT EXISTS movements(id text PRIMARY KEY,ingredient_id text NOT NULL,quantity numeric(24,3) NOT NULL CHECK(quantity<>0),kind text NOT NULL CHECK(kind IN ('opening','delivery','consumption','correction')),reason text NOT NULL,actor text NOT NULL REFERENCES users(id),at timestamptz NOT NULL DEFAULT now(),line_id text REFERENCES lines(id));
CREATE UNIQUE INDEX IF NOT EXISTS one_consumption ON movements(line_id,ingredient_id) WHERE kind='consumption';
CREATE TABLE IF NOT EXISTS history(id text PRIMARY KEY,line_id text REFERENCES lines(id),actor text NOT NULL REFERENCES users(id),action text NOT NULL,at timestamptz NOT NULL DEFAULT now(),detail jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS requests(actor text NOT NULL REFERENCES users(id),key text NOT NULL,fingerprint text NOT NULL,response jsonb NOT NULL,PRIMARY KEY(actor,key));
INSERT INTO migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
`);
    const applied = await tx.query(
      "SELECT version FROM migrations WHERE version=2",
    );
    if (!applied.rowCount) {
      // Add missing size arrays to catalog products; this migration does not write
      // line snapshots. Later line-edit operations may replace those snapshots.
      await tx.query(
        "UPDATE catalog SET data=jsonb_set(data, '{sizes}', '[]'::jsonb),version=version+1 WHERE kind='product' AND NOT (data ? 'sizes')",
      );
      const legacy = (
        await tx.query<{ data: unknown }>(
          "SELECT data FROM catalog WHERE kind='product' AND id='apple'",
        )
      ).rows[0];
      if (legacy) {
        const product = productSchema.parse(legacy.data);
        const names: Record<
          string,
          {
            before: { de: string; en: string };
            after: { de: string; en: string };
          }
        > = {
          pure: {
            before: { de: "Pur", en: "Pure" },
            after: { de: "Pur", en: "Pure juice" },
          },
          still: {
            before: { de: "Mit stillem Wasser", en: "With still water" },
            after: { de: "Still", en: "Still water" },
          },
          sparkling: {
            before: { de: "Gespritzt", en: "Sparkling" },
            after: { de: "Sprudel", en: "Sparkling" },
          },
        };
        let changed = false;
        for (const group of product.groups) {
          if (group.id !== "style") continue;
          for (const choice of group.choices) {
            const rename = names[choice.id];
            if (
              rename &&
              choice.name.de === rename.before.de &&
              choice.name.en === rename.before.en
            ) {
              choice.name = rename.after;
              changed = true;
            }
          }
        }
        // Rename only labels that still match both legacy translations.
        if (changed)
          await tx.query(
            "UPDATE catalog SET data=$1,version=version+1 WHERE kind='product' AND id='apple'",
            [product],
          );
      }
      await tx.query("INSERT INTO migrations(version) VALUES(2)");
    }
  });
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  await migrate();
  await pool.end();
}
