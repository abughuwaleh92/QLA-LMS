# QLA Portal Bundle (Student + Teacher)

This bundle gives you two modern "QMaroon" portals and the backend pieces to make lessons **fully interactive**, **teacher‑authorable**, and **assignable**.

## What’s inside

```
public/
  portal-student.html     # Student Portal (SPA, maroon/gold)
  portal-teacher.html     # Teacher Portal (authoring + classroom mode)
  js/lesson-bridge.js     # Injected into any lesson HTML in an iframe
routes/
  lessons.js              # REST: CRUD + catalog + DB-render
  uploads.js              # Upload videos → /uploads/videos/*
  assignments.js          # Create/list assignments
  classroom.js            # Socket.IO classroom events
migrations/
  2025-09-06_lessons_extensions.sql  # Adds safe columns + unique indexes
```

All UI matches your maroon/gold card design.

## How to integrate into your existing server

1. **Copy the files** into your project (preserving directories).

2. **Mount static & routes** in `server.js`:

```js
// static (keep your existing ones)
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// serve lesson folders
app.use('/lessons/grade7', express.static(path.join(__dirname, 'grade7')));
app.use('/lessons/grade8', express.static(path.join(__dirname, 'grade8')));

// portals
// Visit /portal/student and /portal/teacher
app.get('/portal/student', (req,res)=> res.sendFile(path.join(__dirname,'public','portal-student.html')));
app.get('/portal/teacher', (req,res)=> res.sendFile(path.join(__dirname,'public','portal-teacher.html')));

// APIs
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/assignments', require('./routes/assignments'));

// WebSocket classroom
const { initClassroom } = require('./routes/classroom');
initClassroom(io); // after you create io = new Server(server)
```

3. **Run the migration SQL** (once) to add columns + unique indexes:

- Run this in Railway's SQL console or add to your migration runner:

`migrations/2025-09-06_lessons_extensions.sql`

4. **Deploy** and open:

- Student: `/portal/student`
- Teacher: `/portal/teacher`

> The Student portal resolves lessons from static folders (`/lessons/grade7|8`) and can *also* render lessons saved in the DB (via `/api/lessons/:id/render`) for content authored in the teacher portal.

## Notes

- **Lesson identity:** either by `slug` or `(grade,unit,order)`. Both unique indexes are created. The API uses a *two‑step* insert→update pattern that works even if the indexes were missing; but keep them for data integrity.
- **Video uploads:** stored under `/uploads/videos/*` and served from `/uploads` (remember to persist volume on Railway).
- **Bridge script:** `public/js/lesson-bridge.js` posts `{type:'lesson-progress', slide, total}` messages. The student portal displays a progress bar. You can also listen for `{complete:true}` to auto-complete.
- **Classroom mode:** Teacher starts a broadcast with a **class code**; students join with the same code. Teacher can send "Go To Lesson" to all students.

## Optional improvements

- Attach question banks to each lesson in `lessons.html_content` or add a `lesson_questions` table. Grade in `/api/assessments/submit`.
- Add Google OAuth guards around `/portal/teacher` and POST endpoints.
- Persist student progress in DB (`progress(user_id, lesson_id, completed_at)`), currently the student portal also updates `/api/progress/complete` if you implement it.

Enjoy! 🏫
