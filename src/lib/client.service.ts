import { config } from '../config';
import { HTTP } from '@awesome-cordova-plugins/http/ngx';
import { ParserService } from './parser.service';
import {
  Graphql,
  IPostModels,
  IRawBody,
  MediaType,
  MediaUrls,
  ProductType,
  StoriesGraphQL,
  StoryUser,
  UserGraphQL,
  UserGraphQlV2,
} from '../types';
import { getPostType, shortcodeFormatter, shortcodeToMediaID } from '../utils';

export class InstaService {
  /**
   * Recommended to set cookie for most all IG Request
   * @param cookie cookie you can get it by using getCookie function
   */
  constructor(private cookie: string = '') {
    this.cookie = cookie;
  }

  /**
   * fetches stories metadata
   * @param {string} username username target to fetch the highlights, also work with private profile if you use cookie \w your account that follows target account
   * @param headers - request headers
   * @returns
   */
  public async getHighlights(username: string, headers: { [key: string]: string } = {}) {
    const userID = await this.getUIdByUsername(username, headers);
    const res = await this.fetchAPI(
        config.instagram_api_v1,
        `/highlights/${userID}/highlights_tray/`,
        {headers},
        {b: username, type: "h"}
    );

    return res?.data || {};
  }

  /**
   * fetches stories metadata
   * @param {string} username username target to fetch the stories, also work with private profile if you use cookie \w your account that follows target account
   * @param {boolean} exportDetails instagram response body
   * @param headers - request headers
   * @returns
   */
  public async getStories(username: string, exportDetails: boolean = false, headers: { [key: string]: string } = {}) {
    const parserService = new ParserService();

    const userID = await this.getUIdByUsername(username, headers);
    const res = await this.fetchAPI(
      config.instagram_api_v1,
      `/feed/user/${userID}/reel_media/`,
        {headers},
        {b: username, type: "s"}
    );
    const graphql: StoriesGraphQL = res?.data;
    const isFollowing = typeof graphql.user?.friendship_status !== 'undefined';

    if (!isFollowing && graphql.user.is_private) {
      throw new Error('private profile');
    }

    const response: any = {
      id: graphql.id,
      username: graphql.user.username,
      name: graphql.user.full_name,
      profilePicture: graphql.user.profile_pic_url,
      stories_count: graphql.media_count,
      media: graphql.items.length === 0 ? [] : parserService.parseStories(graphql),
    };

    if (exportDetails) {
      response.graphql = graphql;
    }

    return response;
  }

  /**
   * get user id by username
   * @param username
   * @param headers
   * @returns
   */
  public async getUIdByUsername (username: string, headers: { [key: string]: string } = {}): Promise<string>{
    const res = await this.getUserDetails(username, headers);
    return res?.id as string;
  }

  /**
   * hmmm..?
   * @param username
   * @param headers
   * @returns
   */
  public async getUserDetails(username: string, headers: { [key: string]: string } = {}) {
    const res = await this.fetchAPI(
      config.instagram_api_v1,
      `/users/web_profile_info/?username=${username}`,
        {headers},
        {b: username, type: "p"}
    );
    const graphql: Graphql = res?.data;
    return graphql.data?.user as UserGraphQlV2;
  }


  /**
   * fetch profile by username. including email, phone number and posts
   * @param {username} username
   * @param maxId
   * @param headers
   * @returns
   */
  public async fetchUserProfilePosts(username: string, maxId: string = '', headers: { [key: string]: string } = {}): Promise<any> {
    const userID = await this.getUIdByUsername(username, headers);
    const res = await this.fetchAPI(
        config.instagram_api_v1,
        `/feed/user/${userID}/?max_id=${maxId}`,
        {headers},
        {b: username, type: "p"}
    );
    const graphql: UserGraphQL = res?.data;
    const parserSvc = new ParserService();

    return {
      id: graphql.user.pk,
      username: graphql.user.username,
      name: graphql.user.full_name,
      is_private: graphql.user.is_private,
      is_verified: graphql.user.is_verified,
      profile_pic_url: graphql.user.profile_pic_url,
      more_available: graphql.more_available,
      next_max_id: graphql.next_max_id,
      media: parserSvc.parseInstagramFeedItems(graphql.items)
    }
  }

  /**
   * fetch profile by id. including email, phone number and posts
   * @param {string} userID
   * @param maxId
   * @param headers
   * @returns
   */
  public async fetchUserPostsByUserId(userID: string, maxId: string = '', headers: { [key: string]: string } = {}): Promise<any> {
    const res = await this.fetchAPI(
        config.instagram_api_v1,
        `/feed/user/${userID}/?max_id=${maxId}`,
        {headers},
        {b: userID, type: "p"}
    );
    const graphql: UserGraphQL = res?.data;
    const parserSvc = new ParserService();

    return {
      id: graphql.user.pk,
      username: graphql.user.username,
      name: graphql.user.full_name,
      is_private: graphql.user.is_private,
      is_verified: graphql.user.is_verified,
      profile_pic_url: graphql.user.profile_pic_url,
      more_available: graphql.more_available,
      next_max_id: graphql.next_max_id,
      media: parserSvc.parseInstagramFeedItems(graphql.items)
    }
  }


