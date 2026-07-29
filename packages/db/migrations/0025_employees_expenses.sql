CREATE TYPE "employee_status" AS ENUM ('working', 'temporarily_inactive', 'dismissed', 'archived');

CREATE TABLE "employees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "full_name" text NOT NULL,
  "position" text,
  "phone" text,
  "email" text,
  "birth_date" date,
  "start_date" date,
  "end_date" date,
  "status" "employee_status" DEFAULT 'working' NOT NULL,
  "comment" text,
  "personnel_number" text,
  "user_id" uuid,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null
);

CREATE UNIQUE INDEX "employees_user_unique" ON "employees" ("user_id") WHERE "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "employees_personnel_number_unique" ON "employees" ("personnel_number") WHERE "personnel_number" IS NOT NULL;
CREATE INDEX "employees_name_idx" ON "employees" ("full_name");
CREATE INDEX "employees_position_idx" ON "employees" ("position");
CREATE INDEX "employees_status_idx" ON "employees" ("status");
CREATE INDEX "employees_start_date_idx" ON "employees" ("start_date");

ALTER TABLE "expenses" ADD COLUMN "employee_id" uuid;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE restrict;
CREATE INDEX "expenses_employee_idx" ON "expenses" ("employee_id");

INSERT INTO "permissions" ("key", "description") VALUES
  ('employees.read', 'Просмотр сотрудников'),
  ('employees.write', 'Изменение сотрудников')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role_row.id, permission_row.id
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE role_row.name IN ('super_admin', 'admin')
  AND permission_row.key IN ('employees.read', 'employees.write')
ON CONFLICT DO NOTHING;
