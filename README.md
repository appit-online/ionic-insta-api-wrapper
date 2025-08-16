# [ionic-insta-story-search: Node.js](https://github.com/appit-online/ionic-insta-story-search)

A lightweight library to **fetch Instagram Stories, Reels, Highlights, user details, profiles, posts...**, including login and cookie handling — built for use in **Ionic** and **Cordova** environments with native HTTP support.

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

### Cookie-based Authentication
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

### Token Authentication
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
```

```javascript

/**
 * Get insta story tray
 * @param {string} request headers @optional - required for token authentication
 */
 // 📲 Initialize InstaService
const igService = new instaStory.InstaService();

const requestHeaders = {
  'Authorization':userDetails.headers["ig-set-authorization"],
  "Ig-U-Ds-User-Id": userDetails.headers["ig-set-ig-u-ds-user-id"],
  "Ig-U-Rur": userDetails.headers["ig-set-ig-u-rur"],
  "X-Ig-Www-Claim": userDetails.headers["x-ig-set-www-claim"],
}

// 📖 Fetch Instagram Tray Stories
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
 * @param {string} request headers @optional - required for token authentication
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
   "id": "123008993",
   "username": "someusername",
   "name": "User Name", 
   "profilePicture": "https://scontent-muc2-1.cdninstagram.com/v/t51.2885-19/403891526_89150552568277163_n.jpg",
   "stories_count": 10,
   "media": [
    {
      "id": "36999034226_191008993",
      "taken_at": 1755282929,
      "expiring_at": 1755369329,
      "original_width": 640,
      "original_height": 1136,
      "caption": null,
      "thumbnail": "https://scontent-muc2-1.cdninstagram.com/v/t51.2885-15/533658976_73414557283417579416565_n.jpg",
      "thumbnailDefault": "https://scontent-muc2-1.cdninstagram.com/v/t51.2885-15/53365897678818856079416565_n.jpg",
      "type": "video",
      "mimetype": "video/mp4",
      "url": "https://scontent-muc2-1.cdninstagram.com/o1/v/t2/f2/m78/AQOcKHtdfCkfdfJ5XMY96xY4_IiwMQ7vvgM9U1Yo-lcutWgH9AfdDbofL1f8Y13r7g647Gk.mp4",
      "has_audio": true,
      "video_duration": 4.77
    },
    {
      "id": "369972572609_191008993",
      "taken_at": 1755261686,
      "expiring_at": 1755348086,
      "original_width": 1179,
      "original_height": 2096,
      "caption": null,
      "thumbnail": "https://scontent-muc2-1.cdninstagram.com/v/t51.2885-15/5331086517083875_n.jpg",
      "thumbnailDefault": "https://scontent-muc2-1.cdninstagram.com/v/t51.2885-15/533108886_701523226517083875_n.jpg",
      "type": "image",
      "mimetype": "image/jpeg",
      "url": "https://scontent-muc2-1.cdninstagram.com/v/t51.2885-15/533108886_18525701523226517083875_n.jpg",
      "has_audio": false,
      "video_duration": 0
    },
        ...
  ]
}
```

```javascript

/**
 * Get profile highlights
 * @param {string} username value
 * @param {string} request headers @optional - required for token authentication
 */
try {
  const reqHeaders = {}
  const stories = await igService.getHighlights('someuser', reqHeaders);
  console.log(stories);
} catch (error: any) {
  console.error('Unknown error:', error);
}

