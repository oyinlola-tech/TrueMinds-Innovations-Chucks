const express = require("express");
const store = require("../data/store");
const { createId, nowIso } = require("../utils/helpers");

const router = express.Router();

const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Out for Delivery",
  "Completed",
  "Cancelled"
];

function canMoveToNextStatus(current, next) {
  if (next === "Cancelled") return current !== "Completed";
  const currentIndex = ORDER_STATUSES.indexOf(current);
  const nextIndex = ORDER_STATUSES.indexOf(next);
  return nextIndex === currentIndex + 1;
}

router.post("/orders", (req, res) => {
  const { userId, paymentCompleted = true } = req.body;
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId is required."
    });
  }

  const user = store.users.find((item) => item.id === userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }

  const cart = store.carts.find((item) => item.userId === userId);
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Cannot place order: cart is empty."
    });
  }

  for (const item of cart.items) {
    const latestFood = store.foods.find((food) => food.id === item.foodId);
    if (!latestFood || !latestFood.isAvailable) {
      return res.status(409).json({
        success: false,
        message: `Food '${item.name}' became unavailable after being added to cart.`
      });
    }
    item.unitPrice = latestFood.price;
    item.lineTotal = latestFood.price * item.quantity;
    item.name = latestFood.name;
  }

  if (!paymentCompleted) {
    return res.status(402).json({
      success: false,
      message: "Payment not completed. Order creation blocked by business rule."
    });
  }

  const totalPrice = cart.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const order = {
    id: createId("order"),
    userId,
    items: [...cart.items],
    totalPrice,
    currency: "NGN",
    status: "Pending",
    statusHistory: [{ status: "Pending", updatedAt: nowIso(), updatedBy: "system" }],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  store.orders.push(order);
  cart.items = [];
  cart.updatedAt = nowIso();

  return res.status(201).json({
    success: true,
    message: "Order created successfully.",
    data: order
  });
});

router.get("/orders/:id", (req, res) => {
  const order = store.orders.find((item) => item.id === req.params.id);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found."
    });
  }
  return res.status(200).json({
    success: true,
    data: order
  });
});

router.patch("/orders/:id/status", (req, res) => {
  const { status, actor = "admin" } = req.body;
  if (!status || !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Valid values: ${ORDER_STATUSES.join(", ")}`
    });
  }

  const order = store.orders.find((item) => item.id === req.params.id);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found."
    });
  }

  if (order.status === "Cancelled" || order.status === "Completed") {
    return res.status(409).json({
      success: false,
      message: `Status cannot be changed from ${order.status}.`
    });
  }

  if (!canMoveToNextStatus(order.status, status)) {
    return res.status(409).json({
      success: false,
      message: `Invalid transition from ${order.status} to ${status}.`
    });
  }

  order.status = status;
  order.updatedAt = nowIso();
  order.statusHistory.push({
    status,
    updatedAt: nowIso(),
    updatedBy: actor
  });

  return res.status(200).json({
    success: true,
    message: "Order status updated.",
    data: order
  });
});

router.post("/orders/:id/cancel", (req, res) => {
  const { actor = "customer" } = req.body;
  const order = store.orders.find((item) => item.id === req.params.id);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found."
    });
  }

  if (order.status === "Completed") {
    return res.status(409).json({
      success: false,
      message: "Completed order cannot be cancelled."
    });
  }

  if (order.status === "Cancelled") {
    return res.status(409).json({
      success: false,
      message: "Order is already cancelled."
    });
  }

  order.status = "Cancelled";
  order.updatedAt = nowIso();
  order.statusHistory.push({
    status: "Cancelled",
    updatedAt: nowIso(),
    updatedBy: actor
  });

  return res.status(200).json({
    success: true,
    message: "Order cancelled successfully.",
    data: order
  });
});

module.exports = router;
