// This script provides a graceful shutdown mechanism for the Next.js standalone server.
// The default standalone server does not handle SIGTERM signals, causing abrupt shutdowns
// in containerized environments like Docker.
// This wrapper uses a "monkey-patching" technique to grab the server instance
// once it's created by the Next.js server, and then adds signal handlers to it.

const http = require('http');

let server;

// Monkey-patch the http.Server.prototype.listen method.
// When the Next.js standalone server calls .listen(), this patched version
// will execute, giving us a reference to the server instance.
const originalListen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) {
  console.log('> Starting server...');
  server = this;
  return originalListen.apply(this, args);
};

// Now that listen is patched, we can require the actual Next.js standalone server.
// This will trigger the patched listen method above.
require('./server.js');

const gracefulShutdown = (signal) => {
  console.log(`> Received ${signal}, shutting down gracefully...`);
  if (server) {
    server.close((err) => {
      if (err) {
        console.error('> Error during server shutdown:', err);
        process.exit(1);
      }
      console.log('> Server closed successfully.');
      process.exit(0);
    });

    // Force shutdown after a timeout if connections are hanging.
    setTimeout(() => {
      console.error('> Could not close connections in time, forcefully shutting down.');
      process.exit(1);
    }, 15000); // 15 seconds timeout
  } else {
    console.log('> No active server to shut down.');
    process.exit(0);
  }
};

// Listen for the signals that container orchestrators send.
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Listen for the signal sent by Ctrl+C in a terminal.
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
