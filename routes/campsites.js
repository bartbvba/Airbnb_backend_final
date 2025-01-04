import express from 'express';
const router = express.Router();

// Fetch All Camping Spots
router.get('/', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
    });

    const [rows] = await connection.execute('SELECT * FROM campings');
    res.json(rows);

    await connection.end();
  } catch (err) {
    console.error('Error fetching campsites:', err.message);
    res.status(500).send('Error fetching campsites');
  }
});

export default router;
