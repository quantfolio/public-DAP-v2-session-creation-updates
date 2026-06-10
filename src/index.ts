/// <reference types="vite/client" />
import express from "express";
import { router } from "./routes.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use("/api", router);

app.get("/", (_req, res) => {
  res.json({ name: "performativ-poc", status: "ok" });
});

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

// Hot reload (vite-node --watch): close the old server before the module is
// re-evaluated, otherwise app.listen() hits EADDRINUSE on the next reload.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    server.close();
  });
}
