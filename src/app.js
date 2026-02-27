const express = require("express");
const fs = require("fs");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const usersRouter = require("./routes/users");
const foodsRouter = require("./routes/foods");
const cartsRouter = require("./routes/carts");
const ordersRouter = require("./routes/orders");

const app = express();

app.use(express.json());

const swaggerPath = path.join(__dirname, "../docs/openapi.json");
const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Chuks Kitchen backend is running."
  });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/api", usersRouter);
app.use("/api", foodsRouter);
app.use("/api", cartsRouter);
app.use("/api", ordersRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

module.exports = app;
