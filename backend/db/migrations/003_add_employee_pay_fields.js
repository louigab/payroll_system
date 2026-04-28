exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("employees", {
    hourly_rate: { type: "numeric(12,2)", notNull: true, default: 0 },
    overtime_multiplier: { type: "numeric(4,2)", notNull: true, default: 1.5 }
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("employees", "overtime_multiplier");
  pgm.dropColumn("employees", "hourly_rate");
};
