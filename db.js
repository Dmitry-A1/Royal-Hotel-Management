const Pool = require('pg').Pool;
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE
});


pool.connect((err, client, release) => {
    if (err) {
        return console.error('КРИТИЧЕСКАЯ ОШИБКА ПОДКЛЮЧЕНИЯ К БД:', err.stack);
    }
    console.log('Связь с PostgreSQL успешно установлена!');
    release();
});

module.exports = pool;