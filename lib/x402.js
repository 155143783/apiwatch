/**
 * x402 支付中间件
 * 支持通过 x402 协议进行付费API访问
 */

// x402 协议头部
const X402_HEADER = 'x402-response';
const X402_MAX_UNITS = 'x402-max-units';

// 价格配置 (单位：毫ox)
const PRICING = {
  dashboard: 0,           // 仪表盘免费
  list_endpoints: 0,      // 列出端点免费
  add_endpoint: 0,        // 添加端点免费（有限额）
  get_stats: 1000,       // 获取统计数据 - 1毫ox
  get_health_history: 1000,  // 健康历史 - 1毫ox
  public_status_page: 0   // 公开状态页免费
};

// 检查x402支付
function checkX402Payment(req) {
  const responseAddr = req.headers['x402-response'];
  const maxUnits = parseInt(req.headers[X402_MAX_UNITS] || '0', 10);
  
  return {
    hasPayment: !!responseAddr,
    responseAddr,
    maxUnits
  };
}

// x402中间件生成器
function x402Require(price) {
  return (req, res, next) => {
    const payment = checkX402Payment(req);
    
    // 免费接口直接通过
    if (price === 0) {
      return next();
    }
    
    // 检查是否已支付
    if (!payment.hasPayment) {
      return res.status(402).json({
        error: 'Payment required',
        price: price,
        unit: 'milliox',
        message: `This endpoint requires payment of ${price} milliox`,
        instructions: {
          'x402-response': 'Your x402 payment address',
          'x402-max-units': 'Maximum units to pay (optional)'
        }
      });
    }
    
    // 附加支付信息到请求
    req.x402Payment = {
      price,
      responseAddr: payment.responseAddr,
      maxUnits: payment.maxUnits
    };
    
    next();
  };
}

// 生成x402响应头
function generateX402Headers(price) {
  return {
    'x402-price': price.toString(),
    'x402-unit': 'milliox'
  };
}

module.exports = {
  x402Require,
  checkX402Payment,
  generateX402Headers,
  PRICING
};
