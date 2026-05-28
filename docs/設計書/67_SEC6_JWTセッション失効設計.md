# 67 — SEC-6 JWTセッション失効設計

> 対象: `src/auth.ts` / `src/services/SessionSecurityService.ts` / `src/app/api/auth/logout/route.ts` / `prisma/schema.prisma`  
> 対応日: 2026-05-27  
> 関連: `docs/progress/BUGS_AND_SECURITY.md` / `docs/progress/IMPROVEMENTS.md` の `SEC-6`

---

## 1. 背景

現在の認証は NextAuth v5 の Credentials provider を使っている。Auth.js v5 は Credentials provider のみで `session.strategy = "database"` を使う構成を許可していないため、JWT セッション戦略は維持する必要がある。

ただし、純粋なJWTは発行後にサーバー側から無効化できない。パスワード変更、アカウント停止、アカウント削除などの重要操作後も、有効期限内のJWTが残ると最大24時間利用できてしまう。

---

## 2. 問題

旧実装:

```typescript
session: { strategy: 'jwt', maxAge: 60 * 60 * 24 },
callbacks: {
  jwt: ({ token, user }) => {
    if (user?.id) token.id = user.id;
    return token;
  },
}
```

問題点:

| 観点 | 問題 |
|---|---|
| パスワード変更後 | 旧JWTが有効期限まで残る。 |
| アカウント停止・削除 | Cookieを持つクライアントが古いJWTでAPIを呼べる可能性がある。 |
| 手製ログインAPI | `/api/auth/login` が `next-auth/jwt.encode()` でJWTを直接発行しており、NextAuth callback だけでは統制できない。 |
| 監査性 | セッションを無効化する共通サービスが存在しない。 |

---

## 3. 採用方式

### 3.1 `User.sessionVersion`

`User` に `sessionVersion Int @default(1)` を追加する。JWTにはログイン時点の `sessionVersion` を刻む。

```prisma
model User {
  sessionVersion Int @default(1)
}
```

認証時に以下を照合する。

```text
JWT.sessionVersion === User.sessionVersion
```

一致しない場合、そのJWTは失効済みとして扱う。

### 3.2 一括失効

重要操作時は次を呼ぶ。

```typescript
await invalidateAllUserSessions(userId);
```

内部で `User.sessionVersion` を `increment: 1` するため、古いJWTはすべて不一致になる。単一端末だけでなく、同一ユーザーの全端末を安全に失効できる。

### 3.3 JWT戦略は維持

Credentials provider の制約により、`strategy: "database"` へは切り替えない。代わりに、JWT callback でDBの `sessionVersion` を確認する。

---

## 4. 実装詳細

### 4.1 Prisma

Migration:

```sql
ALTER TABLE "User"
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;
```

### 4.2 `SessionSecurityService`

追加:

- `SESSION_MAX_AGE_SECONDS`
- `resolveTokenUserId(token)`
- `normalizeSessionVersion(value)`
- `getUserSessionVersion(userId)`
- `isSessionVersionCurrent(userId, sessionVersion)`
- `invalidateAllUserSessions(userId)`
- `validateVersionedSessionToken(token)`

### 4.3 NextAuth callback

ログイン時:

1. Credentials `authorize()` が `user.sessionVersion` を返す。
2. `jwt` callback が `token.id` と `token.sessionVersion` を保存する。

セッション確認時:

1. `validateVersionedSessionToken(token)` を呼ぶ。
2. DBの `User.sessionVersion` と不一致なら `null` を返す。
3. Auth.js がJWT Cookieを破棄し、`auth()` は未認証扱いになる。

### 4.4 手製ログインAPI

`/api/auth/login` は NextAuth callback を経由せず `encode()` でJWTを作るため、payload に `sessionVersion` を含める。

```typescript
token: {
  id: user.id,
  sessionVersion: user.sessionVersion,
}
```

### 4.5 ログアウトAPI

`/api/auth/logout` を追加し、ログアウト時に以下を行う。

1. `auth()` で現在ユーザーを取得する。
2. `invalidateAllUserSessions(userId)` で `User.sessionVersion` を進める。
3. `authjs.session-token` と `__Secure-authjs.session-token` を `maxAge: 0` で削除する。

この挙動は「現在端末だけのログアウト」ではなく「旧JWTの一括失効」を優先する。盗まれたJWTや別端末に残るJWTも、次回 `auth()` / `/api/auth/session` 確認時に失効扱いになる。

---

## 5. テスト設計

`SessionSecurityService.test.ts`:

| ケース | 期待 |
|---|---|
| `resolveTokenUserId()` | `id` 優先、なければ `sub` を使う |
| `normalizeSessionVersion()` | 正の整数のみ許可 |
| 新規ユーザー | `sessionVersion = 1` |
| 現行versionのJWT | `validateVersionedSessionToken()` が valid |
| `invalidateAllUserSessions()` 後の旧JWT | invalid |
| increment後の新version | valid |
| `/api/auth/logout` ログイン中 | `invalidateAllUserSessions()` が呼ばれ、Cookie削除を返す |
| `/api/auth/logout` 未ログイン | 失効処理は呼ばず、Cookie削除だけ返す |

既存の Server Action テストは `auth()` mock を使うため、NextAuth callback のDB照合は通らない。実運用では `auth()` が callback を通して、失効済みJWTを `session = null` として扱う。

---

## 6. 対象外

- 単一端末だけの個別失効。
- Redis blacklist による `jti` 単位の失効。
- パスワード変更UI、アカウント削除UIの実装。
- OAuth provider の追加。

---

## 7. 完了条件

- JWTに `sessionVersion` が含まれる。
- `auth()` のJWT callbackがDB上の現行versionを照合する。
- `invalidateAllUserSessions()` で旧JWTが invalid になる。
- ログアウト時に `User.sessionVersion` を進め、旧JWTを一括失効できる。
- Prisma migration が追加される。
- `npx prisma generate` / `npx tsc --noEmit` / Jest / build が通る。
