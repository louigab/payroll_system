exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("attendance", {
    approved_by: { type: "integer", references: "users", onDelete: "set null" },
    approved_at: { type: "timestamptz" }
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("attendance", "approved_at");
  pgm.dropColumn("attendance", "approved_by");
};
