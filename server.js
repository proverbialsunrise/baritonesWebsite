import { createApp } from './app.js';

const port = Number(process.env.PORT || process.env.BariPORT || 4952);
const host = process.env.HOST || '127.0.0.1';

const app = createApp();
const server = app.listen(port, host, () => {
  console.log(`Baritones website is running on http://${host}:${server.address().port}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
