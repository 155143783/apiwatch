const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../data/apiwatch.db'));

// 初始化数据库表
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS endpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      interval_minutes INTEGER DEFAULT 5,
      is_active INTEGER DEFAULT 1,
      tier TEXT DEFAULT 'free',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS health_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint_id INTEGER NOT NULL,
      status_code INTEGER,
      response_time_ms INTEGER,
      is_success INTEGER,
      error_message TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      target TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
    );

    CREATE INDEX IF NOT EXISTS idx_health_checks_endpoint ON health_checks(endpoint_id);
    CREATE INDEX IF NOT EXISTS idx_health_checks_time ON health_checks(checked_at);
  `);
}

// 端点CRUD操作
const endpoints = {
  create: (name, url, interval_minutes = 5, tier = 'free') => {
    const stmt = db.prepare('INSERT INTO endpoints (name, url, interval_minutes, tier) VALUES (?, ?, ?, ?)');
    const result = stmt.run(name, url, interval_minutes, tier);
    return result.lastInsertRowid;
  },

  getAll: () => {
    return db.prepare('SELECT * FROM endpoints WHERE is_active = 1 ORDER BY created_at DESC').all();
  },

  getById: (id) => {
    return db.prepare('SELECT * FROM endpoints WHERE id = ?').get(id);
  },

  update: (id, { name, url, interval_minutes }) => {
    const stmt = db.prepare('UPDATE endpoints SET name = ?, url = ?, interval_minutes = ? WHERE id = ?');
    return stmt.run(name, url, interval_minutes, id);
  },

  delete: (id) => {
    db.prepare('UPDATE endpoints SET is_active = 0 WHERE id = ?').run(id);
    return true;
  },

  count: () => {
    return db.prepare('SELECT COUNT(*) as count FROM endpoints WHERE is_active = 1').get().count;
  },

  getByTier: (tier) => {
    return db.prepare('SELECT * FROM endpoints WHERE tier = ? AND is_active = 1').all(tier);
  }
};

// 健康检查记录
const healthChecks = {
  create: (endpoint_id, status_code, response_time_ms, is_success, error_message = null) => {
    const stmt = db.prepare(`
      INSERT INTO health_checks (endpoint_id, status_code, response_time_ms, is_success, error_message)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(endpoint_id, status_code, response_time_ms, is_success ? 1 : 0, error_message);
  },

  getByEndpoint: (endpoint_id, limit = 100) => {
    return db.prepare(`
      SELECT * FROM health_checks 
      WHERE endpoint_id = ? 
      ORDER BY checked_at DESC 
      LIMIT ?
    `).all(endpoint_id, limit);
  },

  getStats: (endpoint_id, hours = 24) => {
    return db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_success = 1 THEN 1 ELSE 0 END) as success_count,
        AVG(response_time_ms) as avg_response_time,
        MIN(response_time_ms) as min_response_time,
        MAX(response_time_ms) as max_response_time
      FROM health_checks 
      WHERE endpoint_id = ? 
      AND checked_at >= datetime('now', '-' || ? || ' hours')
    `).get(endpoint_id, hours);
  },

  getRecentFailures: (limit = 10) => {
    return db.prepare(`
      SELECT h.*, e.name as endpoint_name, e.url as endpoint_url
      FROM health_checks h
      JOIN endpoints e ON h.endpoint_id = e.id
      WHERE h.is_success = 0
      ORDER BY h.checked_at DESC
      LIMIT ?
    `).all(limit);
  },

  cleanup: (days = 7) => {
    db.prepare(`
      DELETE FROM health_checks 
      WHERE checked_at < datetime('now', '-' || ? || ' days')
    `).run(days);
  }
};

// 告警配置
const alerts = {
  create: (endpoint_id, type, target) => {
    const stmt = db.prepare('INSERT INTO alerts (endpoint_id, type, target) VALUES (?, ?, ?)');
    return stmt.run(endpoint_id, type, target);
  },

  getByEndpoint: (endpoint_id) => {
    return db.prepare('SELECT * FROM alerts WHERE endpoint_id = ?').all(endpoint_id);
  },

  getAll: () => {
    return db.prepare(`
      SELECT a.*, e.name as endpoint_name, e.url as endpoint_url
      FROM alerts a
      JOIN endpoints e ON a.endpoint_id = e.id
    `).all();
  },

  delete: (id) => {
    return db.prepare('DELETE FROM alerts WHERE id = ?').run(id);
  }
};

// 初始化
initDB();

module.exports = { db, endpoints, healthChecks, alerts };
