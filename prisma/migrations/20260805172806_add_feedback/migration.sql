-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "path" TEXT,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);
