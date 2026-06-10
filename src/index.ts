import express from "express";
import { router } from "./routes.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use("/api", router);

app.get("/", (_req, res) => {
  res.json({ name: "performativ-poc", status: "ok" });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
