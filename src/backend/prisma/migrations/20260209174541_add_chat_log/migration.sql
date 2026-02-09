-- CreateTable
CREATE TABLE "ait"."chat_log" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "confidence_reasoning" TEXT NOT NULL DEFAULT '',
    "accuracy" INTEGER NOT NULL DEFAULT 0,
    "sql_status" TEXT NOT NULL,
    "raw_sql" TEXT,
    "raw_result" JSONB,
    "sql_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "sql_output_tokens" INTEGER NOT NULL DEFAULT 0,
    "answer_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "answer_output_tokens" INTEGER NOT NULL DEFAULT 0,
    "model_name" TEXT NOT NULL,
    "prompt_id" TEXT NOT NULL,
    "response_time_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_log_user_id_idx" ON "ait"."chat_log"("user_id");

-- CreateIndex
CREATE INDEX "chat_log_created_at_idx" ON "ait"."chat_log"("created_at");
