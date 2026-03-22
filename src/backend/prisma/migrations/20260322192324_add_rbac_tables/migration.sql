-- CreateTable
CREATE TABLE "ait"."rbac_groups" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "azure_ad_group_id" TEXT NOT NULL DEFAULT '',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rbac_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ait"."rbac_group_features" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rbac_group_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rbac_groups_key_key" ON "ait"."rbac_groups"("key");

-- CreateIndex
CREATE INDEX "rbac_groups_azure_ad_group_id_idx" ON "ait"."rbac_groups"("azure_ad_group_id");

-- CreateIndex
CREATE INDEX "rbac_group_features_group_id_idx" ON "ait"."rbac_group_features"("group_id");

-- CreateIndex
CREATE INDEX "rbac_group_features_feature_key_idx" ON "ait"."rbac_group_features"("feature_key");

-- CreateIndex
CREATE UNIQUE INDEX "rbac_group_features_group_id_feature_key_key" ON "ait"."rbac_group_features"("group_id", "feature_key");

-- AddForeignKey
ALTER TABLE "ait"."rbac_group_features" ADD CONSTRAINT "rbac_group_features_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ait"."rbac_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed RBAC Groups (Azure AD GUIDs are the same for dev and prod)
INSERT INTO "ait"."rbac_groups" ("id", "key", "display_name", "azure_ad_group_id", "created_at", "updated_at") VALUES
  (gen_random_uuid(), 'SALES',          'Sales',           'dcdcdc52-d022-44db-b411-dee01c883879', NOW(), NOW()),
  (gen_random_uuid(), 'CATMAN',         'Catman',          'ceb05fa2-1f3c-4cd8-95f3-a20f6ef984db', NOW(), NOW()),
  (gen_random_uuid(), 'DEMAND_PLANNER', 'Demand Planning', 'a31185f0-c0a8-494c-8883-8dada64e9849', NOW(), NOW()),
  (gen_random_uuid(), 'PURCHASING',     'Purchasing',      '2341154d-ffd2-4c66-9d43-a42737d63f6e', NOW(), NOW()),
  (gen_random_uuid(), 'EARLY_ADOPTER',  'Early Adopters',  '9c5aba67-2af0-4e42-b0ed-cab449333bc6', NOW(), NOW()),
  (gen_random_uuid(), 'ADMIN',          'Admins',          'f2e25746-a556-4e57-a31f-735e08ef5cb1', NOW(), NOW());

-- Seed Group-Feature Mappings
-- SALES: demand-validation-tool
INSERT INTO "ait"."rbac_group_features" ("id", "group_id", "feature_key", "created_at")
  SELECT gen_random_uuid(), g.id, f.key, NOW()
  FROM "ait"."rbac_groups" g
  CROSS JOIN (VALUES ('demand-validation-tool')) AS f(key)
  WHERE g.key = 'SALES';

-- DEMAND_PLANNER: monthly-forecast, confirmed-bid-items
INSERT INTO "ait"."rbac_group_features" ("id", "group_id", "feature_key", "created_at")
  SELECT gen_random_uuid(), g.id, f.key, NOW()
  FROM "ait"."rbac_groups" g
  CROSS JOIN (VALUES ('monthly-forecast'), ('confirmed-bid-items')) AS f(key)
  WHERE g.key = 'DEMAND_PLANNER';

-- EARLY_ADOPTER: starq, demand-validation-tool, monthly-forecast, confirmed-bid-items, eo-risk-review
INSERT INTO "ait"."rbac_group_features" ("id", "group_id", "feature_key", "created_at")
  SELECT gen_random_uuid(), g.id, f.key, NOW()
  FROM "ait"."rbac_groups" g
  CROSS JOIN (VALUES ('starq'), ('demand-validation-tool'), ('monthly-forecast'), ('confirmed-bid-items'), ('eo-risk-review')) AS f(key)
  WHERE g.key = 'EARLY_ADOPTER';

-- ADMIN: all features
INSERT INTO "ait"."rbac_group_features" ("id", "group_id", "feature_key", "created_at")
  SELECT gen_random_uuid(), g.id, f.key, NOW()
  FROM "ait"."rbac_groups" g
  CROSS JOIN (VALUES
    ('starq'), ('demand-validation-tool'), ('monthly-forecast'), ('confirmed-bid-items'),
    ('bid-export'), ('prompt-builder'), ('stockiq-sync'), ('customer-bids-sync'),
    ('eo-risk-review'), ('rbac-admin')
  ) AS f(key)
  WHERE g.key = 'ADMIN';
