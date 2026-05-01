const express = require('express');
const path = require('path');
const { endpoints, healthChecks, alerts } = require('./lib/db');
const { MonitorEngine } = require('./lib/monitor');
const { x402Require, generateX402Headers, PRICING } = require('./lib/x402');

const app = express();
const PORT = process.env.PORT || 3003;

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 初始化监控引擎
const monitor = new MonitorEngine();

// ==================== API 路由 ====================

// 健康检查（根路径）
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'apiwatch', timestamp: new Date().toISOString() });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 仪表盘数据 (免费)
app.get('/api/dashboard', (req, res) => {
  const allEndpoints = endpoints.getAll();
  const recentFailures = healthChecks.getRecentFailures(5);
  
  const endpointStats = allEndpoints.map(ep => {
    const stats = healthChecks.getStats(ep.id, 24);
    const uptime = stats.total > 0 ? (stats.success_count / stats.total * 100).toFixed(2) : 100;
    return {
      ...ep,
      uptime: parseFloat(uptime),
      avgResponseTime: Math.round(stats.avg_response_time || 0),
      totalChecks: stats.total,
      lastCheck: healthChecks.getByEndpoint(ep.id, 1)[0]
    };
  });
  
  const totalEndpoints = endpointStats.length;
  const healthyCount = endpointStats.filter(ep => ep.uptime >= 99).length;
  const avgUptime = totalEndpoints > 0 
    ? (endpointStats.reduce((sum, ep) => sum + ep.uptime, 0) / totalEndpoints).toFixed(2) 
    : 100;
  
  res.json({
    endpoints: endpointStats,
    summary: {
      totalEndpoints,
      healthyCount,
      avgUptime: parseFloat(avgUptime),
      recentFailures
    }
  });
});

// 列出端点 (免费)
app.get('/api/endpoints', (req, res) => {
  const allEndpoints = endpoints.getAll();
  res.json({ endpoints: allEndpoints, count: allEndpoints.length });
});

// 获取单个端点详情
app.get('/api/endpoints/:id', (req, res) => {
  const endpoint = endpoints.getById(parseInt(req.params.id));
  if (!endpoint) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  
  const stats = healthChecks.getStats(endpoint.id, 24);
  const recentChecks = healthChecks.getByEndpoint(endpoint.id, 50);
  const endpointAlerts = alerts.getByEndpoint(endpoint.id);
  
  res.json({
    ...endpoint,
    stats,
    recentChecks,
    alerts: endpointAlerts
  });
});

