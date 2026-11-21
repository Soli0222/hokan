-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('pc_peripheral', 'network', 'audio', 'appliance', 'game', 'hobby', 'furniture', 'vehicle', 'books_media', 'digital', 'other');

-- CreateEnum
CREATE TYPE "AcquisitionType" AS ENUM ('purchase', 'gift', 'prize', 'other');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('new', 'used');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('owned', 'disposed');

-- CreateEnum
CREATE TYPE "NecessityTier" AS ENUM ('essential', 'main', 'sub', 'dormant');

-- CreateEnum
CREATE TYPE "DisposalMethod" AS ENUM ('sale', 'trade_in', 'discard', 'transfer', 'donation', 'loss');

-- CreateEnum
CREATE TYPE "DisposalReason" AS ENUM ('unused', 'replaced', 'broken', 'not_needed', 'cash', 'other');

-- CreateEnum
CREATE TYPE "ValuationLiquidity" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "ValuationEstimatedBy" AS ENUM ('owner', 'ai');

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "maker" VARCHAR(200),
    "model" VARCHAR(200),
    "acquired_on" DATE,
    "acquired_on_approx" BOOLEAN NOT NULL DEFAULT false,
    "acquisition_type" "AcquisitionType",
    "purchase_price" INTEGER,
    "purchase_source" VARCHAR(200),
    "condition_at_acquisition" "ItemCondition",
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "purpose" TEXT,
    "location" VARCHAR(200),
    "status" "ItemStatus" NOT NULL DEFAULT 'owned',
    "necessity_tier" "NecessityTier",
    "last_confirmed_on" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disposals" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "disposed_on" DATE NOT NULL,
    "method" "DisposalMethod" NOT NULL,
    "amount" INTEGER,
    "channel" VARCHAR(200),
    "reason" "DisposalReason",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valuations" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "estimated_resale_price" INTEGER NOT NULL,
    "estimated_on" DATE NOT NULL,
    "liquidity" "ValuationLiquidity",
    "source" VARCHAR(200),
    "estimated_by" "ValuationEstimatedBy" NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "issuer" VARCHAR(255) NOT NULL DEFAULT '',
    "subject" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "user_agent" VARCHAR(255),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "max_expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "token_hash" TEXT NOT NULL,
    "read_only" BOOLEAN NOT NULL DEFAULT false,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disposals_item_id_key" ON "disposals"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "disposals" ADD CONSTRAINT "disposals_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