{
  "last_paginated_highlights_node_edited_at_ts": null,
  "has_fetched_all_remaining_highlights": null,
  "suggested_highlights": {},
  "cursor": null,
  "highlights_tray_type": "DEFAULT",
  "my_week_enabled": null,
  "status": "ok",
  "tray": [
  {
    "id": "highlight:1234567890",
    "reel_type": "highlight_reel",
    "title": "Mein Highlight",
    "created_at": 1700000000,
    "is_pinned_highlight": false,
    "prefetch_count": 0,
    "disabled_reply_types": [
      "story_remix_reply",
      "story_selfie_reply"
    ],
    "highlight_reel_type": "DEFAULT",
    "is_converted_to_clips": false,
    "is_nux": false,
    "can_gif_quick_reply": true,
    "can_reshare": false,
    "is_archived": false,
    "strong_id__": "highlight:1234567890",
    "cover_media": {
      "crop_rect": [0.1, 0.1, 0.9, 0.9],
      "media_id": "9876543210_123456789",
      "upload_id": null,
      "cropped_image_version": {
        "height": 150,
        "scans_profile": "",
        "url": "https://example.com/cropped_image.jpg",
        "width": 150
      },
      "full_image_version": null
    },
    "ranked_position": -1000,
    "seen_ranked_position": -1000,
    "media_count": 10,
    "updated_timestamp": 1700001000,
    "latest_reel_media": 1700000500,
    "seen": null,
    "can_reply": true,
    "can_react_with_avatar": false,
    "contains_stitched_media_blocked_by_rm": false,
    "user": {
      "pk": "123456789",
      "full_name": "Max Mustermann",
      "pk_id": "123456789",
      "id": "123456789",
      "strong_id__": "123456789",
      "username": "max123",
      "is_private": false,
      "is_verified": false,
      "profile_pic_id": "1111111111_123456789",
      "profile_pic_url": "https://example.com/profile_pic.jpg",
      "account_badges": [],
      "interop_messaging_user_fbid": 999999999999,
      "is_creator_agent_enabled": false
    }
  }
]
}


````

```javascript
/**
 * Get insta userId
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

```javascript
/**
 * Get insta posts from user profile
 * @param {string} username value
 * @param {string} maxId - pagination of user posts - use response attribute next_max_id for more posts
 * @param {string} request headers @optional
 */
try {
  const reqHeaders = {}
  const profile = await igService.fetchUserProfilePosts('someuser', '', reqHeaders);
  console.log(profile);
} catch (error: any) {
  console.error('Unknown error:', error);
}

try {
  const reqHeaders = {}
  const profile = await igService.fetchUserPostsByUserId('190008993', '', reqHeaders);
  console.log(profile);
} catch (error: any) {
  console.error('Unknown error:', error);
}

