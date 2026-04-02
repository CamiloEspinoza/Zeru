-- CreateTable
CREATE TABLE "interview_audio_tracks" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "trackOrder" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/mpeg',
    "durationMs" INTEGER,
    "sourceLabel" TEXT,
    "originalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "interview_audio_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_audio_tracks_interviewId_idx" ON "interview_audio_tracks"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_audio_tracks_interviewId_trackOrder_key" ON "interview_audio_tracks"("interviewId", "trackOrder");

-- AddForeignKey
ALTER TABLE "interview_audio_tracks" ADD CONSTRAINT "interview_audio_tracks_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
