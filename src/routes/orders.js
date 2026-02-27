const express = require("express");
const { run, get, all, exec } = require("../data/db");
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

async function getOrderById(orderId) {
  const order = await get(
    `SELECT id, user_id AS userId, total_price AS totalPrice, currency, status, created_at AS createdAt, updated_at AS updatedAt
     FROM orders
     WHERE id = ?`,
    [orderId]
  );
  if (!order) return null;

  const items = await all(
    `SELECT food_id AS foodId, name, unit_price AS unitPrice, quantity, line_total AS lineTotal
     FROM order_items
     WHERE order_id = ?`,
    [orderId]
  );
  const statusHistory = await all(
    `SELECT status, updated_at AS updatedAt, updated_by AS updatedBy
     FROM order_status_history
     WHERE order_id = ?
     ORDER BY id ASC`,
    [orderId]
  );

  return {
    ...order,
    items,
    statusHistory
  };
}

router.post("/orders", async (req, res) => {
  const { userId, paymentCompleted = true } = req.body;
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId is required."
    });
  }

  try {
    const user = await get(`SELECT id FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const cart = await get(`SELECT id FROM carts WHERE user_id = ? LIMIT 1`, [userId]);
    if (!cart) {
      return res.status(400).json({
        success: false,
        message: "Cannot place order: cart is empty."
      });
    }

    const cartItems = await all(
      `SELECT id, food_id AS foodId, name, unit_price AS unitPrice, quantity, line_total AS lineTotal
       FROM cart_items
       WHERE cart_id = ?`,
      [cart.id]
    );

    if (!cartItems.length) {
      return res.status(400).json({
        success: false,
        message: "Cannot place order: cart is empty."
      });
    }

    for (const item of cartItems) {
      const latestFood = await get(
        `SELECT id, name, price, is_available AS isAvailable FROM foods WHERE id = ? LIMIT 1`,
        [item.foodId]
      );
      if (!latestFood || !latestFood.isAvailable) {
        return res.status(409).json({
          success: false,
          message: `Food '${item.name}' became unavailable after being added to cart.`
        });
      }
      const lineTotal = latestFood.price * item.quantity;
      await run(`UPDATE cart_items SET name = ?, unit_price = ?, line_total = ? WHERE id = ?`, [
        latestFood.name,
        latestFood.price,
        lineTotal,
        item.id
      ]);
      item.name = latestFood.name;
      item.unitPrice = latestFood.price;
      item.lineTotal = lineTotal;
    }

    if (!paymentCompleted) {
      return res.status(402).json({
        success: false,
        message: "Payment not completed. Order creation blocked by business rule."
      });
    }

    const totalPrice = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const orderId = createId("order");
    const currentTs = nowIso();

    await exec("BEGIN TRANSACTION");
    try {
      await run(
        `INSERT INTO orders (id, user_id, total_price, currency, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, userId, totalPrice, "NGN", "Pending", currentTs, currentTs]
      );

      for (const item of cartItems) {
        await run(
          `INSERT INTO order_items (order_id, food_id, name, unit_price, quantity, line_total)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, item.foodId, item.name, item.unitPrice, item.quantity, item.lineTotal]
        );
      }

      await run(
        `INSERT INTO order_status_history (order_id, status, updated_at, updated_by)
         VALUES (?, ?, ?, ?)`,
        [orderId, "Pending", nowIso(), "system"]
      );

      await run(`DELETE FROM cart_items WHERE cart_id = ?`, [cart.id]);
      await run(`UPDATE carts SET updated_at = ? WHERE id = ?`, [nowIso(), cart.id]);
      await exec("COMMIT");
    } catch (error) {
      await exec("ROLLBACK");
      throw error;
    }

    const order = await getOrderById(orderId);
    return res.status(201).json({
      success: true,
      message: "Order created successfully.",
      data: order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create order.",
      error: error.message
    });
  }
});

router.get("/orders", async (req, res) => {
  try {
    const { userId } = req.query;
    const rows = userId
      ? await all(
          `SELECT id, user_id AS userId, total_price AS totalPrice, currency, status, created_at AS createdAt, updated_at AS updatedAt
           FROM orders
           WHERE user_id = ?
           ORDER BY created_at DESC`,
          [userId]
        )
      : await all(
          `SELECT id, user_id AS userId, total_price AS totalPrice, currency, status, created_at AS createdAt, updated_at AS updatedAt
           FROM orders
           ORDER BY created_at DESC`
        );

    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders.",
      error: error.message
    });
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
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
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order.",
      error: error.message
    });
  }
});

router.patch("/orders/:id/status", async (req, res) => {
  const { status, actor = "admin" } = req.body;
  if (!status || !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Valid values: ${ORDER_STATUSES.join(", ")}`
    });
  }

  try {
    const order = await get(
      `SELECT id, status FROM orders WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
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

    await run(`UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`, [
      status,
      nowIso(),
      req.params.id
    ]);
    await run(
      `INSERT INTO order_status_history (order_id, status, updated_at, updated_by) VALUES (?, ?, ?, ?)`,
      [req.params.id, status, nowIso(), actor]
    );

    const updated = await getOrderById(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Order status updated.",
      data: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update order status.",
      error: error.message
    });
  }
});

router.post("/orders/:id/cancel", async (req, res) => {
  const { actor = "customer" } = req.body;
  try {
    const order = await get(
      `SELECT id, status FROM orders WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
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

    await run(`UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`, [
      "Cancelled",
      nowIso(),
      req.params.id
    ]);
    await run(
      `INSERT INTO order_status_history (order_id, status, updated_at, updated_by) VALUES (?, ?, ?, ?)`,
      [req.params.id, "Cancelled", nowIso(), actor]
    );

    const updated = await getOrderById(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully.",
      data: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to cancel order.",
      error: error.message
    });
  }
});

module.exports = router;
