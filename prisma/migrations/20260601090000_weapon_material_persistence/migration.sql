-- CreateTable
CREATE TABLE "WeaponMaterial" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WeaponMaterial_pkey" PRIMARY KEY ("userId","type")
);

-- AddForeignKey
ALTER TABLE "WeaponMaterial" ADD CONSTRAINT "WeaponMaterial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
