-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "displayName" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "hp" INTEGER NOT NULL,
    "atk" INTEGER NOT NULL,
    "def" INTEGER NOT NULL,
    "spd" INTEGER NOT NULL,
    "critRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "critDmg" DOUBLE PRECISION NOT NULL DEFAULT 150.0,
    "effectHit" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "effectRes" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "passiveAtkBonus" INTEGER NOT NULL DEFAULT 0,
    "passiveDefBonus" INTEGER NOT NULL DEFAULT 0,
    "passiveSpdBonus" INTEGER NOT NULL DEFAULT 0,
    "passiveCritRateBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "passiveCritDmgBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "passiveHpBonus" INTEGER NOT NULL DEFAULT 0,
    "currentJobId" TEXT,
    "equipWeaponId" TEXT,
    "equipSubId" TEXT,
    "equipHeadId" TEXT,
    "equipBodyId" TEXT,
    "equipArmsId" TEXT,
    "equipLegsId" TEXT,
    "equipAcc1Id" TEXT,
    "equipAcc2Id" TEXT,
    "necroLevel" INTEGER NOT NULL DEFAULT 1,
    "necroRank" INTEGER NOT NULL DEFAULT 1,
    "necroMaxCost" INTEGER NOT NULL DEFAULT 10,
    "necroBaseStatsBonus" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "clearedStages" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserJob" (
    "characterId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserJob_pkey" PRIMARY KEY ("characterId","jobId")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "atk" INTEGER NOT NULL DEFAULT 0,
    "def" INTEGER NOT NULL DEFAULT 0,
    "critRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "critDmg" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "spd" INTEGER NOT NULL DEFAULT 0,
    "specialEffect" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "archetype" TEXT,
    "ilv" INTEGER,
    "passiveA" JSONB,
    "passiveB" JSONB,
    "subOptions" JSONB,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "discovererId" TEXT,
    "discovererName" TEXT,
    "serialNo" INTEGER,
    "discoveredAt" TIMESTAMP(3),

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbyssalResidue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "characterId" TEXT,
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "mainStat" JSONB NOT NULL,
    "subOptions" JSONB NOT NULL DEFAULT '[]',
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "maxExp" INTEGER NOT NULL DEFAULT 800,

    CONSTRAINT "AbyssalResidue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Monster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tribe" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "hp" INTEGER NOT NULL,
    "atk" INTEGER NOT NULL,
    "def" INTEGER NOT NULL,
    "spd" INTEGER NOT NULL,
    "critRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "critDmg" DOUBLE PRECISION NOT NULL DEFAULT 150.0,
    "effectHit" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "effectRes" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "soulShardId" TEXT,
    "spiritCoreId" TEXT,

    CONSTRAINT "Monster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoulShard" (
    "id" TEXT NOT NULL,
    "originMonster" TEXT NOT NULL,
    "atkBonus" INTEGER NOT NULL DEFAULT 0,
    "elementDmgBoost" INTEGER NOT NULL DEFAULT 0,
    "specialAbility" TEXT,

    CONSTRAINT "SoulShard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpiritCore" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "element" TEXT,
    "skillChangeId" TEXT,
    "atkMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "SpiritCore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_equipWeaponId_fkey" FOREIGN KEY ("equipWeaponId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_equipSubId_fkey" FOREIGN KEY ("equipSubId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_equipHeadId_fkey" FOREIGN KEY ("equipHeadId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_equipBodyId_fkey" FOREIGN KEY ("equipBodyId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_equipArmsId_fkey" FOREIGN KEY ("equipArmsId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_equipLegsId_fkey" FOREIGN KEY ("equipLegsId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_equipAcc1Id_fkey" FOREIGN KEY ("equipAcc1Id") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_equipAcc2Id_fkey" FOREIGN KEY ("equipAcc2Id") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserJob" ADD CONSTRAINT "UserJob_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserJob" ADD CONSTRAINT "UserJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_discovererId_fkey" FOREIGN KEY ("discovererId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbyssalResidue" ADD CONSTRAINT "AbyssalResidue_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monster" ADD CONSTRAINT "Monster_soulShardId_fkey" FOREIGN KEY ("soulShardId") REFERENCES "SoulShard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monster" ADD CONSTRAINT "Monster_spiritCoreId_fkey" FOREIGN KEY ("spiritCoreId") REFERENCES "SpiritCore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
