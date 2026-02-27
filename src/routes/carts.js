const express = require("express");
const { run, get, all } = require("../data/db");
const { createId, nowIso } = require("../utils/helpers");
const { isPositiveInteger } = require("../utils/validators");

const router = express.Router();

async function getOrCreateCart(userId) {
  let cart = await get(
    `SELECT id, user_id AS userId, updated_at AS updatedAt FROM carts WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  if (!cart) {
    cart = {
      id: createId("cart"),
      userId,
      updatedAt: nowIso()
    };
    await run(`INSERT INTO carts (id, user_id, updated_at) VALUES (?, ?, ?)`, [
      cart.id,
      cart.userId,
      cart.updatedAt
    ]);
  }
  return cart;
}

router.post("/cart/items", async (req, res) => {
  const { userId, foodId, quantity } = req.body;
  if (!userId || !foodId || !isPositiveInteger(quantity)) {
    return res.status(400).json({
      success: false,
      message: "userId, foodId, and positive integer quantity are required."
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

    const food = await get(
      `SELECT id, name, price, is_available AS isAvailable FROM foods WHERE id = ? LIMIT 1`,
      [foodId]
    );
    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food item not found."
      });
    }

    if (!food.isAvailable) {
      return res.status(409).json({
        success: false,
        message: "Food item is currently unavailable."
      });
    }

    const cart = await getOrCreateCart(userId);
    const existing = await get(
      `SELECT id, quantity FROM cart_items WHERE cart_id = ? AND food_id = ? LIMIT 1`,
      [cart.id, foodId]
    );

    if (existing) {
      const newQuantity = existing.quantity + quantity;
      await run(`UPDATE cart_items SET quantity = ?, line_total = ? WHERE id = ?`, [
        newQuantity,
        newQuantity * food.price,
        existing.id
      ]);
    } else {
      await run(
        `INSERT INTO cart_items (cart_id, food_id, name, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [cart.id, foodId, food.name, food.price, quantity, quantity * food.price]
      );
    }

    await run(`UPDATE carts SET updated_at = ? WHERE id = ?`, [nowIso(), cart.id]);

    const items = await all(
      `SELECT food_id AS foodId, name, unit_price AS unitPrice, quantity, line_total AS lineTotal
       FROM cart_items WHERE cart_id = ?`,
      [cart.id]
    );

    return res.status(200).json({
      success: true,
      message: "Item added to cart.",
      data: {
        id: cart.id,
        userId,
        items,
        updatedAt: nowIso()
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update cart.",
      error: error.message
    });
  }
});

router.get("/cart/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const cart = await get(
      `SELECT id, user_id AS userId, updated_at AS updatedAt FROM carts WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          userId,
          items: [],
          subtotal: 0
        }
      });
    }

    const items = await all(
      `SELECT food_id AS foodId, name, unit_price AS unitPrice, quantity, line_total AS lineTotal
       FROM cart_items WHERE cart_id = ?`,
      [cart.id]
    );
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

    return res.status(200).json({
      success: true,
      data: {
        ...cart,
        items,
        subtotal
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cart.",
      error: error.message
    });
  }
});

router.post("/cart/:userId/clear", async (req, res) => {
  const { userId } = req.params;
  try {
    const cart = await get(
      `SELECT id, user_id AS userId, updated_at AS updatedAt FROM carts WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found."
      });
    }

    await run(`DELETE FROM cart_items WHERE cart_id = ?`, [cart.id]);
    const updatedAt = nowIso();
    await run(`UPDATE carts SET updated_at = ? WHERE id = ?`, [updatedAt, cart.id]);

    return res.status(200).json({
      success: true,
      message: "Cart cleared.",
      data: {
        id: cart.id,
        userId,
        items: [],
        updatedAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to clear cart.",
      error: error.message
    });
  }
});

module.exports = router;
