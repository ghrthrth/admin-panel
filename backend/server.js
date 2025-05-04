const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const nodemailer = require('nodemailer'); // Для отправки email
const crypto = require('crypto'); // Для генерации пароля

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
  connectionTimeout: 10000, // 10 секунд
  greetingTimeout: 10000   // 10 секунд
});

// Функция для генерации случайного пароля
function generatePassword(length = 10) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}
// Функция для генерации логина на основе имени и фамилии
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

    // Ищем пользователя по логину
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

    // Проверяем пароль (хешированный)
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    if (hashedPassword !== user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Формируем ответ без пароля
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

// Добавить нового сотрудника с генерацией учетных данных
app.post('/api/staff', async (req, res) => {
  try {
    const { first_name, last_name, email, role, specialization, department } = req.body;

    // Начинаем транзакцию
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Вставляем данные сотрудника
      const [result] = await connection.query(
        'INSERT INTO medical_staff (first_name, last_name, email, role, specialization, department) VALUES (?, ?, ?, ?, ?, ?)',
        [first_name, last_name, email, role, specialization, department]
      );

      // Генерируем учетные данные
      const login = generateLogin(first_name, last_name);
      const password = generatePassword();

      // Вставляем учетные данные
      await connection.query(
        'INSERT INTO staff_credentials (staff_id, login, password) VALUES (?, ?, ?)',
        [result.insertId, login, crypto.createHash('sha256').update(password).digest('hex')]
      );

      // Получаем данные нового сотрудника
      const [newStaff] = await connection.query(
        'SELECT id, first_name, last_name, email, role, specialization, department, created_at FROM medical_staff WHERE id = ?',
        [result.insertId]
      );

      // Фиксируем транзакцию
      await connection.commit();
      connection.release();

      // Отправляем email с учетными данными (не блокируем ответ)
      sendCredentialsEmail(email, login, password)
        .catch(err => console.error('Failed to send email:', err));

      res.status(201).json(newStaff[0]);
    } catch (err) {
      // Откатываем транзакцию при ошибке
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