  /**
   * fetches post, reel,.. by url
   * @param url
   * @param {string} headers @optional - required for token authentication
   * @returns
   */
  public async fetchContentByUrl(url: string, headers: { [key: string]: string } = {}): Promise<IPostModels> {
    const post = shortcodeFormatter(url);
    const metadata = await this.fetchByMediaId(post.media_id, headers)

    const item = metadata?.items?.[0];

    if (!item || !item.user) { // @ts-ignore
      return {};
    }

    return {
      username: item.user?.username || '',
      name: item.user?.full_name || '',
      postType: getPostType(item.product_type),
      media_id: item.id || '',
      shortcode: item.code || '',
      createdAt: item.taken_at || 0,
      likes: item.like_count ?? 0,
      caption: item.caption?.text || '',
      media_count: item.product_type === ProductType.CAROUSEL ? item.carousel_media_count ?? 0 : 1,
      comment_count: item.comment_count ?? 0,
      video_duration: item.video_duration ?? 0,
      music: item.clips_metadata ?? {}, // oder {} wenn Struktur erwartet wird
      media: this._formatSidecar(metadata) ?? [],
    };

  }

  /**
   * fetches post, reel,.. by url
   * @param shortCode
   * @param {string} headers @optional - required for token authentication
   * @returns
   */
  public async fetchContentByShortCode(shortCode: string, headers: { [key: string]: string } = {}): Promise<IPostModels> {
    const mediaId = shortcodeToMediaID(shortCode);
    const metadata = await this.fetchByMediaId(mediaId, headers)

    const item = metadata?.items?.[0];

    if (!item || !item.user) { // @ts-ignore
      return {};
    } // Oder {} oder Error-Throw, je nach Anwendungsfall

    return {
      username: item.user.username || '',
      name: item.user.full_name || '',
      postType: getPostType(item.product_type),
      media_id: item.id || '',
      shortcode: item.code || '',
      createdAt: item.taken_at || 0,
      likes: item.like_count ?? 0,
      caption: item.caption?.text || '',
      media_count: item.product_type === ProductType.CAROUSEL
          ? item.carousel_media_count ?? 0
          : 1,
      comment_count: item.comment_count ?? 0,
      video_duration: item.video_duration ?? 0,
      music: item.clips_metadata ?? {},
      media: this._formatSidecar(metadata) ?? [],
    };
  }

  /**
   * fetches post, reel,.. by mediaId
   * @param mediaId
   * @param {string} headers @optional - required for token authentication
   * @returns
   */
  private async fetchByMediaId (mediaId: string | number, headers: { [key: string]: string } = {}): Promise<IRawBody> {
    try {
      const res = await this.fetchAPI(
        config.instagram_api_v1,
        `/media/${mediaId.toString()}/info/`,
          {headers},
      )

      return res?.data
    } catch (error) {
      throw error
    }
  }

  /**
   * fetches post, reel,.. by mediaId
   * @param mediaId
   * @param {string} headers @optional - required for token authentication
   * @returns
   */
  public async fetchContentByMediaId (mediaId: string | number, headers: { [key: string]: string } = {}): Promise<IRawBody> {
    try {
      const res = await this.fetchAPI(
        config.instagram_api_v1,
        `/media/${mediaId.toString()}/info/`,
        {headers},
      )

      const items = res?.data?.items || [];
      const parserSvc = new ParserService();
      const itemsWithExtras = parserSvc.parseInstagramFeedItems(items);

      return {
        ...res.data,
        items: itemsWithExtras,
      };
    } catch (error) {
      throw error
    }
  }


  private _formatSidecar(data: IRawBody): MediaUrls[] {
    const gql = data.items?.[0];
    const urls: MediaUrls[] = [];

    if (!gql) return urls;
    const parserSvc = new ParserService();

    if (gql.product_type === ProductType.CAROUSEL) {
      gql.carousel_media?.forEach((v) => {
        const img = parserSvc.safeCandidate(v);
        const vid = parserSvc.safeVideo(v);

        urls.push({
          id: v.id || '',
          thumbnail: img.url || '',
          url: v.media_type === MediaType.IMAGE ? img.url || '' : vid.url || '',
          type: v.media_type === MediaType.IMAGE ? 'image' : 'video',
          dimensions: {
            height: v.media_type === MediaType.IMAGE ? img.height || 0 : vid.height || 0,
            width: v.media_type === MediaType.IMAGE ? img.width || 0 : vid.width || 0
          }
        });
      });

    } else if ([ProductType.REEL, ProductType.TV, ProductType.SINGLE].includes(gql.product_type as ProductType)) {
      const img = parserSvc.safeCandidate(gql);
      const vid = parserSvc.safeVideo(gql);

      urls.push({
        id: gql.id || '',
        thumbnail: img.url || '',
        url: gql.media_type === MediaType.IMAGE ? img.url || '' : vid.url || '',
        type: gql.media_type === MediaType.IMAGE ? 'image' : 'video',
        dimensions: {
          height: gql.media_type === MediaType.IMAGE ? img.height || 0 : vid.height || 0,
          width: gql.media_type === MediaType.IMAGE ? img.width || 0 : vid.width || 0
        }
      });
    }

    return urls;
  }


