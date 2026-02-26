import { FastifyInstance } from "fastify";
import { getDatabase } from "../db/database.js";

export default async function schemaRoute(fastify: FastifyInstance) {
  fastify.get("/", async (request, reply) => {
    const db = await getDatabase();
    try {
      const rows = (await db.all(
        "SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name"
      )) as { sql: string }[];
      return { schema: rows.map((r) => r.sql + ";").join("\n") };
    } finally {
      await db.close();
    }
  });
}
