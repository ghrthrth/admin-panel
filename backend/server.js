const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*',
}));

app.use(express.json());

const pool = mysql.createPool({
  host: 'efalogob.beget.app',
  user: 'default-db',
  port: 3306,
  password: '2zJ*G&XIqpNp',
  database: 'default-db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Создание таблиц
async function initializeDatabase() {
  try {
    // Создаем таблицу без столбца password
    await pool.query(`
      CREATE TABLE IF NOT EXISTS medical_staff (
                                                 id INT AUTO_INCREMENT PRIMARY KEY,
                                                 first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        role ENUM('doctor', 'nurse', 'admin') NOT NULL,
        specialization VARCHAR(100),
        department VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    // Способ 1: Проверка существования столбца
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'medical_staff' 
      AND COLUMN_NAME = 'password'
      AND TABLE_SCHEMA = DATABASE()
    `);

    if (columns.length > 0) {
      await pool.query('ALTER TABLE medical_staff DROP COLUMN password');
      console.log('Password column removed successfully');
    } else {
      console.log('Password column does not exist, skipping removal');
    }

    console.log('Database tables created/updated successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

initializeDatabase();

// CRUD Endpoints для медицинского персонала

// Получить всех сотрудников
app.get('/api/staff', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, first_name, last_name, email, role, specialization, department, created_at FROM medical_staff'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Получить информацию о конкретном сотруднике
app.get('/api/staff/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, first_name, last_name, email, role, specialization, department, created_at FROM medical_staff WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Добавить нового сотрудника
app.post('/api/staff', async (req, res) => {
  try {
    const { first_name, last_name, email, role, specialization, department } = req.body;

    const [result] = await pool.query(
      'INSERT INTO medical_staff (first_name, last_name, email, role, specialization, department) VALUES (?, ?, ?, ?, ?, ?)',
      [first_name, last_name, email, role, specialization, department]
    );

    const [newStaff] = await pool.query(
      'SELECT id, first_name, last_name, email, role, specialization, department, created_at FROM medical_staff WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(newStaff[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Обновить информацию о сотруднике
app.put('/api/staff/:id', async (req, res) => {
  try {
    const { first_name, last_name, email, specialization, department } = req.body;

    await pool.query(
      'UPDATE medical_staff SET first_name = ?, last_name = ?, email = ?, specialization = ?, department = ? WHERE id = ?',
      [first_name, last_name, email, specialization, department, req.params.id]
    );

    const [updatedStaff] = await pool.query(
      'SELECT id, first_name, last_name, email, role, specialization, department, created_at FROM medical_staff WHERE id = ?',
      [req.params.id]
    );

    res.json(updatedStaff[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Удалить сотрудника
app.delete('/api/staff/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM medical_staff WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = 8001;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server stopped');
    pool.end();
    process.exit(0);
  });
});