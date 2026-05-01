const https = require('https');
const http = require('http');
const { URL } = require('url');
const cron = require('node-cron');
const { healthChecks, alerts } = require('./db');

// 简单的HTTP请求函数
function fetchUrl(targetUrl, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const startTime = Date.now();
    
    const req = protocol.get(targetUrl, (res) => {
      // 立即消耗响应体以避免内存泄漏，但不需要处理数据
      res.on('data', () => {});
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          responseTime,
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });
    
    // 设置超时
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// 发送告警
async function sendAlert(alert, checkResult) {
  const { type, target } = alert;
  
  if (type === 'email') {
    console.log(`[ALERT] Email to ${target}: Endpoint ${checkResult.endpointName} is down!`);
    // 实际实现需要邮件服务，这里仅记录日志
  } else if (type === 'webhook') {
    try {
      await fetchUrl(target, 5000);
      console.log(`[ALERT] Webhook sent to ${target}`);
    } catch (err) {
      console.error(`[ALERT] Failed to send webhook: ${err.message}`);
    }
  }
}

// 检查单个端点
async function checkEndpoint(endpoint) {
  const startTime = Date.now();
  let result = {
    endpoint_id: endpoint.id,
    status_code: null,
    response_time_ms: null,
    is_success: false,
    error_message: null
  };
  
  try {
    const response = await fetchUrl(endpoint.url, 10000);
    result.status_code = response.statusCode;
    result.response_time_ms = response.responseTime;
    result.is_success = response.success;
    result.error_message = null;
  } catch (err) {
    result.response_time_ms = Date.now() - startTime;
    result.error_message = err.message;
    result.is_success = false;
  }
  
  // 记录到数据库
  healthChecks.create(
    endpoint.id,
    result.status_code,
    result.response_time_ms,
    result.is_success,
    result.error_message
  );
  
  // 如果失败，发送告警
  if (!result.is_success && result.error_message) {
    try {
      const endpointAlerts = alerts.getByEndpoint(endpoint.id);
      for (const alert of endpointAlerts) {
        await sendAlert(alert, {
          endpointName: endpoint.name,
          error: result.error_message,
          statusCode: result.status_code
        });
      }
    } catch (alertErr) {
      console.error(`[Monitor] Alert error: ${alertErr.message}`);
    }
  }
  
  return result;
}

// 监控引擎
class MonitorEngine {
  constructor() {
    this.jobs = new Map(); // endpoint_id -> cron task
    this.isRunning = false;
  }
  
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Monitor] Engine started');
    this.scheduleAllEndpoints();
  }
  
  stop() {
    this.isRunning = false;
    for (const [id, task] of this.jobs) {
      task.stop();
    }
    this.jobs.clear();
    console.log('[Monitor] Engine stopped');
  }
  
  scheduleEndpoint(endpoint) {
    // 移除旧任务
    if (this.jobs.has(endpoint.id)) {
      this.jobs.get(endpoint.id).stop();
    }
    
    // 创建新的cron任务
    const cronExpr = `*/${endpoint.interval_minutes} * * * *`;
    
    const task = cron.schedule(cronExpr, async () => {
      try {
        await checkEndpoint(endpoint);
      } catch (err) {
        console.error(`[Monitor] Error checking ${endpoint.name}:`, err.message);
      }
    });
    
    this.jobs.set(endpoint.id, task);
    console.log(`[Monitor] Scheduled ${endpoint.name} (${endpoint.url}) every ${endpoint.interval_minutes} minutes`);
  }
  
  scheduleAllEndpoints() {
    const { endpoints } = require('./db');
    const allEndpoints = endpoints.getAll();
    
    for (const endpoint of allEndpoints) {
      this.scheduleEndpoint(endpoint);
    }
  }
  
  addEndpoint(endpoint) {
    if (this.isRunning) {
      this.scheduleEndpoint(endpoint);
    }
  }
  
  removeEndpoint(endpointId) {
    if (this.jobs.has(endpointId)) {
      this.jobs.get(endpointId).stop();
      this.jobs.delete(endpointId);
      console.log(`[Monitor] Removed job for endpoint ${endpointId}`);
    }
  }
  
  updateEndpoint(endpoint) {
    if (this.isRunning) {
      this.scheduleEndpoint(endpoint);
    }
  }
  
  // 手动触发一次检查
  async checkNow(endpoint) {
    console.log(`[Monitor] Manual check for ${endpoint.name}`);
    return await checkEndpoint(endpoint);
  }
}

module.exports = { MonitorEngine, checkEndpoint };
