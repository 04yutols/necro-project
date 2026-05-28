-- SEC-6: JWT session invalidation through per-user session versions.

ALTER TABLE "User"
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;
