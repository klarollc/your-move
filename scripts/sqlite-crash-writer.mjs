import Database from "better-sqlite3";

const databasePath = process.argv[2];
if (!databasePath) process.exit(92);

const database = new Database(databasePath);
database.exec("BEGIN IMMEDIATE");
database.prepare("INSERT INTO interrupted_write_probe(value) VALUES (?)").run("must rollback");
process.exit(91);
