import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const db = await mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

app.get('/', (req, res) => {
  res.send('Welcome to the Airbnb API Backend!');
});

app.post('/api/users/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    await db.execute(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, role] 
    );

    res.status(201).send({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).send('Error during registration');
  }
});

app.put('/api/users/:userId', async (req, res) => {
  const { userId } = req.params;
  const { username, email, newPassword } = req.body;

  try {
    const [user] = await db.execute(
      'SELECT * FROM users WHERE user_id = ?',
      [userId]
    );

    if (!user.length) {
      return res.status(404).send('User not found');
    }

    if (newPassword) {
      const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
      await db.execute(
        'UPDATE users SET password = ? WHERE user_id = ?',
        [hashedNewPassword, userId]
      );
    }

    if (username) {
      await db.execute(
        'UPDATE users SET username = ? WHERE user_id = ?',
        [username, userId]
      );
    }

    if (email) {
      await db.execute(
        'UPDATE users SET email = ? WHERE user_id = ?',
        [email, userId]
      );
    }

    res.status(200).send({ message: 'User updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating user');
  }
});

app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).send('Invalid credentials');
    }
    const user = rows[0];
    if (bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign(
        { userId: user.user_id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      res.json({ token });
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch (err) {
    res.status(500).send('Error during login');
  }
});

app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params; 
  try {
    const query = 'SELECT * FROM users WHERE user_id = ?';

    const [rows] = await db.execute(query, [id]);  
    res.json(rows);
  } catch (err) {
    res.status(500).send('Error fetching user details');
  }
});

app.get('/api/campings', async (req, res) => {
  const { location, minPrice, maxPrice, onlyAvailable } = req.query;

  try {
    let query = 'SELECT * FROM campings WHERE 1=1';
    const params = [];

    if (location && location !== 'All Locations') {
      query += ' AND location = ?';
      params.push(location);
    }

    if (minPrice) {
      query += ' AND price_per_night >= ?';
      params.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      query += ' AND price_per_night <= ?';
      params.push(parseFloat(maxPrice));
    }

    if (onlyAvailable === 'true') {
      query += ' AND availability = 1';
    }

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).send('Error fetching campsites');
  }
});

app.get('/api/campings/:id', async (req, res) => {
  const spotId = req.params.id;
  try {
    const [rows] = await db.execute('SELECT * FROM campings WHERE camping_id = ?', [spotId]);
    if (rows.length === 0) {
      return res.status(404).send('Camping spot not found');
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).send('Error fetching camping details');
  }
});

app.delete('/api/campings/:id', async (req, res) => {
  const campingId = req.params.id;

  try {
    const [bookingRows] = await db.execute('SELECT * FROM bookings WHERE camping_id = ?', [campingId]);

    if (bookingRows.length > 0) {
      return res.status(400).send('This camping spot is booked and cannot be deleted.');
    }

    const [result] = await db.execute('DELETE FROM campings WHERE camping_id = ?', [campingId]);

    if (result.affectedRows === 0) {
      return res.status(404).send('Camping not found');
    }

    res.status(200).send('Camping deleted successfully');
  } catch (err) {
    console.error('Error deleting camping:', err);
    res.status(500).send('Error deleting camping');
  }
});

app.get('/api/campings/user/:id', async (req, res) => {
  const user_id = req.params.id;
  try {
    const [rows] = await db.execute('SELECT * FROM campings WHERE owner_id = ?', [user_id]);
    if (rows.length === 0) {
      return res.status(404).send('No campings found');
    }
    res.json(rows);
  } catch (err) {
    res.status(500).send('Error fetching campings');
  }
});

app.post('/api/campings', async (req, res) => {
  const { name, location, price_per_night, description, user_id } = req.body;

  if (!name || !location || !price_per_night || !description) {
    return res.status(400).send('All fields are required.');
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO campings (owner_id, name, location, price_per_night, description) VALUES (?, ?, ?, ?, ?)',
      [user_id, name, location, price_per_night, description]
    );

    res.status(201).json({
      message: 'Camping added successfully!',
      campingId: result.insertId,
    });
  } catch (err) {
    console.error('Error adding camping:', err);
    res.status(500).send('Error adding camping.');
  }
});

app.get('/api/bookings/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const [rows] = await db.execute('SELECT * FROM bookings WHERE user_id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).send('No bookings yet');
    }
    res.json(rows);
  } catch (err) {
    res.status(500).send('Error fetching camping details');
  }
});

app.delete('/api/bookings/:id', async (req, res) => {
  const bookingId = req.params.id;

  try {
    const [result] = await db.execute('DELETE FROM bookings WHERE booking_id = ?', [bookingId]);

    if (result.affectedRows === 0) {
      return res.status(404).send('Booking not found');
    }

    res.status(200).send('Booking successfully deleted');
  } catch (err) {
    console.error('Error deleting booking:', err);
    res.status(500).send('Error deleting booking');
  }
});

app.post('/api/bookings', async (req, res) => {
  const { user_id, camping_id, start_date, end_date } = req.body;

  try {
    const [camping] = await db.execute(
      'SELECT price_per_night FROM campings WHERE camping_id = ?',
      [camping_id]
    );

    if (!camping.length) {
      return res.status(404).send('Camping spot not found');
    }

    const pricePerNight = camping[0].price_per_night;
    const numNights = Math.ceil(
      (new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)
    );

    const totalPrice = pricePerNight * numNights;

    await db.execute(
      'INSERT INTO bookings (user_id, camping_id, start_date, end_date, total_price) VALUES (?, ?, ?, ?, ?)',
      [user_id, camping_id, start_date, end_date, totalPrice]
    );

    res.status(201).send({ message: 'Booking successful', totalPrice });
  } catch (err) {
    res.status(500).send('Error during booking');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
