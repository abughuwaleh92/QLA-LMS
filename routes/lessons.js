const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL==='disable'?false:{ rejectUnauthorized:false } });

// Ensure columns and indexes exist (idempotent)
async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    slug TEXT,
    grade INT,
    unit INT,
    lesson_order INT,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    html_path TEXT,
    html_content TEXT,
    is_public BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS lessons_slug_unique ON lessons(slug);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS lessons_grade_unit_order_unique ON lessons(grade,unit,lesson_order);`);
}
ensureSchema().catch(console.error);

// Helpers
function slugify(s){ return String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

// GET catalog (grouped by units, with optional filtering by grade)
router.get('/catalog', async (req,res) => {
  try {
    const { grade, all } = req.query;
    let where = 'WHERE is_public = true'; const params = [];
    if (grade && !all) { params.push(parseInt(grade)); where += ` AND grade = $${params.length}`; }
    const q = `SELECT id, slug, grade, unit, lesson_order as "order", title, description, video_url, html_path,
                      CASE WHEN html_path IS NOT NULL THEN html_path
                           ELSE '/api/lessons/'+CAST(id AS TEXT)+'/render' END AS src
               FROM lessons ${where}
               ORDER BY grade, unit, lesson_order;`;
    const { rows } = await pool.query(q, params);
    const unitsMap = new Map();
    for (const r of rows) {
      const key = `${r.grade}-${r.unit}`;
      if (!unitsMap.has(key)) unitsMap.set(key, { grade:r.grade, num:r.unit, name:`Unit ${r.unit}`, lessons:[] });
      unitsMap.get(key).lessons.push(r);
    }
    res.json({ units: Array.from(unitsMap.values()), resolverBase: grade?`/lessons/grade${grade}`:null });
  } catch(e){ console.error(e); res.status(500).json({ error:String(e) }); }
});

// Resolve a static lesson path by (grade,unit,order) with graceful fallbacks
router.get('/resolve', async (req,res) => {
  const grade = parseInt(req.query.grade), unit = parseInt(req.query.unit), order = parseInt(req.query.order);
  const base = `/lessons/grade${grade}`;
  const candidates = [
    `${base}/lesson-${unit}-${order}.html`,
    `${base}/lesson-${order}.html`,
    `${base}/welcome.html`
  ];
  try {
    // Prefer DB html_path if present
    const { rows } = await pool.query(`SELECT html_path FROM lessons WHERE grade=$1 AND unit=$2 AND lesson_order=$3 LIMIT 1`, [grade,unit,order]);
    if (rows[0]?.html_path) return res.json({ src: rows[0].html_path });
  } catch(_){}
  return res.json({ src: candidates[0], candidates });
});

// Create lesson
router.post('/', express.json({limit:'2mb'}), async (req,res) => {
  try {
    const { title, grade, unit, lesson_order, description, video_url, html_path, html_content } = req.body;
    const slug = slugify(`${grade}-${unit}-${lesson_order}-${title}`);
    // Insert or update by slug (two-step, robust even without unique)
    const insert = `INSERT INTO lessons (slug, grade, unit, lesson_order, title, description, video_url, html_path, html_content)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                    ON CONFLICT DO NOTHING RETURNING id`;
    const params = [slug, grade, unit, lesson_order, title, description||null, video_url||null, html_path||null, html_content||null];
    const r = await pool.query(insert, params);
    if (r.rowCount === 0) {
      await pool.query(`UPDATE lessons SET grade=$2, unit=$3, lesson_order=$4, title=$5, description=$6, video_url=$7, html_path=$8, html_content=$9, updated_at=now() WHERE slug=$1`, params);
      const q = await pool.query(`SELECT id FROM lessons WHERE slug=$1`, [slug]);
      return res.json({ id: q.rows[0].id, slug });
    }
    return res.json({ id: r.rows[0].id, slug });
  } catch(e){ console.error(e); res.status(500).json({ error:String(e) }); }
});

// Update lesson
router.put('/:id', express.json({limit:'1mb'}), async (req,res) => {
  try {
    const id = parseInt(req.params.id);
    const fields = ['title','description','video_url','html_path','html_content','grade','unit','lesson_order','is_public'];
    const sets = []; const params = []; let i=1;
    for (const f of fields) if (f in req.body) { sets.push(`${f}=$${i++}`); params.push(req.body[f]); }
    if (sets.length===0) return res.json({ ok:true });
    params.push(id);
    await pool.query(`UPDATE lessons SET ${sets.join(',')}, updated_at=now() WHERE id=$${i}`, params);
    res.json({ ok:true });
  } catch(e){ console.error(e); res.status(500).json({ error:String(e) }); }
});

// Delete lesson
router.delete('/:id', async (req,res) => {
  try { await pool.query(`DELETE FROM lessons WHERE id=$1`, [parseInt(req.params.id)]); res.json({ ok:true }); }
  catch(e){ console.error(e); res.status(500).json({ error:String(e) }); }
});

// Render lesson from DB html_content (for lessons authored in editor)
router.get('/:id/render', async (req,res) => {
  try {
    const id = parseInt(req.params.id);
    const r = await pool.query(`SELECT title, html_content FROM lessons WHERE id=$1`, [id]);
    if (r.rowCount===0) return res.status(404).send('Not found');
    const html = r.rows[0].html_content || '<p>No content.</p>';
    res.set('Content-Type','text/html; charset=utf-8');
    // Inject lesson bridge for progress
    return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${r.rows[0].title}</title></head><body>${html}<script src="/js/lesson-bridge.js"></script></body></html>`);
  } catch(e){ console.error(e); res.status(500).send(String(e)); }
});

module.exports = router;
