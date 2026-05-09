require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

// This export is required for Vercel
module.exports = app;

// Listen only if not in production or if running directly (not via Vercel serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
