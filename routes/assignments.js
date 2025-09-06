const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL==='disable'?false:{ rejectUnauthorized:false } });

async function ensureSchema(){
  await pool.query(`CREATE TABLE IF NOT EXISTS assignments(
    id SERIAL PRIMARY KEY,
    lesson_id INT NOT NULL,
    class_code TEXT NOT NULL,
    pass_pct INT DEFAULT 70,
    due_at DATE,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );`);
}
ensureSchema().catch(console.error);

router.get('/', async (req,res)=>{
  try {
    const { rows } = await pool.query(`SELECT * FROM assignments ORDER BY created_at DESC LIMIT 100`);
    res.json(rows);
  } catch(e){ console.error(e); res.status(500).json({ error:String(e) }); }
});

router.post('/', express.json(), async (req,res)=>{
  try {
    const { lesson_id, class_code, pass_pct, due_at } = req.body;
    const { rows } = await pool.query(`INSERT INTO assignments (lesson_id, class_code, pass_pct, due_at) VALUES ($1,$2,$3,$4) RETURNING *`,
      [parseInt(lesson_id), class_code, parseInt(pass_pct)||70, due_at||null]);
    res.json(rows[0]);
  } catch(e){ console.error(e); res.status(500).json({ error:String(e) }); }
});

module.exports = router;
