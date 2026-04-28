const express = require("express");

function createPlaceholderRouter(resource) {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.json({
      data: [],
      meta: {
        resource,
        status: "placeholder"
      }
    });
  });

  return router;
}

module.exports = createPlaceholderRouter;
