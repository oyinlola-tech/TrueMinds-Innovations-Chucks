const express = require("express");
const { run, all, get } = require("../data/db");
const { createId, nowIso } = require("../utils/helpers");

const router = express.Router();

router.get("/foods", async (_req, res) => {
  try {
    const foods = await all(
      `SELECT id, name, description, price, currency, is_available AS isAvailable, created_at AS createdAt, updated_at AS updatedAt
       FROM foods
       ORDER BY created_at DESC`
    );
    return res.status(200).json({
      success: true,
      data: foods.map((food) => ({ ...food, isAvailable: Boolean(food.isAvailable) }))
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch foods.",
      error: error.message
    });
  }
});

router.post("/foods", async (req, res) => {
  const { name, description, price, isAvailable, currency, adminKey } = req.body;
  if (adminKey !== "admin-123") {
    return res.status(403).json({
      success: false,
      message: "Admin simulation failed. Pass adminKey=admin-123."
    });
  }

  if (!name || !description || typeof price !== "number" || price <= 0) {
    return res.status(400).json({
      success: false,
      message: "name, description and positive numeric price are required."
    });
  }

  try {
    const food = {
      id: createId("food"),
      name: String(name).trim(),
      description: String(description).trim(),
      price,
      currency: currency || "NGN",
      isAvailable: typeof isAvailable === "boolean" ? isAvailable : true,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    await run(
      `INSERT INTO foods (id, name, description, price, currency, is_available, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        food.id,
        food.name,
        food.description,
        food.price,
        food.currency,
        food.isAvailable ? 1 : 0,
        food.createdAt,
        food.updatedAt
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Food item created.",
      data: food
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create food item.",
      error: error.message
    });
  }
});

router.patch("/foods/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, price, isAvailable, adminKey } = req.body;
  if (adminKey !== "admin-123") {
    return res.status(403).json({
      success: false,
      message: "Admin simulation failed. Pass adminKey=admin-123."
    });
  }

  try {
    const food = await get(`SELECT id FROM foods WHERE id = ? LIMIT 1`, [id]);
    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food item not found."
      });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push("name = ?");
      params.push(String(name).trim());
    }
    if (description) {
      updates.push("description = ?");
      params.push(String(description).trim());
    }
    if (typeof price === "number" && price > 0) {
      updates.push("price = ?");
      params.push(price);
    }
    if (typeof isAvailable === "boolean") {
      updates.push("is_available = ?");
      params.push(isAvailable ? 1 : 0);
    }
    updates.push("updated_at = ?");
    params.push(nowIso());

    params.push(id);
    await run(`UPDATE foods SET ${updates.join(", ")} WHERE id = ?`, params);

    const updated = await get(
      `SELECT id, name, description, price, currency, is_available AS isAvailable, created_at AS createdAt, updated_at AS updatedAt
       FROM foods WHERE id = ?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Food item updated.",
      data: { ...updated, isAvailable: Boolean(updated.isAvailable) }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update food item.",
      error: error.message
    });
  }
});

module.exports = router;
