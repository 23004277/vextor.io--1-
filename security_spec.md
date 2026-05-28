# Vextor.io Security Specification

## 1. Data Invariants

- **Ownership Integrity**: A user can only read, write, or update their own user document under `/users/{userId}` where `{userId}` matches their authenticated UID.
- **Username Immutability**: Once a user document is created, `username` must match the user profile and can never be modified.
- **Temporal Alignment**: `createdAt` and high score dates must be equal to the server-established `request.time`.
- **Stat Sanitization**: Stats such as `highScore`, `totalScore`, `maxLevel`, `totalKills`, and others cannot contain arbitrary data types, nor can lists like `inventory` contain elements other than string identifiers.
- **Score Integrity**: A record inside `/highScores/{scoreId}` cannot be edited or deleted once created.
- **Score Authenticated Validation**: Creating a HighScoreEntry requires that the submitting pilot's auth matches the name of the submitting user, or matches standard auth parameters.

---

## 2. The "Dirty Dozen" Malicious Payloads

Here are twelve payloads designed to violate state, identity, or integrity constraints:

### Payload 1: Privilege Escalation via Shadow Fields (Users)
**Intent**: Inject a shadow boolean field `isAdmin` to gain administrative privilege on a user record.
```json
{
  "username": "MALICIOUS",
  "createdAt": "2026-05-22T00:00:00Z",
  "currency": 100,
  "inventory": ["color_default"],
  "equippedItem": "color_default",
  "stats": {
    "totalGames": 1,
    "totalScore": 100,
    "highScore": 100,
    "maxLevel": 2,
    "totalKills": 5,
    "totalDeaths": 0
  },
  "isAdmin": true
}
```

### Payload 2: Hostile Account Injection (Users)
**Intent**: Write to a user profile belonging to another player (e.g., writing to `/users/victim_user_id` from a different account).
```json
{
  "username": "SPOOFED_VICTIM",
  "createdAt": "2026-05-22T00:00:00Z",
  "currency": 99999,
  "inventory": ["color_default"],
  "equippedItem": "color_default",
  "stats": {
    "totalGames": 1000,
    "totalScore": 1000000,
    "highScore": 100000,
    "maxLevel": 45,
    "totalKills": 5000,
    "totalDeaths": 1
  }
}
```

### Payload 3: Spoofed Score Entry Ownership (High Scores)
**Intent**: Post a high score under someone else's player name or subverting authentication entirely.
```json
// Submitting with UID "attacker_uid" but payload name says "victim_pro"
{
  "name": "victim_pro",
  "score": 999999,
  "level": 45,
  "classType": "Reaper",
  "date": "2026-05-22T00:00:00Z"
}
```

### Payload 4: Arbitrary Currency Inflation (Users)
**Intent**: Attempt to bypass transaction rules and credit a massive balance to oneself.
```json
{
  "username": "HACKER",
  "createdAt": "2026-05-22T00:00:00Z",
  "currency": 9999999,
  "inventory": ["color_default"],
  "equippedItem": "color_default",
  "stats": {
    "totalGames": 1,
    "totalScore": 100,
    "highScore": 100,
    "maxLevel": 1,
    "totalKills": 0,
    "totalDeaths": 0
  }
}
```

### Payload 5: Time Travel Exploitation (High Scores)
**Intent**: Submit a high score with a future timestamp or client-forged date to break temporal integrity.
```json
{
  "name": "TIME_TRAVELER",
  "score": 50000,
  "level": 30,
  "classType": "Basic Tank",
  "date": "2050-12-31T23:59:59Z"
}
```

### Payload 6: String-Poisoning DOS Attack (High Scores)
**Intent**: Inject a massive, nested, or 10MB malicious string into `name` or `classType` to cause UI/database memory exhaustion.
```json
{
  "name": "VERY_LONG_STRING_REPEATED_TEN_THOUSAND_TIMES...",
  "score": 100,
  "level": 1,
  "classType": "Basic Tank_VERY_LONG_BLOB_FOR_EXHAUSTION...",
  "date": "2026-05-22T00:00:00Z"
}
```

### Payload 7: Hostile Score Overwrite (High Scores)
**Intent**: Perform an update to an existing public high score entry to change its value.
```json
// Attempting update on highScores/score_abc_123
{
  "name": "ORIGINAL_PLAYER",
  "score": 999999,
  "level": 45,
  "classType": "Colossal",
  "date": "2026-05-22T00:00:00Z"
}
```

