import express from 'express';
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM campings');
    if (rows.length > 0) {
      res.json(rows);
    } else {
      res.status(404).send('No camping spots available');
    }
  } catch (err) {
    console.error('Error fetching campings:', err.message);
    res.status(500).send('Error fetching campings');
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM campings WHERE camping_id = ?', [id]);
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).send('Camping spot not found');
    }
  } catch (err) {
    console.error('Error fetching camping spot:', err.message);
    res.status(500).send('Error fetching camping spot');
  }
});

router.post('/', async (req, res) => {
  const { owner_id, name, location, price_per_night, description } = req.body;

  try {
    await db.execute(
      'INSERT INTO campings (owner_id, name, location, price_per_night, description) VALUES (?, ?, ?, ?, ?)',
      [owner_id, name, location, price_per_night, description]
    );

    res.status(201).send({ message: 'Camping spot added successfully' });
  } catch (err) {
    console.error('Error adding camping spot:', err.message);
    res.status(500).send('Error adding camping spot');
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.execute('DELETE FROM campings WHERE camping_id = ?', [id]);
    if (result.affectedRows > 0) {
      res.send({ message: 'Camping spot deleted successfully' });
    } else {
      res.status(404).send('Camping spot not found');
    }
  } catch (err) {
    console.error('Error deleting camping spot:', err.message);
    res.status(500).send('Error deleting camping spot');
  }
});

export default router;
