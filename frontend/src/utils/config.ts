// src/utils/config.ts
const config = {
  // 开发环境
  development: {
    API_BASE_URL: 'http://localhost:8855'
  },
  // 生产环境
  production: {
    API_BASE_URL: 'https://api.yourdomain.com'
  }
};

// 根据当前环境选择配置
const env = process.env.NODE_ENV || 'development';
export const API_CONFIG = config[env as keyof typeof config];

// 默认导出当前环境的API基础URL
export default API_CONFIG.API_BASE_URL;
