const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();

app.use(cors({
  origin: '*',
}));

app.use(express.json());

// Настройка пула соединений с БД
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

// Для Beget
const transporter = nodemailer.createTransport({
  host: 'smtp.beget.com',
  port: 465,
  secure: true,
  auth: {
    user: 'webmaster@decadances.ru',
    pass: 'Su6EvdGlt6&O'
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000
});

// Функция для генерации случайного пароля
function generatePassword(length = 10) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

// Функция для генерации логина
function generateLogin(firstName, lastName) {
  const cleanFirstName = firstName.toLowerCase().replace(/\s+/g, '');
  const cleanLastName = lastName.toLowerCase().replace(/\s+/g, '');
  return `${cleanFirstName}.${cleanLastName}`;
}

// Создание таблиц
async function initializeDatabase() {
  try {
    // Создаем таблицу медицинского персонала
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

    // Создаем таблицу для учетных данных
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff_credentials (
                                                     id INT AUTO_INCREMENT PRIMARY KEY,
                                                     staff_id INT NOT NULL,
                                                     login VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES medical_staff(id) ON DELETE CASCADE
        )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS patients (
                                            id INT AUTO_INCREMENT PRIMARY KEY,
                                            first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        dob DATE NOT NULL,
        gender ENUM('male', 'female', 'other') NOT NULL,
        address VARCHAR(255),
        phone VARCHAR(20),
        email VARCHAR(100),
        insurance_number VARCHAR(50),
        diagnosis TEXT,
        admission_date DATETIME NOT NULL,
        discharge_date DATETIME,
        ward_number VARCHAR(20),
        department VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    console.log('Database tables created/updated successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

initializeDatabase();

// Функция для отправки email с учетными данными
async function sendCredentialsEmail(email, login, password) {
  try {
    const mailOptions = {
      from: 'webmaster@decadances.ru',
      to: email,
      subject: 'Your Hospital System Credentials',
      text: `Dear user,\n\nYour login credentials for the Hospital System are:\n\nLogin: ${login}\nPassword: ${password}\n\nPlease change your password after first login.\n\nBest regards,\nHospital Admin`,
      html: `<p>Dear user,</p>
             <p>Your login credentials for the Hospital System are:</p>
             <p><strong>Login:</strong> ${login}<br>
             <strong>Password:</strong> ${password}</p>
             <p>Please change your password after first login.</p>
             <p>Best regards,<br>Hospital Admin</p>`
    };

    await transporter.sendMail(mailOptions);
    console.log('Credentials email sent to', email);
  } catch (err) {
    console.error('Error sending email:', err);
    throw err;
  }
}

// CRUD Endpoints для медицинского персонала

// Эндпоинт для авторизации
app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    const [users] = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, s.email, s.role,
              c.login, c.password
       FROM medical_staff s
              JOIN staff_credentials c ON s.id = c.staff_id
       WHERE c.login = ?`,
      [login]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    if (hashedPassword !== user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { password: _, ...userData } = user;

    res.json({
      code: 200,
      result: userData
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Добавить нового сотрудника
app.post('/api/staff', async (req, res) => {
  try {
    const { first_name, last_name, email, role, specialization, department } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [result] = await connection.query(
        'INSERT INTO medical_staff (first_name, last_name, email, role, specialization, department) VALUES (?, ?, ?, ?, ?, ?)',
        [first_name, last_name, email, role, specialization, department]
      );

      const login = generateLogin(first_name, last_name);
      const password = generatePassword();

      await connection.query(
        'INSERT INTO staff_credentials (staff_id, login, password) VALUES (?, ?, ?)',
        [result.insertId, login, crypto.createHash('sha256').update(password).digest('hex')]
      );

      const [newStaff] = await connection.query(
        'SELECT id, first_name, last_name, email, role, specialization, department, created_at FROM medical_staff WHERE id = ?',
        [result.insertId]
      );

      await connection.commit();
      connection.release();

      sendCredentialsEmail(email, login, password)
        .catch(err => console.error('Failed to send email:', err));

      res.status(201).json(newStaff[0]);
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err) {
    console.error(err);

    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('email')) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      if (err.message.includes('login')) {
        return res.status(400).json({ error: 'Generated login already exists' });
      }
    }

    res.status(500).json({ error: 'Database error' });
  }
});

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

// CRUD Endpoints для пациентов


app.get('/api/patients/verify', async (req, res) => {
  try {
    const { code } = req.query;

    // Улучшенное логирование
    console.log(`[${new Date().toISOString()}] Verification request for code:`, code);

    // Проверка кода приглашения
    if (!code || typeof code !== 'string' || code.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid invite code format (minimum 6 characters required)'
      });
    }

    // Запрос к базе с защитой от SQL-инъекций
    const [patients] = await pool.query(
      `SELECT 
        id,
        first_name,
        last_name,
        dob,
        diagnosis,
        ward_number,
        department,
        invitation_code
       FROM patients 
       WHERE invitation_code = ? 
       LIMIT 1`,
      [code]
    );

    if (patients.length === 0) {
      console.log(`[${new Date().toISOString()}] Invalid code attempt:`, code);
      return res.status(404).json({
        success: false,
        error: 'Invalid invitation code or patient not found'
      });
    }

    const patient = patients[0];

    // Форматирование ответа
    const response = {
      success: true,
      message: 'Patient verified successfully',
      patientId: patient.id,
      patient: {
        id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        dob: patient.dob, // Можно форматировать дату при необходимости
        diagnosis: patient.diagnosis,
        ward_number: patient.ward_number,
        department: patient.department,
        invitation_code: patient.invitation_code
      },
      timestamp: new Date().toISOString()
    };

    console.log(`[${new Date().toISOString()}] Successful verification for patient ID:`, patient.id);
    res.json(response);

  } catch (err) {
    console.error(`[${new Date().toISOString()}] Verification error:`, err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


// GET /api/patients
app.get('/api/patients', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM patients');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/patients/:id
app.get('/api/patients/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found!!!!!!!' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/patients
app.post('/api/patients', async (req, res) => {
  try {
    const { first_name, last_name, dob, diagnosis, ward_number, department } = req.body;
    const [result] = await pool.query(
      `INSERT INTO patients (
        first_name, last_name, dob, diagnosis,
        ward_number, department
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, dob, diagnosis, ward_number, department]
    );
    const [newPatient] = await pool.query('SELECT * FROM patients WHERE id = ?', [result.insertId]);
    res.status(201).json(newPatient[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/patients/:id
app.put('/api/patients/:id', async (req, res) => {
  try {
    const { first_name, last_name, dob, diagnosis, ward_number, department } = req.body;
    await pool.query(
      `UPDATE patients SET
                         first_name = ?,
                         last_name = ?,
                         dob = ?,
                         diagnosis = ?,
                         ward_number = ?,
                         department = ?
       WHERE id = ?`,
      [first_name, last_name, dob, diagnosis, ward_number, department, req.params.id]
    );
    const [updatedPatient] = await pool.query('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    res.json(updatedPatient[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// В server.js

// GET /api/patients/search
app.get('/api/patients/search', async (req, res) => {
  try {
    const { query } = req.query;

    // Валидация запроса
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters long'
      });
    }

    const searchQuery = `%${query}%`;

    // Ищем пациентов по имени, фамилии или номеру страховки
    const [patients] = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         dob,
         diagnosis,
         ward_number,
         department,
         insurance_number,
         invitation_code
       FROM patients
       WHERE
         first_name LIKE ? OR
         last_name LIKE ? OR
         insurance_number LIKE ?
         LIMIT 50`, // Ограничиваем результаты для производительности
      [searchQuery, searchQuery, searchQuery]
    );

    // Форматируем дату рождения (если нужно)
    const formattedPatients = patients.map(patient => ({
      ...patient,
      dob: formatDate(patient.dob) // Например, 'YYYY-MM-DD' → 'DD.MM.YYYY'
    }));

    res.json({
      success: true,
      count: formattedPatients.length,
      patients: formattedPatients
    });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Вспомогательная функция для форматирования даты
function formatDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU'); // Формат DD.MM.YYYY
}

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