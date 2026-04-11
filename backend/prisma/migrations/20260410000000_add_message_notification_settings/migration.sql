-- AlterTable
ALTER TABLE "User" ADD COLUMN "messagePushEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "messageTossAppEnabled" BOOLEAN NOT NULL DEFAULT false;
