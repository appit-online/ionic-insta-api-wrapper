# [ionic-insta-api-wrapper: Ionic](https://github.com/appit-online/ionic-insta-api-wrapper)

A lightweight library to **fetch Instagram Stories, Reels, Highlights, user details, profiles, posts...**, including login and cookie handling — built for use in **Ionic** and **Cordova** environments with native HTTP support.

---

## Features

- Login via **Instagram Bloks CAA** protocol directly from the user's device (user's IP — no server IP exposure)
- Full **2FA support** — TOTP, SMS, and airwave (push notification) accounts
- Follow and Like via Instagram Private API
- Fetch Stories, Highlights, Tray, User Profiles, Posts by URL/shortcode/mediaId
- Session persistence via `localStorage`
- Device parameters synced from backend (`/api/details`) for consistent headers

---

**Table of contents:**

* [Installation](#installation)
* [Login](#login)
* [API Usage](#api-usage)
* [License](#license)

## Installation

```bash
npm install ionic-insta-api-wrapper

ionic cordova plugin add cordova-plugin-advanced-http
```

## Login

### Default (Bloks CAA → Backend fallback)

```typescript
import { LoginService } from 'ionic-insta-api-wrapper';

const loginService = new LoginService({
  backendUrl: 'https://your-backend.example.com'
});

// Login — tries Bloks CAA first (user's IP), falls back to backend
const result = await loginService.login(username, password);

if (result.twoFactorRequired) {
  // Prompt user for code, then:
  const verified = await loginService.login2FA(password, code, '', username);
}
```

The lib automatically fetches device params from `{backendUrl}/api/details` before login to keep headers in sync with your backend config. All Instagram traffic goes directly from the user's device — the backend is never used as a login proxy.

## API Usage

```typescript
import { InstaService } from 'ionic-insta-api-wrapper';

const igService = new InstaService();
```

All API methods accept an optional `headers` parameter for auth. The lib uses Android headers by default — you only need to pass the session-specific auth headers:

```typescript
const authHeaders = {
  'Authorization': session.headers['ig-set-authorization'],
  'Ig-U-Ds-User-Id': session.headers['ig-set-ig-u-ds-user-id'],
  'Ig-U-Rur': session.headers['ig-set-ig-u-rur'],
  'X-Ig-Www-Claim': session.headers['x-ig-set-www-claim'],
};
```

### Stories

```typescript
// Tray (all stories of followed accounts)
const tray = await igService.fetchTrayStories(authHeaders);

// Stories of a specific user
const stories = await igService.getStories('someuser', true, authHeaders);

// Highlights
const highlights = await igService.getHighlights('someuser', authHeaders);
```

### User Info

```typescript
const uid = await igService.getUIdByUsername('someuser', authHeaders);
const profile = await igService.getUserDetails('someuser', authHeaders);
```

### Posts

```typescript
// By profile (paginated)
const posts = await igService.fetchUserProfilePosts('someuser', '', authHeaders);
// Next page:
const more = await igService.fetchUserProfilePosts('someuser', posts.next_max_id, authHeaders);

// By user ID
const posts2 = await igService.fetchUserPostsByUserId('123456789', '', authHeaders);

// By URL
const post = await igService.fetchContentByUrl('https://www.instagram.com/p/ABC123/', authHeaders);

// By shortcode
const post2 = await igService.fetchContentByShortCode('ABC123', authHeaders);

// By media ID
const post3 = await igService.fetchContentByMediaId('369174122649_457051784', authHeaders);
```

### Follow & Like

```typescript
const followed = await igService.follow('usernameOrId', authHeaders);
// { following: true, ... }

const liked = await igService.like('shortCode', authHeaders);
// { status: "ok" }
```

### Device Parameters

The lib ships with hardcoded Android device defaults (Pixel 8 Pro, Instagram 428.0.0.47.67). These match the Bloks login session and are used for all API calls.

To keep headers in sync with your backend, the `LoginService` fetches `GET {backendUrl}/api/details` once before the first login and applies the values. Expected response format:

```json
{
  "version": "428.0.0.47.67",
  "defaultCodeName": "husky",
  "defaultManufacturer": "Google/google",
  "defaultModel": "Pixel 8 Pro",
  "defaultAndroidVersion": "34",
  "defaultAndroidRelease": "14",
  "defaultScreenDpi": "480dpi",
  "defaultResolution": "1344x2992",
  "defaultAppVersionCode": "961145276",
  "bloksVersioningId": "7189b949425f9bf80ea8bd880cf5a3080b292d9b1c4b38a18d112f7c4b71e7a8"
}
```

## License

Apache Version 2.0

See [LICENSE](https://github.com/appit-online/ionic-insta-api-wrapper/blob/master/LICENSE)
