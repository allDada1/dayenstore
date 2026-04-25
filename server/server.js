const { createApp } = require("./create-app");

const PORT = process.env.PORT || 3000;
const app = createApp({ serveStatic: true });

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