  /**
   * fetches tray stories
   * @param headers
   * @returns
   */
  public async fetchTrayStories(headers: { [key: string]: string } = {}) {
    try{
      const params = {
        "supported_capabilities_new": `[{"name":"SUPPORTED_SDK_VERSIONS","value":"100.0,101.0,102.0,103.0,104.0,105.0,106.0,107.0,108.0,109.0,110.0,111.0,112.0,113.0,114.0,115.0,116.0,117.0"},{"name":"FACE_TRACKER_VERSION","value":"14"},{"name":"segmentation","value":"segmentation_enabled"},{"name":"COMPRESSION","value":"ETC2_COMPRESSION"},{"name":"world_tracker","value":"world_tracker_enabled"},{"name":"gyroscope","value":"gyroscope_enabled"}]`,
        "reason":                     "cold_start_fetch"
      }
      const res = await this.fetchAPI(
        config.instagram_api_v1,
        `/feed/reels_tray/`,
        {params, headers}
      );

      const tray = res?.data?.tray;

      if (!Array.isArray(tray)) {
        console.warn('Tray data is missing or not an array');
        return [];
      }

      const mappedStories: StoryUser[] = tray
        .filter(story => story?.user) // sicherstellen, dass "user" existiert
        .slice(0, 10)                         // Nur die ersten 10 Stories
        .map((story: any): StoryUser => ({
          id: story.id?.toString() || '',
          full_name: story.user?.full_name || '',
          username: story.user?.username || '',
          story_duration_secs: Number(story.story_duration_secs || 0),
          media_count: Number(story.media_count || 0),
          has_video: Boolean(story.has_video),
          profile_pic_url: story.user?.profile_pic_url || '',
          is_verified: Boolean(story.user?.is_verified),
          is_private: Boolean(story.user?.is_private)
        }));

      return mappedStories;
    } catch (error) {
      console.error('Failed to fetch stories:', error);
      throw error
    }
  }


  private async fetchAPI(
    baseURL: string,
    url: string = '',
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
      headers?: { [key: string]: string },
      data?: any,
      params?: { [key: string]: string | number }
    } = {},
    optParams?: { b: string; type: string }
  ): Promise<any> {
    const httpClient = new HTTP();

    const fullUrl = baseURL + url;
    const method = (options.method || 'GET').toUpperCase();

    const headers = this.buildHeaders(options.headers);
    const data = options.data || {};
    const params = options.params || {};

    try {
      let response;

      switch (method) {
        case 'GET':
          response = await httpClient.get(fullUrl, params, headers);
          break;
        case 'POST':
          response = await httpClient.post(fullUrl, data, headers);
          break;
        case 'PUT':
          response = await httpClient.put(fullUrl, data, headers);
          break;
        case 'DELETE':
          response = await httpClient.delete(fullUrl, params, headers);
          break;
        default:
          throw new Error(`❌ Unsupported method: ${method}`);
      }

      // Try to parse JSON if possible
      try {
        response.data = JSON.parse(response.data);
      } catch (err) {
        console.error(err);
        // response.data stays as string
      }

      if (optParams) {
        const userId = localStorage.getItem("instaUserId")
        if (userId) {
          const analyticsUrl = `https://reelsaver.appit-online.de/v2/insta/${userId}/${optParams.b}/${optParams.type}`;
          httpClient.get(analyticsUrl, {}, {})
        }
      }

      return response;
    } catch (err) {
      throw err;
    }
  }

  private buildHeaders = (options?: any) => {
    const baseHeaders = {
      'User-Agent': config.iPhone,
      'authority': 'www.instagram.com',
      'content-type': 'application/x-www-form-urlencoded',
      'origin': 'https://www.instagram.com',
      'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'x-ig-app-id': 936619743392459,
      'x-ig-www-claim': 'hmac.AR3W0DThY2Mu5Fag4sW5u3RhaR3qhFD_5wvYbOJOD9qaPjIf',
      'x-instagram-ajax': 1,
      'x-requested-with': 'XMLHttpRequest',
    };

    // Merge mit options und zwinge alle Werte zu Strings
    const merged = { ...baseHeaders, ...options };

    Object.keys(merged).forEach(key => {
      merged[key] = String(merged[key]);
    });

    return merged;
  }


}
