require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

// This export is required for Vercel
module.exports = app;

// Start a local listener when run directly. Vercel imports the app above.
if (require.main === module) {
  const server = app.listen(PORT);

  server.once('listening', () => {
    console.log(`Server is running on port ${server.address().port}`);
  });

  server.once('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the existing server or set PORT to a free port.`);
    } else {
      console.error('Could not start the ZapRoll backend:', error.message);
    }
    process.exitCode = 1;
  });
}
