module.exports = {
  '/api/**': {
    target: process.env.LOCAL_API_URL || 'http://127.0.0.1:8000',
    secure: false,
    pathRewrite: { '^/api': '' },
  },
};