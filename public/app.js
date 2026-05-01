// APIWatch Frontend Application

const API_BASE = '/api';

// 状态
let endpoints = [];
let chart = null;

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  setupEventListeners();
  
  // 每30秒刷新一次
  setInterval(loadDashboard, 30000);
});

// ==================== 事件监听 ====================

function setupEventListeners() {
  document.getElementById('addEndpointBtn').addEventListener('click', () => {
    openModal();
  });
  
  document.getElementById('endpointForm').addEventListener('submit', handleEndpointSubmit);
}

// ==================== 数据加载 ====================

async function loadDashboard() {
  try {
    const response = await fetch(`${API_BASE}/dashboard`);
    const data = await response.json();
    
    endpoints = data.endpoints;
    updateStats(data.summary);
    renderEndpoints(endpoints);
    updateChart(endpoints);
  } catch (err) {
    console.error('Failed to load dashboard:', err);
    showError('加载数据失败');
  }
}

// ==================== UI 更新 ====================

function updateStats(summary) {
  document.getElementById('totalEndpoints').textContent = summary.totalEndpoints;
  document.getElementById('healthyCount').textContent = summary.healthyCount;
  document.getElementById('avgUptime').textContent = summary.avgUptime + '%';
  document.getElementById('failureCount').textContent = summary.recentFailures.length;
}

function renderEndpoints(eps) {
  const container = document.getElementById('endpointsList');
  
  if (eps.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📡</div>
        <p>暂无监控端点</p>
        <p>点击"添加端点"开始监控您的API</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = eps.map(ep => {
    const uptimeClass = ep.uptime >= 99 ? 'uptime-good' : ep.uptime >= 95 ? 'uptime-warn' : 'uptime-bad';
    const statusClass = ep.uptime >= 99 ? 'status-healthy' : 'status-down';
    const lastCheck = ep.lastCheck;
    const lastCheckText = lastCheck 
      ? formatTimeAgo(lastCheck.checked_at)
      : '暂无检查记录';
    
    return `
      <div class="endpoint-card" onclick="showEndpointDetail(${ep.id})">
        <div class="endpoint-info">
          <div class="endpoint-name">
            <span class="status-indicator ${statusClass}"></span>
            ${escapeHtml(ep.name)}
          </div>
          <div class="endpoint-url">${escapeHtml(ep.url)}</div>
        </div>
        <div class="endpoint-stats">
          <div class="endpoint-stat">
            <div class="endpoint-stat-value ${uptimeClass}">${ep.uptime}%</div>
            <div class="endpoint-stat-label">可用率</div>
          </div>
          <div class="endpoint-stat">
            <div class="endpoint-stat-value">${ep.avgResponseTime}ms</div>
            <div class="endpoint-stat-label">平均响应</div>
          </div>
          <div class="endpoint-stat">
            <div class="endpoint-stat-value">${ep.totalChecks}</div>
            <div class="endpoint-stat-label">检查次数</div>
          </div>
        </div>
        <div class="endpoint-meta">
          <small>${lastCheckText}</small>
        </div>
        <div class="endpoint-actions">
          <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); triggerCheck(${ep.id})" title="立即检查">
            🔄
          </button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteEndpoint(${ep.id})" title="删除">
            🗑
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== 图表 ====================

function updateChart(eps) {
  const canvas = document.getElementById('responseTimeChart');
  const ctx = canvas.getContext('2d');
  
  if (!eps.length) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  
  // 简单的Canvas图表（不用Chart.js减小体积）
  const width = canvas.parentElement.clientWidth;
  const height = 280;
  canvas.width = width;
  canvas.height = height;
  
  // 获取所有端点的响应时间数据
  const allData = eps.map(ep => ({
    name: ep.name,
    data: (ep.lastCheck ? [ep.lastCheck.response_time_ms] : [0])
  }));
  
  const maxValue = Math.max(...allData.map(d => Math.max(...d.data, 100)), 100);
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  
  // 绘制
  ctx.clearRect(0, 0, width, height);
  
  // 绘制网格线
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = 40 + (height - 60) * i / 4;
    ctx.beginPath();
    ctx.moveTo(50, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
    
    // Y轴标签
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    const value = Math.round(maxValue * (4 - i) / 4);
    ctx.fillText(value + 'ms', 45, y + 4);
  }
  
  // 绘制每个端点的响应时间条形
  const barWidth = Math.min(60, (width - 80) / eps.length - 10);
  const startX = (width - eps.length * (barWidth + 10)) / 2;
  
  eps.forEach((ep, i) => {
    const x = startX + i * (barWidth + 10);
    const responseTime = ep.lastCheck?.response_time_ms || 0;
    const barHeight = responseTime > 0 ? ((responseTime / maxValue) * (height - 60)) : 2;
    const y = height - 30 - barHeight;
    
    // 颜色基于响应时间
    let color = '#10b981'; // 绿色 - 快速
    if (responseTime > 1000) color = '#f59e0b'; // 黄色 - 中等
    if (responseTime > 3000) color = '#ef4444'; // 红色 - 慢
    
    // 绘制条形
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
    ctx.fill();
    
    // 绘制标签
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const label = ep.name.length > 8 ? ep.name.substring(0, 6) + '..' : ep.name;
    ctx.fillText(label, x + barWidth / 2, height - 10);
    
    // 绘制数值
    if (responseTime > 0) {
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(responseTime + 'ms', x + barWidth / 2, y - 5);
    }
  });
  
  // 窗口大小改变时重绘
  window.addEventListener('resize', () => {
    if (endpoints.length) {
      updateChart(endpoints);
    }
  });
}

// ==================== 端点详情 ====================

async function showEndpointDetail(id) {
  const modal = document.getElementById('detailModal');
  const content = document.getElementById('detailContent');
  
  modal.classList.add('active');
  
  try {
    const response = await fetch(`${API_BASE}/endpoints/${id}`);
    const data = await response.json();
    
    document.getElementById('detailTitle').textContent = data.name;
    
    const uptime = data.stats.total > 0 
      ? (data.stats.success_count / data.stats.total * 100).toFixed(2) 
      : 100;
    
    content.innerHTML = `
      <div class="detail-header">
        <div>
          <div class="detail-title">${escapeHtml(data.name)}</div>
          <div class="detail-url">${escapeHtml(data.url)}</div>
        </div>
        <div>
          <span class="tier-badge ${data.tier}">${data.tier}</span>
        </div>
      </div>
      
      <div class="detail-stats">
        <div class="detail-stat">
          <div class="detail-stat-value ${uptime >= 99 ? 'uptime-good' : uptime >= 95 ? 'uptime-warn' : 'uptime-bad'}">${uptime}%</div>
          <div class="detail-stat-label">24小时可用率</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-value">${Math.round(data.stats.avg_response_time || 0)}ms</div>
          <div class="detail-stat-label">平均响应</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-value">${data.stats.total}</div>
          <div class="detail-stat-label">检查次数</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-value">${Math.round(data.stats.min_response_time || 0)}ms</div>
          <div class="detail-stat-label">最快响应</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-value">${Math.round(data.stats.max_response_time || 0)}ms</div>
          <div class="detail-stat-label">最慢响应</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-value">${data.interval_minutes}m</div>
          <div class="detail-stat-label">检测间隔</div>
        </div>
      </div>
      
      <h4 style="margin: 1.5rem 0 1rem;">最近检查记录</h4>
      <div class="check-history">
        ${data.recentChecks.map(check => `
          <div class="check-item">
            <span class="check-status ${check.is_success ? 'success' : 'error'}">
              ${check.is_success ? '成功' : '失败'}
            </span>
            <span class="check-time">${formatTimeAgo(check.checked_at)}</span>
            <span class="check-response-time">${check.response_time_ms || '-'}ms</span>
            <span style="color: #64748b; font-size: 0.75rem;">${check.status_code || 'N/A'}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p class="error">加载详情失败: ${err.message}</p>`;
  }
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('active');
}

// ==================== 端点管理 ====================

function openModal(endpoint = null) {
  const modal = document.getElementById('endpointModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('endpointForm');
  
  if (endpoint) {
    title.textContent = '编辑端点';
    document.getElementById('endpointId').value = endpoint.id;
    document.getElementById('endpointName').value = endpoint.name;
    document.getElementById('endpointUrl').value = endpoint.url;
    document.getElementById('intervalMinutes').value = endpoint.interval_minutes;
  } else {
    title.textContent = '添加端点';
    form.reset();
    document.getElementById('endpointId').value = '';
  }
  
  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('endpointModal').classList.remove('active');
}

async function handleEndpointSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('endpointId').value;
  const name = document.getElementById('endpointName').value.trim();
  const url = document.getElementById('endpointUrl').value.trim();
  const interval = parseInt(document.getElementById('intervalMinutes').value);
  
  try {
    let response;
    
    if (id) {
      response = await fetch(`${API_BASE}/endpoints/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, interval_minutes: interval })
      });
    } else {
      response = await fetch(`${API_BASE}/endpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, interval_minutes: interval })
      });
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 403) {
        showUpgradeModal();
        return;
      }
      throw new Error(data.error || '操作失败');
    }
    
    closeModal();
    loadDashboard();
  } catch (err) {
    alert('错误: ' + err.message);
  }
}

