-- AlterTable
ALTER TABLE "linkedin_posts" ADD COLUMN "imagePrompt" TEXT;

-- CreateTable
CREATE TABLE "linkedin_post_versions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linkedin_post_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedin_image_versions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageS3Key" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linkedin_image_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linkedin_post_versions_postId_idx" ON "linkedin_post_versions"("postId");

-- CreateIndex
CREATE INDEX "linkedin_image_versions_postId_idx" ON "linkedin_image_versions"("postId");

-- AddForeignKey
ALTER TABLE "linkedin_post_versions" ADD CONSTRAINT "linkedin_post_versions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "linkedin_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedin_image_versions" ADD CONSTRAINT "linkedin_image_versions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "linkedin_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
