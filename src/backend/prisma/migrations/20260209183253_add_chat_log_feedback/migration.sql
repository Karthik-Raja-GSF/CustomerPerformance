-- AlterTable
ALTER TABLE "ait"."chat_log" ADD COLUMN     "feedback_at" TIMESTAMPTZ,
ADD COLUMN     "feedback_reason" TEXT,
ADD COLUMN     "feedback_sentiment" TEXT;
