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

### Cookies Login
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
```

### Auth-Token Login 
```javascript
import * as instaStory from 'ionic-insta-story-search';

const username = 'your_instagram_username';
const password = 'your_instagram_password';

// 🔐 Get Instagram auth token
const userDetails: any = await loginService.login(username, password, reqHeaders);

// 💾 Save userDetails for reuse
localStorage.setItem('userDetails', userDetails);

// 📲 Initialize InstaService
const igService = new instaStory.InstaService();

const requestHeaders = {
  'Authorization':userDetails.headers["ig-set-authorization"],
  "Ig-U-Ds-User-Id": userDetails.headers["ig-set-ig-u-ds-user-id"],
  "Ig-U-Rur": userDetails.headers["ig-set-ig-u-rur"],
  "X-Ig-Www-Claim": userDetails.headers["x-ig-set-www-claim"],
}

const igService = new instaStory.InstaService();
const storyTray = await igService.fetchTrayStories(requestHeaders);
console.log(storyTray);

[
  {
    "id": "21335",
    "full_name": "Yoga Instructor",
    "username": "mrstest",
    "story_duration_secs": 5,
    "media_count": 4,
    "has_video": true,
    "profile_pic_url": "https://scontent-muc2-1.cdninstagram.com/v/5770385_n.jpg",
    "is_verified": false,
    "is_private": false
  },
  ...
]
```

```javascript

/**
 * Get insta story tray
 * @param {string} request headers @optional
 */
// 📖 Fetch Instagram Stories
const storyTray = await igService.fetchTrayStories(requestHeaders);
console.log(storyTray);
[
  {
  "id": "21335",
  "full_name": "Yoga Instructor",
  "username": "mrstest",
  "story_duration_secs": 5,
  "media_count": 4,
  "has_video": true,
  "profile_pic_url": "https://scontent-muc2-1.cdninstagram.com/v/5770385_n.jpg",
  "is_verified": false,
  "is_private": false
  },
  ...
]
```

```javascript

/**
 * Get insta stories
 * @param {string} username value
 * @param {boolean} export insta response @optional - include raw GraphQL data
 * @param {string} request headers @optional
 */
// 📖 Fetch Instagram Stories
try {
  const reqHeaders = {}
  const stories = await igService.getStories('someuser', true, reqHeaders); 
  console.log(stories);
} catch (error: any) {
  if (error.message === 'private profile') {
    console.warn('The user profile is private and stories cannot be accessed.');
  } else {
    console.error('Unknown error:', error);
  }
}

{
   "username":"someuser",
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


/**
 * Get insta stories
 * @param {string} username value
 * @param {string} request headers @optional
 */
// 📖 Fetch Instagram UserId
try {
  const reqHeaders = {}
  const uid = await igService.getUIdByUsername('someuser', reqHeaders); 
  console.log(uid);
} catch (error: any) {
  console.error('Unknown error:', error);
}


/**
 * Get insta profile
 * @param {string} username value
 * @param {string} request headers @optional
 */
// 📖 Fetch Instagram Stories
try {
  const reqHeaders = {}
  const profile = await igService.getUserDetails('someuser', reqHeaders);
  console.log(profile);
} catch (error: any) {
  console.error('Unknown error:', error);
}

{
  "ai_agent_type": null,
  "biography": "Example biography with some emojis and mentions like @exampleuser.",
  "bio_links": [
    {
      "title": "",
      "lynx_url": "https://l.instagram.com/?u=http%3A%2F%2Fexample.com%2Fprofile&e=AT123456789",
      "url": "http://example.com/profile",
      "link_type": "external"
    }
  ],
  "fb_profile_biolink": null,
   "biography_with_entities": {
      "raw_text": "Example biography with @users and #hashtags",
      "entities": [
        {
          "user": {
            "username": "exampleuser"
          },
          "hashtag": null
        }
      ]
  },
  "blocked_by_viewer": false,
  "restricted_by_viewer": false,
  "country_block": false,
  "eimu_id": "1234567890",
  "external_url": "http://example.com",
  "external_url_linkshimmed": "https://l.instagram.com/?u=http%3A%2F%2Fexample.com&e=AT123456789",
  "edge_followed_by": {
    "count": 12345
  },
  "fbid": "17840000000000000",
  "followed_by_viewer": true,
  "edge_follow": {
    "count": 150
  },
  "follows_viewer": false,
  "full_name": "Example Name",
  "group_metadata": null,
  "has_ar_effects": false,
  "has_clips": true,
  "has_guides": false,
  "has_chaining": true,
  "has_channel": false,
  "has_blocked_viewer": false,
  "highlight_reel_count": 5,
  "has_requested_viewer": false,
  "hide_like_and_view_counts": false,
  "id": "123456789",
  "is_business_account": false,
  "is_professional_account": true,
  "is_supervision_enabled": false,
  "is_guardian_of_viewer": false,
  "is_supervised_by_viewer": false,
  "is_supervised_user": false,
  "is_embeds_disabled": false,
  "is_joined_recently": false,
  "guardian_id": null,
  "business_address_json": null,
  "business_contact_method": "UNKNOWN",
  "business_email": null,
  "business_phone_number": null,
  "business_category_name": null,
  "overall_category_name": null,
  "category_enum": null,
  "category_name": "Public Figure",
  "is_private": false,
  "is_verified": true,
  "is_verified_by_mv4b": false,
  "is_regulated_c18": false,
  "edge_mutual_followed_by": {
    "count": 0,
    "edges": []
  },
  "pinned_channels_list_count": 0,
  "profile_pic_url": "https://example.com/profile.jpg",
  "profile_pic_url_hd": "https://example.com/profile_hd.jpg",
  "requested_by_viewer": false,
  "should_show_category": true,
  "should_show_public_contacts": false,
  "show_account_transparency_details": true,
  "transparency_label": null,
  "transparency_product": null,
  "username": "exampleuser",
  "pronouns": [],
  "edge_owner_to_timeline_media": {
      "count": 100,
      "page_info": {
        "has_next_page": true,
        "end_cursor": ""
      },
      "edges": []
  }
}
```

## Supported Node.js Versions

Our client libraries follow the [Node.js release schedule](https://nodejs.org/en/about/releases/).
Libraries are compatible with all current _active_ and _maintenance_ versions of
Node.js.

## License

Apache Version 2.0

See [LICENSE](https://github.com/appit-online/ionic-insta-story-search/blob/master/LICENSE)
