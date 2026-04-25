const serverless = require("serverless-http");
const { createApp } = require("../../server/create-app");

const app = createApp({ serveStatic: false });

module.exports.handler = serverless(app);
