exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(
    "INSERT INTO roles (name) VALUES ('admin'), ('hr'), ('payroll'), ('manager'), ('employee') ON CONFLICT DO NOTHING"
  );

  pgm.sql(
    "INSERT INTO departments (name) VALUES ('Human Resources'), ('Payroll'), ('Engineering'), ('Finance') ON CONFLICT DO NOTHING"
  );

  pgm.sql(
    "INSERT INTO taxes (name, rate, effective_from) VALUES " +
      "('federal_standard', 0.2200, '2026-01-01'), " +
      "('state_standard', 0.0500, '2026-01-01'), " +
      "('local_standard', 0.0150, '2026-01-01') " +
      "ON CONFLICT (name, effective_from) DO NOTHING"
  );
};

exports.down = (pgm) => {
  pgm.sql(
    "DELETE FROM taxes WHERE name IN ('federal_standard', 'state_standard', 'local_standard') AND effective_from = '2026-01-01'"
  );
  pgm.sql("DELETE FROM departments WHERE name IN ('Human Resources', 'Payroll', 'Engineering', 'Finance')");
  pgm.sql("DELETE FROM roles WHERE name IN ('admin', 'hr', 'payroll', 'manager', 'employee')");
};
