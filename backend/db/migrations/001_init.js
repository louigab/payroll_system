exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("roles", {
    id: "id",
    name: { type: "varchar(50)", notNull: true, unique: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createTable("users", {
    id: "id",
    email: { type: "varchar(255)", notNull: true, unique: true },
    password_hash: { type: "varchar(255)", notNull: true },
    is_active: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createTable("user_roles", {
    user_id: {
      type: "integer",
      notNull: true,
      references: "users",
      onDelete: "cascade"
    },
    role_id: {
      type: "integer",
      notNull: true,
      references: "roles",
      onDelete: "cascade"
    },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });
  pgm.addConstraint("user_roles", "user_roles_pkey", {
    primaryKey: ["user_id", "role_id"]
  });

  pgm.createTable("departments", {
    id: "id",
    name: { type: "varchar(120)", notNull: true, unique: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createTable("employees", {
    id: "id",
    user_id: { type: "integer", references: "users", onDelete: "set null" },
    department_id: {
      type: "integer",
      references: "departments",
      onDelete: "set null"
    },
    first_name: { type: "varchar(120)", notNull: true },
    last_name: { type: "varchar(120)", notNull: true },
    email: { type: "varchar(255)", notNull: true, unique: true },
    status: { type: "varchar(40)", notNull: true, default: "active" },
    hire_date: { type: "date", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createTable("attendance", {
    id: "id",
    employee_id: {
      type: "integer",
      notNull: true,
      references: "employees",
      onDelete: "cascade"
    },
    attendance_date: { type: "date", notNull: true },
    status: { type: "varchar(30)", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createTable("time_entries", {
    id: "id",
    employee_id: {
      type: "integer",
      notNull: true,
      references: "employees",
      onDelete: "cascade"
    },
    clock_in: { type: "timestamptz", notNull: true },
    clock_out: { type: "timestamptz" },
    hours_worked: { type: "numeric(6,2)", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createTable("pay_periods", {
    id: "id",
    start_date: { type: "date", notNull: true },
    end_date: { type: "date", notNull: true },
    status: { type: "varchar(40)", notNull: true, default: "open" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createTable("payroll_runs", {
    id: "id",
    pay_period_id: {
      type: "integer",
      notNull: true,
      references: "pay_periods",
      onDelete: "cascade"
    },
    run_date: { type: "date", notNull: true },
    status: { type: "varchar(40)", notNull: true, default: "pending" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createTable("payroll_items", {
    id: "id",
    payroll_run_id: {
      type: "integer",
      notNull: true,
      references: "payroll_runs",
      onDelete: "cascade"
    },
    employee_id: {
      type: "integer",
      notNull: true,
      references: "employees",
      onDelete: "cascade"
    },
    gross_pay: { type: "numeric(12,2)", notNull: true, default: 0 },
    taxes: { type: "numeric(12,2)", notNull: true, default: 0 },
    deductions: { type: "numeric(12,2)", notNull: true, default: 0 },
    net_pay: { type: "numeric(12,2)", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createTable("taxes", {
    id: "id",
    name: { type: "varchar(120)", notNull: true },
    rate: { type: "numeric(6,4)", notNull: true },
    effective_from: { type: "date", notNull: true },
    effective_to: { type: "date" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });
  pgm.addConstraint("taxes", "taxes_name_effective_from_key", {
    unique: ["name", "effective_from"]
  });

  pgm.createTable("deductions", {
    id: "id",
    name: { type: "varchar(120)", notNull: true, unique: true },
    default_amount: { type: "numeric(12,2)", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createTable("benefits", {
    id: "id",
    name: { type: "varchar(120)", notNull: true, unique: true },
    default_amount: { type: "numeric(12,2)", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createTable("audit_logs", {
    id: "id",
    actor_user_id: { type: "integer", references: "users", onDelete: "set null" },
    action: { type: "varchar(120)", notNull: true },
    entity_type: { type: "varchar(120)", notNull: true },
    entity_id: { type: "varchar(120)" },
    metadata: { type: "jsonb" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") }
  });

  pgm.createIndex("users", "created_at");
  pgm.createIndex("employees", "created_at");
  pgm.createIndex("attendance", "employee_id");
  pgm.createIndex("attendance", "created_at");
  pgm.createIndex("time_entries", "employee_id");
  pgm.createIndex("time_entries", "created_at");
  pgm.createIndex("payroll_runs", "pay_period_id");
  pgm.createIndex("payroll_runs", "created_at");
  pgm.createIndex("payroll_items", "employee_id");
  pgm.createIndex("payroll_items", "payroll_run_id");
  pgm.createIndex("payroll_items", "created_at");
  pgm.createIndex("audit_logs", "created_at");
};

exports.down = (pgm) => {
  pgm.dropTable("audit_logs");
  pgm.dropTable("benefits");
  pgm.dropTable("deductions");
  pgm.dropTable("taxes");
  pgm.dropTable("payroll_items");
  pgm.dropTable("payroll_runs");
  pgm.dropTable("pay_periods");
  pgm.dropTable("time_entries");
  pgm.dropTable("attendance");
  pgm.dropTable("employees");
  pgm.dropTable("departments");
  pgm.dropTable("user_roles");
  pgm.dropTable("users");
  pgm.dropTable("roles");
};
