exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("payroll_runs", {
    idempotency_key: { type: "varchar(120)" }
  });
  pgm.addConstraint("payroll_runs", "payroll_runs_idempotency_key_key", {
    unique: "idempotency_key"
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint("payroll_runs", "payroll_runs_idempotency_key_key");
  pgm.dropColumn("payroll_runs", "idempotency_key");
};