### Payload 8: Immutable Creation Date Modification (Users)
**Intent**: Attempt an update that overwrites the user's `createdAt` timestamp to a backdated time.
```json
{
  "username": "LEGACY_PILOT",
  "createdAt": "2010-01-01T00:00:00Z",
  "currency": 100,
  "inventory": ["color_default"],
  "equippedItem": "color_default",
  "stats": {
    "totalGames": 1,
    "totalScore": 100,
    "highScore": 100,
    "maxLevel": 2,
    "totalKills": 0,
    "totalDeaths": 0
  }
}
```

### Payload 9: Invalid Data Typings (Users)
**Intent**: Change integers such as `currency` or stats to negative values or alternate shapes (e.g. booleans).
```json
{
  "username": "TYPE_HACK",
  "createdAt": "2026-05-22T00:47:38Z",
  "currency": -500,
  "inventory": "not-an-array",
  "equippedItem": 12345,
  "stats": {
    "totalGames": "fifty",
    "totalScore": true,
    "highScore": [],
    "maxLevel": {},
    "totalKills": -1,
    "totalDeaths": -5
  }
}
```

### Payload 10: Inventory Stealing / Shadow Swops (Users)
**Intent**: Directly force item unlock injection by forging the `inventory` array during an update without deducting currency.
```json
{
  "username": "ACQUIRER",
  "createdAt": "2026-05-22T00:47:38Z",
  "currency": 100,
  "inventory": ["color_default", "elite_skin_colossal", "elite_skin_leviathan", "color_glow_gold"],
  "equippedItem": "color_glow_gold",
  "stats": {
    "totalGames": 1,
    "totalScore": 100,
    "highScore": 100,
    "maxLevel": 1,
    "totalKills": 0,
    "totalDeaths": 0
  }
}
```

### Payload 11: Spoofed Achievement Grant (Users)
**Intent**: Forging unlocked achievement titles without fulfilling categories.
```json
{
  "username": "ACHIEVER",
  "createdAt": "2026-05-22T00:47:38Z",
  "currency": 100,
  "inventory": ["color_default"],
  "equippedItem": "color_default",
  "stats": {
    "totalGames": 0,
    "totalScore": 0,
    "highScore": 0,
    "maxLevel": 1,
    "totalKills": 0,
    "totalDeaths": 0,
    "achievementsUnlocked": ["eliminate_leviathan", "survive_void_portal", "colossal_damage_milestone"]
  }
}
```

### Payload 12: Anonymous System-Field Deletion (Users)
**Intent**: Completely removing crucial configuration properties during updates to break local state consistency.
```json
{
  "username": "DELETER",
  "createdAt": "2026-05-22T00:47:38Z"
  // stats, currency, inventory, equippedItem are completely deleted
}
```

---

## 3. Test Runner Design (`firestore.rules.test.ts`)

A suite designed to execute the payloads against the configured security layer and confirm zero vulnerabilities.

```typescript
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "eternal-cirrus-ftn3v",
    firestore: {
      rules: require('fs').readFileSync('firestore.rules', 'utf8')
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

test("Deny arbitrary shadow fields and unauthorized user modifications", async () => {
  const aliceContext = testEnv.authenticatedContext("alice_id");
  const bobContext = testEnv.authenticatedContext("bob_id");
  
  const aliceDoc = doc(aliceContext.firestore(), "users/alice_id");
  const bobDoc = doc(bobContext.firestore(), "users/alice_id"); // Attacker Bob accessing Alice's record

  // Test 1: Alice successfully registers with regular data
  await expect(setDoc(aliceDoc, {
    username: "alice",
    createdAt: new Date(),
    currency: 100,
    inventory: ["color_default"],
    equippedItem: "color_default",
    stats: {
      totalGames: 0,
      totalScore: 0,
      highScore: 0,
      maxLevel: 1,
      totalKills: 0,
      totalDeaths: 0,
      eliteKills: 0,
      transformations: 0,
      highestEliteDamage: 0,
      achievementsUnlocked: []
    }
  })).resolves.not.toThrow();

  // Test 2: Bob tries to overwrite Alice's profile (Payload 2)
  await expect(setDoc(bobDoc, {
    username: "alice_hijacked",
    createdAt: new Date(),
    currency: 99999,
    inventory: ["color_default"],
    equippedItem: "color_default",
    stats: {
      totalGames: 1,
      totalScore: 1000,
      highScore: 1000,
      maxLevel: 1,
      totalKills: 0,
      totalDeaths: 0
    }
  })).rejects.toThrow();

  // Test 3: Alice tries to insert "isAdmin" shadow property (Payload 1)
  await expect(updateDoc(aliceDoc, {
    isAdmin: true
  })).rejects.toThrow();
});
```
