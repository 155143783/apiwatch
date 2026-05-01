# APIWatch - API健康监控服务

<div align="center">

![APIWatch](https://img.shields.io/badge/Version-1.0.0-blue)
![Node](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

**简洁、高效、开源的API健康监控解决方案**

</div>

## ✨ 特性

- 🌐 **多端点监控** - 同时监控多个API端点的可用性
- 📊 **响应时间图表** - 可视化展示API响应时间趋势
- ⚡ **实时告警** - 端点异常时自动发送邮件/Webhook通知
- 🔒 **隐私优先** - 数据存储在本地SQLite，无需云数据库
- 💰 **x402集成** - 支持加密货币微支付
- 🚀 **零依赖前端** - 纯HTML+CSS+JS，无需构建工具

## 📦 快速开始

### 安装

```bash
# 克隆项目
git clone https://github.com/155143783/apiwatch.git
cd apiwatch

# 安装依赖
npm install

# 启动服务
npm start
```

### 访问

服务启动后，打开浏览器访问: http://localhost:3003

## 🛠 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 数据库 | SQLite (better-sqlite3) |
| 定时任务 | node-cron |
| 前端 | 纯 HTML/CSS/JS |
| CSS框架 | Water.css |

## 📁 项目结构

```
apiwatch/
├── server.js           # Express服务器
├── package.json
├── data/               # SQLite数据库目录
│   └── apiwatch.db     # 数据库文件
├── lib/
│   ├── db.js           # 数据库操作
│   ├── monitor.js      # 监控引擎
│   └── x402.js         # x402支付中间件
├── public/
│   ├── index.html      # 主页面
│   ├── style.css       # 样式
│   └── app.js          # 前端逻辑
└── README.md
```

## 🚀 API 接口

### 端点管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/dashboard` | 获取仪表盘数据 |
| GET | `/api/endpoints` | 列出所有端点 |
| POST | `/api/endpoints` | 添加新端点 |
| GET | `/api/endpoints/:id` | 获取端点详情 |
| PUT | `/api/endpoints/:id` | 更新端点 |
| DELETE | `/api/endpoints/:id` | 删除端点 |
| POST | `/api/endpoints/:id/check` | 手动触发检查 |

### 付费接口 (x402)

| 方法 | 路径 | 价格 | 描述 |
|------|------|------|------|
| GET | `/api/stats/:id` | 1 毫ox | 获取统计数据 |
| GET | `/api/history/:id` | 1 毫ox | 获取健康历史 |

### 告警配置

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/alerts` | 列出所有告警 |
| POST | `/api/alerts` | 添加告警 |
| DELETE | `/api/alerts/:id` | 删除告警 |

## 💰 定价方案

| 功能 | Free | Pro ($9/月) | Enterprise ($49/月) |
|------|------|-------------|---------------------|
| 端点数量 | 3 | 20 | 无限 |
| 检测间隔 | 5分钟 | 1分钟 | 30秒 |
| 邮件告警 | ❌ | ✅ | ✅ |
| Webhook告警 | ❌ | ❌ | ✅ |
| 详细统计 | 基础 | 完整 | 完整 |

## 🔧 配置

### 环境变量

```bash
PORT=3003              # 服务端口
```

### 数据库

数据库文件位于 `data/apiwatch.db`，首次启动时自动创建。

## 🌐 部署

### 本地部署

```bash
npm start
```

### Vercel 部署

需要使用 Serverless 函数适配，或使用云服务器。

### Cloudflare Tunnel

```bash
# 安装 cloudflared
brew install cloudflared

# 创建隧道
cloudflared tunnel --url http://localhost:3003
```

## 🔒 x402 集成

APIWatch 支持通过 x402 协议进行付费API访问。使用示例:

```bash
curl -X GET http://localhost:3003/api/stats/1 \
  -H "x402-response: your_payment_address" \
  -H "x402-max-units: 100"
```

## 📊 监控逻辑

1. 每个端点按配置的间隔时间定期检查
2. 检查请求的超时时间为10秒
3. HTTP状态码2xx-3xx视为成功
4. 失败时自动触发告警（如已配置）
5. 历史记录保留7天

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT License - 详见 [LICENSE](LICENSE) 文件

---

<div align="center">

**Made with ❤️ for developers**

</div>
