const store = {
  users: [],
  verificationSessions: [],
  foods: [
    {
      id: "food_1",
      name: "Jollof Rice & Chicken",
      description: "Smoky party jollof rice served with grilled chicken.",
      price: 3500,
      currency: "NGN",
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "food_2",
      name: "Pounded Yam & Egusi",
      description: "Fresh pounded yam with rich egusi soup.",
      price: 4200,
      currency: "NGN",
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "food_3",
      name: "Plantain & Fish Sauce",
      description: "Fried ripe plantain with spicy fish sauce.",
      price: 3000,
      currency: "NGN",
      isAvailable: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  carts: [],
  orders: [],
  referrals: [
    {
      code: "CHUKS10",
      isActive: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      code: "OLDREF",
      isActive: false,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    }
  ]
};

module.exports = store;
