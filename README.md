# [ionic-insta-story-search: Node.js](https://github.com/appit-online/ionic-insta-story-search)

A lightweight library to **fetch Instagram Stories, user details, profiles, posts...**, including login and cookie handling — built for use in **Ionic** and **Cordova** environments with native HTTP support.

---

## 🚀 Features

- 🔐 Login and fetch session cookie via `getCookie`
- 🍪 Save & reuse session cookies with expiration check
- 📖 Fetch public Instagram stories with `InstaService.getStories`
---

**Table of contents:**

* [Quickstart](#quickstart)

  * [Installing the library](#installation)
  * [Using the library](#using-the-library)
* [License](#license)

## Quickstart


## 📦 Installation

```bash
npm install ionic-insta-story-search

ionic cordova plugin add cordova-plugin-advanced-http
npm install ionic-insta-story-search --save
```

### Using the library

```javascript
import * as instaStory from 'ionic-insta-story-search';

const username = 'your_instagram_username';
const password = 'your_instagram_password';

// 🔐 Get Instagram session cookie (with optional force refetch)
const refetchCookie = true;
const userDetails = await instaStory.getCookie(username, password, refetchCookie);

// 💾 Save cookie & expiration for reuse
localStorage.setItem('cookie', userDetails.cookie);
localStorage.setItem('expires', userDetails.expires);

// 📲 Initialize InstaService with your session cookie
const igService = new instaStory.InstaService(userDetails.cookie);


/**
 * Get insta stories
 * @param {string} username value (instaId).
 * @param {boolean} export insta response
 * @param {string} User-Agent
 */
// 📖 Fetch Instagram Stories
try {
  const stories = await igService.getStories('someuser', true, "User-Agent"); // true = include raw GraphQL data
  console.log(stories);
} catch (error: any) {
  if (error.message === 'private profile') {
    console.warn('The user profile is private and stories cannot be accessed.');
  } else {
    console.error('Unknown error:', error);
  }
}

{
  "username":"vfb",
   "stories_count": 37,
   "stories": [
    {
      "type": "image",
      "mimetype": "image/jpeg",
      "url": "https://scontent-muc2-1.cdninstagram.com/",
      "taken_at": 1753540298,
      "expiring_at": 1753626698,
      "id": "3685285611",
      "original_width": 1179,
      "original_height": 2096,
      "has_audio": null,
      "video_duration": null,
      "caption": null
    },
    {
      "type": "video",
      "mimetype": "video/mp4",
      "url": "https://scontent-muc2-1.cdninstagram.com/",
      "taken_at": 1753547410,
      "expiring_at": 1753633810,
      "id": "36853452997406",
      "original_width": 640,
      "original_height": 1136,
      "has_audio": true,
      "video_duration": 15.243,
      "caption": null
    },
        ...
  ]
}

```

## Supported Node.js Versions

Our client libraries follow the [Node.js release schedule](https://nodejs.org/en/about/releases/).
Libraries are compatible with all current _active_ and _maintenance_ versions of
Node.js.

## License

Apache Version 2.0

See [LICENSE](https://github.com/appit-online/ionic-insta-story-search/blob/master/LICENSE)
