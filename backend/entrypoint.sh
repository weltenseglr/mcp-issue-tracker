#!/bin/sh
set -e

DB_FILE="${DATABASE_PATH:-/data/database.sqlite}"

# Bootstrap better-auth tables if this is a fresh database
if [ ! -f "$DB_FILE" ] || [ ! -s "$DB_FILE" ]; then
    echo "Fresh database detected — bootstrapping better-auth schema..."
    for sql_file in better-auth_migrations/*.sql; do
        if [ -f "$sql_file" ]; then
            echo "  Applying $(basename "$sql_file")..."
            node --input-type=commonjs -e "
                const Database = require('better-sqlite3');
                const fs = require('fs');
                const db = new Database(process.argv[1]);
                db.exec(fs.readFileSync(process.argv[2], 'utf8'));
                db.close();
            " "$DB_FILE" "$sql_file"
        fi
    done
    echo "better-auth schema ready."
fi

echo "Running DB migrations..."
node dist/db/migrate.js
echo "Migrations complete."

echo "Starting server..."
exec node dist/index.js