async function deleteEndpoint(id) {
  if (!confirm('确定要删除这个端点吗？')) return;
  
  try {
    const response = await fetch(`${API_BASE}/endpoints/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('删除失败');
    }
    
    loadDashboard();
  } catch (err) {
    alert('错误: ' + err.message);
  }
}

async function triggerCheck(id) {
  try {
    const response = await fetch(`${API_BASE}/endpoints/${id}/check`, {
      method: 'POST'
    });
    const data = await response.json();
    
    alert(`检查完成: ${data.is_success ? '成功' : '失败'}\n响应时间: ${data.response_time_ms}ms\n状态码: ${data.status_code || 'N/A'}`);
    
    loadDashboard();
  } catch (err) {
    alert('错误: ' + err.message);
  }
}

// ==================== 升级弹窗 ====================

function showUpgradeModal() {
  document.getElementById('upgradeModal').classList.add('active');
}

function closeUpgradeModal() {
  document.getElementById('upgradeModal').classList.remove('active');
}

// ==================== 工具函数 ====================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  return Math.floor(diff / 86400) + '天前';
}

function showError(message) {
  const container = document.getElementById('endpointsList');
  container.innerHTML = `<div class="error" style="color: var(--danger); padding: 2rem; text-align: center;">${escapeHtml(message)}</div>`;
}

// 点击弹窗外部关闭
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});
