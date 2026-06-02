const express = require('express');
const cors = require('cors');
const pool = require('./db');
const app = express();

app.use(cors());
app.use(express.json());

// Валидация
const validate = (req, res, next) => {
    const { name, arrival, departure, roomIds } = req.body;
    if (!name || name.length < 3) return res.status(400).send("Укажите ФИО гостя");
    if (new Date(arrival) >= new Date(departure)) return res.status(400).send("Дата выезда некорректна");
    if (!roomIds || roomIds.length === 0) return res.status(400).send("Выберите места");
    next();
};

// Аналитика
app.get('/api/analytics/stats', async (req, res) => {
    const stats = await pool.query(`
        SELECT (SELECT COUNT(*) FROM rooms) as total_rooms,
        (SELECT COUNT(*) FROM clients WHERE is_active = true) as active_guests,
        (SELECT COALESCE(SUM(total_paid), 0) FROM clients) as total_revenue,
        (SELECT COUNT(*) FROM rooms WHERE maintenance_status = 'Dirty') as dirty_rooms
    `);
    res.json(stats.rows[0]);
});

// Номера
app.get('/api/rooms', async (req, res) => {
    const result = await pool.query(`
        SELECT r.*, (r.capacity - (SELECT COUNT(*) FROM clients c WHERE c.room_id = r.id AND c.is_active = true)) as remaining_beds
        FROM rooms r ORDER BY room_number
    `);
    res.json(result.rows);
});

app.post('/api/rooms', async (req, res) => {
    const { room_number, floor, room_type, room_class, capacity, price_per_room, description } = req.body;
    const result = await pool.query("INSERT INTO rooms (room_number, floor, room_type, room_class, capacity, price_per_room, description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *", [room_number, floor, room_type, room_class, capacity, price_per_room, description]);
    res.json(result.rows[0]);
});

app.put('/api/rooms/:id', async (req, res) => {
    const { room_number, floor, room_type, room_class, capacity, price_per_room, description } = req.body;
    await pool.query("UPDATE rooms SET room_number=$1, floor=$2, room_type=$3, room_class=$4, capacity=$5, price_per_room=$6, description=$7 WHERE id=$8", [room_number, floor, room_type, room_class, capacity, price_per_room, description, req.params.id]);
    res.sendStatus(200);
});

// Клиенты
app.get('/api/clients', async (req, res) => {
    const result = await pool.query("SELECT c.*, r.room_number FROM clients c LEFT JOIN rooms r ON c.room_id = r.id ORDER BY c.is_active DESC, c.id DESC");
    res.json(result.rows);
});

app.post('/api/queries/register-client', validate, async (req, res) => {
    const { name, passport, city, roomIds, arrival, departure, totalAmount } = req.body;
    const dirtyCheck = await pool.query("SELECT room_number FROM rooms WHERE id = ANY($1) AND maintenance_status = 'Dirty'", [roomIds]);
    if (dirtyCheck.rows.length > 0) return res.status(400).send("Номера еще не убраны!");

    const days = Math.ceil(Math.abs(new Date(departure) - new Date(arrival)) / (1000 * 60 * 60 * 24)) || 1;
    for (let roomId of roomIds) {
        await pool.query("INSERT INTO clients (full_name, passport, city_from, stay_days, room_id, total_paid, arrival_date, departure_date, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, true)", [name, passport, city, days, roomId, totalAmount/roomIds.length, arrival, departure]);
    }
    res.sendStatus(201);
});

app.put('/api/clients/:id', async (req, res) => {
    const { full_name, passport, city_from, arrival_date, departure_date } = req.body;
    await pool.query("UPDATE clients SET full_name=$1, passport=$2, city_from=$3, arrival_date=$4, departure_date=$5 WHERE id=$6", [full_name, passport, city_from, arrival_date, departure_date, req.params.id]);
    res.sendStatus(200);
});

