import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
import knex from 'knex';

const db = knex({
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
    },
    pool: {
        min: 0,
        max: 10,
    },
});

await db.raw("SELECT VERSION()").then(() => {
    console.debug('Database connection established!');
});

export default db;