/*
  Warnings:

  - You are about to drop the column `llm` on the `prompts` table. All the data in the column will be lost.
  - You are about to drop the column `prompt` on the `prompts` table. All the data in the column will be lost.
  - Added the required column `content` to the `prompts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `model` to the `prompts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "prompts" DROP COLUMN "llm",
DROP COLUMN "prompt",
ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "model" TEXT NOT NULL;