app.delete('/api/clients/:id', async (req, res) => {
    const client = await pool.query("SELECT room_id, full_name FROM clients WHERE id = $1", [req.params.id]);
    if (client.rows[0]) {
        const roomId = client.rows[0].room_id;
        await pool.query("UPDATE clients SET is_active = false, room_id = NULL WHERE id = $1", [req.params.id]);
        if (roomId) await pool.query("UPDATE rooms SET maintenance_status = 'Dirty' WHERE id = $1", [roomId]);
        await pool.query("INSERT INTO notifications (message) VALUES ($1)", [`Гость ${client.rows[0].full_name} выехал. Требуется уборка.`]);
    }
    res.sendStatus(200);
});

// Персонал и График
app.get('/api/employees', async (req, res) => {
    const result = await pool.query("SELECT * FROM employees ORDER BY id");
    res.json(result.rows);
});

app.post('/api/employees', async (req, res) => {
    const { full_name, phone, status } = req.body;
    const result = await pool.query("INSERT INTO employees (full_name, phone, status) VALUES ($1,$2,$3) RETURNING *", [full_name, phone, status]);
    res.json(result.rows[0]);
});

app.put('/api/employees/:id', async (req, res) => {
    const { full_name, phone, status } = req.body;
    await pool.query("UPDATE employees SET full_name=$1, phone=$2, status=$3 WHERE id=$4", [full_name, phone, status, req.params.id]);
    res.sendStatus(200);
});

app.patch('/api/employees/:id/status', async (req, res) => {
    await pool.query("UPDATE employees SET status = $1 WHERE id = $2", [req.body.status, req.params.id]);
    res.sendStatus(200);
});

app.delete('/api/employees/:id', async (req, res) => {
    await pool.query("DELETE FROM employees WHERE id = $1", [req.params.id]);
    res.sendStatus(200);
});

app.get('/api/schedule', async (req, res) => {
    const result = await pool.query("SELECT s.*, e.full_name as employee_name, r.room_number FROM cleaning_schedule s JOIN employees e ON s.employee_id = e.id LEFT JOIN rooms r ON s.room_id = r.id ORDER BY s.cleaning_date ASC");
    res.json(result.rows);
});

app.post('/api/schedule', async (req, res) => {
    const { employee_id, floor, cleaning_date, room_id } = req.body;
    await pool.query("INSERT INTO cleaning_schedule (employee_id, floor, cleaning_date, room_id) VALUES ($1,$2,$3,$4)", [employee_id, floor || null, cleaning_date, room_id || null]);
    res.sendStatus(201);
});

app.patch('/api/schedule/:id/complete', async (req, res) => {
    const task = await pool.query("SELECT room_id, floor FROM cleaning_schedule WHERE id = $1", [req.params.id]);
    if (task.rows[0]) {
        const { room_id, floor } = task.rows[0];
        if (room_id) await pool.query("UPDATE rooms SET maintenance_status = 'Ready' WHERE id = $1", [room_id]);
        else if (floor) await pool.query("UPDATE rooms SET maintenance_status = 'Ready' WHERE floor = $1", [floor]);
        await pool.query("UPDATE cleaning_schedule SET status = 'Выполнено' WHERE id = $1", [req.params.id]);
    }
    res.sendStatus(200);
});

app.delete('/api/schedule/:id', async (req, res) => {
    await pool.query("DELETE FROM cleaning_schedule WHERE id = $1", [req.params.id]);
    res.sendStatus(200);
});

app.get('/api/queries/search-cleaner', async (req, res) => {
    const { room_number, date } = req.query;
    const result = await pool.query(`SELECT e.full_name, e.phone FROM cleaning_schedule s JOIN employees e ON s.employee_id = e.id LEFT JOIN rooms r ON s.room_id = r.id WHERE (r.room_number = $1 OR (s.room_id IS NULL AND s.floor = (SELECT floor FROM rooms WHERE room_number = $1))) AND s.cleaning_date = $2`, [room_number, date]);
    res.json(result.rows);
});

app.listen(5000, () => console.log('Server live on 5000'));