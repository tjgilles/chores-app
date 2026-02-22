import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("chores.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS chores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    duration TEXT,
    frequency TEXT CHECK(frequency IN ('daily', 'weekly', 'monthly', 'biannually', 'yearly')),
    sort_order INTEGER,
    start_date DATETIME,
    last_completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chore_id INTEGER,
    user_id INTEGER,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(chore_id) REFERENCES chores(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migration: Add start_date if it doesn't exist
try {
  db.prepare("SELECT start_date FROM chores LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE chores ADD COLUMN start_date DATETIME");
}

try {
  db.prepare("SELECT email FROM users LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT");
}

// Seed initial users if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  db.prepare("INSERT INTO users (name, email) VALUES (?, ?)").run("Husband", "husband@example.com");
  db.prepare("INSERT INTO users (name, email) VALUES (?, ?)").run("Wife", "wife@example.com");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  app.post("/api/users", (req, res) => {
    const { name, email } = req.body;
    try {
      const result = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)").run(name, email);
      res.json({ id: result.lastInsertRowid, name, email });
      broadcast({ type: "USER_ADDED" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const { name, email } = req.body;
    try {
      db.prepare("UPDATE users SET name = ?, email = ? WHERE id = ?").run(name, email, id);
      res.json({ success: true });
      broadcast({ type: "USER_UPDATED", userId: id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/users/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM completions WHERE user_id = ?").run(id);
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
      res.json({ success: true });
      broadcast({ type: "USER_DELETED", userId: id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/chores", (req, res) => {
    const chores = db.prepare("SELECT * FROM chores ORDER BY sort_order ASC").all();
    res.json(chores);
  });

  app.post("/api/chores", (req, res) => {
    const { name, duration, frequency, start_date } = req.body;
    const maxOrder = db.prepare("SELECT MAX(sort_order) as max_order FROM chores").get() as { max_order: number };
    const nextOrder = (maxOrder.max_order || 0) + 1;
    const result = db.prepare("INSERT INTO chores (name, duration, frequency, sort_order, start_date) VALUES (?, ?, ?, ?, ?)").run(name, duration, frequency, nextOrder, start_date);
    res.json({ id: result.lastInsertRowid, name, duration, frequency, sort_order: nextOrder, start_date });
    broadcast({ type: "CHORE_ADDED" });
  });

  app.post("/api/chores/reorder", (req, res) => {
    const { orders } = req.body; // Array of { id, sort_order }
    const update = db.prepare("UPDATE chores SET sort_order = ? WHERE id = ?");
    const transaction = db.transaction((items) => {
      for (const item of items) update.run(item.sort_order, item.id);
    });
    transaction(orders);
    res.json({ success: true });
    broadcast({ type: "CHORES_REORDERED" });
  });

  app.post("/api/chores/:id/complete", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const now = new Date().toISOString();
    
    db.prepare("INSERT INTO completions (chore_id, user_id, completed_at) VALUES (?, ?, ?)").run(id, userId, now);
    db.prepare("UPDATE chores SET last_completed_at = ? WHERE id = ?").run(now, id);
    
    res.json({ success: true, completed_at: now });
    broadcast({ type: "CHORE_COMPLETED", choreId: id, userId });
  });

  app.put("/api/chores/:id", (req, res) => {
    const { id } = req.params;
    const { name, duration, frequency, start_date } = req.body;
    db.prepare("UPDATE chores SET name = ?, duration = ?, frequency = ?, start_date = ? WHERE id = ?").run(name, duration, frequency, start_date, id);
    res.json({ success: true });
    broadcast({ type: "CHORE_UPDATED", choreId: id });
  });

  app.delete("/api/chores/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM completions WHERE chore_id = ?").run(id);
    db.prepare("DELETE FROM chores WHERE id = ?").run(id);
    res.json({ success: true });
    broadcast({ type: "CHORE_DELETED", choreId: id });
  });

  app.get("/api/stats", (req, res) => {
    const stats = db.prepare(`
      SELECT u.name, COUNT(c.id) as completion_count
      FROM users u
      LEFT JOIN completions c ON u.id = c.user_id
      GROUP BY u.id
    `).all();
    res.json(stats);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // WebSocket for real-time updates
  const wss = new WebSocketServer({ server });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  function broadcast(data: any) {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

startServer();