{
  "id": "123455",
  "username": "username",
  "name": "User Name",
  "is_private": false,
  "is_verified": true,
  "profile_pic_url": "https://scontent-muc2-1.cdninstagram.com/v/t51.2885-19/403891521097167925951577163_n.jpg",
  "more_available": true,
  "next_max_id": "3696312669046_13753680437",
  "media": [
  {
    "like_and_view_counts_disabled": false,
    "has_privately_liked": false,
    "is_post_live_clips_media": false,
    "is_quiet_post": false,
    "taken_at": 1755342216,
    "has_tagged_users": false,
    "media_type": 2,
    "code": "DUMMYCODE123",
    "caption": {
      "text": "🔥 Beispieltext 🔥\n\nHier steht ein Dummy-Beitrag mit Hashtags und Emojis. 🏆\n\n#Beispiel #Dummy #Test"
    },
    "play_count": 12345,
    "has_views_fetching": true,
    "ig_play_count": 12345,
    "image_versions2": {
      "candidates": [
        {
          "height": 1920,
          "width": 1080,
          "url": "https://example.com/image_1080.jpg"
        },
        {
          "height": 1333,
          "width": 750,
          "url": "https://example.com/image_750.jpg"
        },
        {
          "height": 1137,
          "width": 640,
          "url": "https://example.com/image_640.jpg"
        },
        {
          "height": 853,
          "width": 480,
          "url": "https://example.com/image_480.jpg"
        },
        {
          "height": 568,
          "width": 320,
          "url": "https://example.com/image_320.jpg"
        }
      ]
    }
  },...
```

```javascript

/**
 * Get post, reel... by url
 * @param {string} url 
 * @param {string} request headers @optional - required for token authentication
 */
try {
  const requestHeaders = {
    'Authorization':userDetails.headers["ig-set-authorization"],
    "Ig-U-Ds-User-Id": userDetails.headers["ig-set-ig-u-ds-user-id"],
    "Ig-U-Rur": userDetails.headers["ig-set-ig-u-rur"],
    "X-Ig-Www-Claim": userDetails.headers["x-ig-set-www-claim"],
  }
  
  const post = await igService.fetchContentByUrl('https://www.instagram.com/p/DM777IJO7rd/?igsh=MWM2ejl2Mm8zcWRtcg==', requestHeaders); 
  console.log(post);
} catch (error: any) {
  console.error('Unknown error:', error);
}

/**
 * Get post by shortCode
 * @param {string} shortCode
 * @param {string} request headers @optional - required for token authentication
 */
try {
  const requestHeaders = {
    'Authorization':userDetails.headers["ig-set-authorization"],
    "Ig-U-Ds-User-Id": userDetails.headers["ig-set-ig-u-ds-user-id"],
    "Ig-U-Rur": userDetails.headers["ig-set-ig-u-rur"],
    "X-Ig-Www-Claim": userDetails.headers["x-ig-set-www-claim"],
  }

  const post = await igService.fetchContentByShortCode('AU7s3IJO7rd', requestHeaders);
  console.log(post);
} catch (error: any) {
  console.error('Unknown error:', error);
}

{
  "username": "dummyuser",
  "name": "Max Mustermann",
  "postType": "p",
  "media_id": "123456789012345678_9876543210",
  "shortcode": "ABC123XYZ",
  "createdAt": 1700000000,
  "likes": 42,
  "caption": "Hier ist ein Dummy-Beitrag mit Bild. 🌟🥳 #dummy #testpost",
  "media_count": 1,
  "comment_count": 3,
  "video_duration": 0,
  "music": {},
  "media": [
    {
      "id": "123456789012345678_9876543210",
      "thumbnail": "https://via.placeholder.com/1080x1350.png?text=Thumbnail",
      "url": "https://via.placeholder.com/1080x1350.png?text=Full+Image",
      "type": "image",
      "dimensions": {
        "height": 1350,
        "width": 1080
      }
    }
  ]
}
```


```javascript
/**
 * Get post, highlight, reel by mediaId
 * @param {string} mediaId
 * @param {string} request headers @optional - required for token authentication
 */
try {
  const requestHeaders = {
    'Authorization':userDetails.headers["ig-set-authorization"],
    "Ig-U-Ds-User-Id": userDetails.headers["ig-set-ig-u-ds-user-id"],
    "Ig-U-Rur": userDetails.headers["ig-set-ig-u-rur"],
    "X-Ig-Www-Claim": userDetails.headers["x-ig-set-www-claim"],
  }

  const post = await igService.fetchContentByMediaId('3691741226493_45705178442', requestHeaders);
  console.log(post);
} catch (error: any) {
  console.error('Unknown error:', error);
}

{
  "num_results": 1,
  "more_available": false,
  "items": [
    {
      "like_and_view_counts_disabled": false,
      "has_privately_liked": false,
      "is_post_live_clips_media": false,
      "is_quiet_post": false,
      "taken_at": 1754655492,
      "media_type": 2,
      "code": "DUMMY_CODE_123",
      "has_views_fetching": true,
      "image_versions2": {
        "candidates": [
          {
            "height": 1136,
            "width": 640,
            "url": "https://example.com/image1_1136x640.jpg"
          },
          {
            "height": 852,
            "width": 480,
            "url": "https://example.com/image2_852x480.jpg"
          },
          {
            "height": 568,
            "width": 320,
            "url": "https://example.com/image3_568x320.jpg"
          },
          {
            "height": 426,
            "width": 240,
            "url": "https://example.com/image4_426x240.jpg"
          },
          {
            "height": 640,
            "width": 640,
            "url": "https://example.com/image5_640x640.jpg"
          }
        ]
      }
    }
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
