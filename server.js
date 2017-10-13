const startServer = require("./index.js").startServer;

startServer({ host: "0.0.0.0", port: process.env.PORT });

