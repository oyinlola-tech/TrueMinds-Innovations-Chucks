const express = require("express");
const usersRouter = require("./routes/users");
const foodsRouter = require("./routes/foods");
const cartsRouter = require("./routes/carts");
const ordersRouter = require("./routes/orders");

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Chuks Kitchen backend is running."
  });
});

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
