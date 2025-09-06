const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const ensureDir = dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive:true }); };

const videosDir = path.join(process.cwd(), 'uploads', 'videos');
ensureDir(videosDir);

const storage = multer.diskStorage({
  destination: (req,file,cb)=> cb(null, videosDir),
  filename: (req,file,cb)=> {
    const safe = Date.now() + '_' + (file.originalname||'video').replace(/[^a-zA-Z0-9.\-_]/g,'_');
    cb(null, safe);
  }
});
const upload = multer({ storage });

router.post('/video', upload.single('video'), (req,res)=>{
  if (!req.file) return res.status(400).json({ error:'no file' });
  const rel = '/uploads/videos/' + req.file.filename;
  res.json({ url: rel });
});

module.exports = router;
