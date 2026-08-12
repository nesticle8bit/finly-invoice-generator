/**
 * Refreshes <DB_NAME>__backup from the live database, and restores it back.
 *
 * The manual backup that saved this project once was nine days stale, which is
 * how much data an accident could have cost. Run it before anything schema- or
 * data-destructive:
 *
 *   npm run db:snapshot                    # live  -> <DB_NAME>__backup
 *   npm run db:snapshot -- --restore       # backup -> live  (asks first)
 *
 * The backup database must already exist and carry the same schema:
 *   createdb -h <host> -U <user> invoice_generator_db__backup
 *   DB_NAME=invoice_generator_db__backup npm run migrate
 */
const readline = require('readline');
const { Pool } = require('pg');

require('dotenv').config();

const BACKUP_SUFFIX = '__backup';

// Parent tables first: the copy runs with foreign keys enforced.
const TABLES = [
  'users',
  'profiles',
  'clients',
  'invitation_codes',
  'invoices',
  'invoice_items',
  'invoice_share_tokens',
];

const liveName = process.env.DB_NAME;
if (!liveName) {
  console.error('DB_NAME is not set — nothing to snapshot.');
  process.exit(1);
}
if (liveName.endsWith(BACKUP_SUFFIX)) {
  console.error(`DB_NAME is already the backup ("${liveName}"). Point it at the live database.`);
  process.exit(1);
}

const backupName = `${liveName}${BACKUP_SUFFIX}`;

function conn(database) {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true',
  };
}

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Copies every row, primary keys included: the foreign keys reference them, and
 * the invoice numbering reads MAX(id). Runs in one transaction, so a failure
 * halfway leaves the destination as it was.
 */
async function copy(fromName, toName) {
  const source = new Pool(conn(fromName));
  const target = new Pool(conn(toName));
  const client = await target.connect();

  try {
    await client.query('BEGIN');
    await client.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);

    for (const table of TABLES) {
      const { rows } = await source.query(`SELECT * FROM ${table} ORDER BY id`);

      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const quoted = columns.map((c) => `"${c}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        for (const row of rows) {
          await client.query(
            `INSERT INTO ${table} (${quoted}) VALUES (${placeholders})`,
            columns.map((c) => row[c])
          );
        }
      }

      // RESTART IDENTITY reset the sequence to 1, but the ids came from the
      // source — without this the next insert collides with an existing row.
      await client.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`,
        [table]
      );

      console.log(`  ${table}: ${rows.length}`);
    }

    await client.query('COMMIT');
    console.log(`\n${fromName} -> ${toName}: done`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(`\nRolled back, ${toName} is unchanged: ${err.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await source.end();
    await target.end();
  }
}

async function main() {
  const restoring = process.argv.includes('--restore');

  if (restoring) {
    // This overwrites live data. Nothing about it should be a single keystroke.
    console.log(`This REPLACES every row in "${liveName}" with the contents of "${backupName}".`);
    const answer = await confirm(`Type the database name to confirm (${liveName}): `);

    if (answer !== liveName) {
      console.log('Names did not match — nothing was changed.');
      return;
    }

    await copy(backupName, liveName);
    return;
  }

  await copy(liveName, backupName);
}

main();