// 添加端点 (免费用户限3个)
app.post('/api/endpoints', (req, res) => {
  const { name, url, interval_minutes = 5 } = req.body;
  
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }
  
  // 检查端点数量限制
  const currentCount = endpoints.count();
  if (currentCount >= 3) {
    return res.status(403).json({ 
      error: 'Free tier limit reached',
      message: 'Upgrade to Pro to add more endpoints',
      current: currentCount,
      limit: 3
    });
  }
  
  try {
    const id = endpoints.create(name, url, interval_minutes);
    const endpoint = endpoints.getById(id);
    monitor.addEndpoint(endpoint);
    res.status(201).json(endpoint);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'URL already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// 更新端点
app.put('/api/endpoints/:id', (req, res) => {
  const { name, url, interval_minutes } = req.body;
  const id = parseInt(req.params.id);
  
  const existing = endpoints.getById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  
  try {
    endpoints.update(id, { name, url, interval_minutes });
    const updated = endpoints.getById(id);
    monitor.updateEndpoint(updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除端点
app.delete('/api/endpoints/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = endpoints.getById(id);
  
  if (!existing) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  
  endpoints.delete(id);
  monitor.removeEndpoint(id);
  res.json({ success: true });
});

// 手动触发检查 (免费用户限每分钟1次)
app.post('/api/endpoints/:id/check', async (req, res) => {
  const id = parseInt(req.params.id);
  const endpoint = endpoints.getById(id);
  
  if (!endpoint) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  
  try {
    const result = await monitor.checkNow(endpoint);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取统计数据 (付费 - x402)
app.get('/api/stats/:id', x402Require(PRICING.get_stats), (req, res) => {
  const id = parseInt(req.params.id);
  const hours = parseInt(req.query.hours || '24');
  const endpoint = endpoints.getById(id);
  
  if (!endpoint) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  
  const stats = healthChecks.getStats(id, hours);
  res.set(generateX402Headers(PRICING.get_stats));
  res.json({ endpoint, stats, period: `${hours} hours` });
});

// 获取健康历史 (付费 - x402)
app.get('/api/history/:id', x402Require(PRICING.get_health_history), (req, res) => {
  const id = parseInt(req.params.id);
  const limit = parseInt(req.query.limit || '100');
  const endpoint = endpoints.getById(id);
  
  if (!endpoint) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  
  const history = healthChecks.getByEndpoint(id, limit);
  res.set(generateX402Headers(PRICING.get_health_history));
  res.json({ endpoint, history, count: history.length });
});

// 公开状态页 (免费)
app.get('/api/status/:slug', (req, res) => {
  const slug = req.params.slug;
  const allEndpoints = endpoints.getAll();
  const endpoint = allEndpoints.find(ep => ep.name.toLowerCase().replace(/\s+/g, '-') === slug);
  
  if (!endpoint) {
    return res.status(404).json({ error: 'Status page not found' });
  }
  
  const stats = healthChecks.getStats(endpoint.id, 24);
  const recentChecks = healthChecks.getByEndpoint(endpoint.id, 20);
  const uptime = stats.total > 0 ? (stats.success_count / stats.total * 100).toFixed(2) : 100;
  
  res.json({
    endpoint: {
      name: endpoint.name,
      url: endpoint.url
    },
    status: uptime >= 99 ? 'healthy' : uptime >= 95 ? 'degraded' : 'down',
    uptime: parseFloat(uptime),
    avgResponseTime: Math.round(stats.avg_response_time || 0),
    lastCheck: recentChecks[0],
    history: recentChecks
  });
});

// 告警管理
app.post('/api/alerts', (req, res) => {
  const { endpoint_id, type, target } = req.body;
  
  if (!endpoint_id || !type || !target) {
    return res.status(400).json({ error: 'endpoint_id, type, and target are required' });
  }
  
  const endpoint = endpoints.getById(parseInt(endpoint_id));
  if (!endpoint) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  
  try {
    const id = alerts.create(endpoint_id, type, target);
    res.status(201).json({ id, endpoint_id, type, target });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/alerts/:id', (req, res) => {
  const id = parseInt(req.params.id);
  alerts.delete(id);
  res.json({ success: true });
});

app.get('/api/alerts', (req, res) => {
  const allAlerts = alerts.getAll();
  res.json({ alerts: allAlerts });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║        APIWatch - API健康监控服务            ║
╠══════════════════════════════════════════════╣
║  🌐 Dashboard: http://localhost:${PORT}        ║
║  📡 API: http://localhost:${PORT}/api          ║
║  📊 Status Page: http://localhost:${PORT}/api  ║
╠══════════════════════════════════════════════╣
║  免费版: 3个端点, 5分钟检测间隔              ║
║  Pro $9/月: 20个端点, 1分钟间隔, 邮件告警     ║
║  Enterprise $49/月: 无限端点, 30秒间隔      ║
╚══════════════════════════════════════════════╝
  `);
  
  // 启动监控引擎
  monitor.start();
  
  // 定期清理旧数据 (每天)
  setInterval(() => {
    healthChecks.cleanup(7);
    console.log('[Cleanup] Old health check records removed');
  }, 86400000);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[Server] Shutting down...');
  monitor.stop();
  process.exit(0);
});
