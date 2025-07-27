import { config } from '../config';
import { HTTP } from '@awesome-cordova-plugins/http/ngx';
import { ParserService } from './parser.service';
import { Graphql, StoriesGraphQL, UserGraphQlV2 } from '../types';

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
   * @param {string} username username target to fetch the stories, also work with private profile if you use cookie \w your account that follows target account
   * @param {boolean} exportDetails instagram response body
   * @param {string} agent provide different user agent
   * @returns
   */
  public async getStories(username: string, exportDetails: boolean = false, agent: string = config.iPhone) {
    const parserService = new ParserService();

    const userID = await this.getUIdByUsername(username, agent);
    const res = await this.fetchAPI(
      config.instagram_api_v1,
      `/feed/user/${userID}/reel_media/`,
        agent
    );
    const graphql: StoriesGraphQL = res?.data;
    const isFollowing = typeof graphql.user?.friendship_status !== 'undefined';

    if (!isFollowing && graphql.user.is_private) {
      throw new Error('private profile');
    }

    const response: any = {
      username: graphql.user.username,
      stories_count: graphql.media_count,
      stories: graphql.items.length === 0 ? null : parserService.parseStories(graphql),
    };

    if (exportDetails) {
      response.graphql = graphql;
    }

    return response;
  }

  /**
   * get user id by username
   * @param username
   * @param {string} agent provide different user agent
   * @returns
   */
  public async getUIdByUsername (username: string, agent: string = config.iPhone): Promise<string>{
    const res = await this.getUserDetails(username, agent);
    return res?.id as string;
  }

  /**
   * hmmm..?
   * @param username
   * @param agent
   * @returns
   */
  public async getUserDetails(username: string, agent: string = config.iPhone) {
    const res = await this.fetchAPI(
      config.instagram_api_v1,
      `/users/web_profile_info/?username=${username}`,
      agent,
    );
    const graphql: Graphql = res?.data;
    return graphql.data?.user as UserGraphQlV2;
  }

  private async fetchAPI(
    baseURL: string,
    url: string = '',
    agent: string = config.iPhone,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
      headers?: { [key: string]: string },
      data?: any,
      params?: { [key: string]: string | number }
    } = {}
  ): Promise<any> {
    const httpClient = new HTTP();

    const fullUrl = baseURL + url;
    const method = (options.method || 'GET').toUpperCase();

    const headers = options.headers || this.buildHeaders(agent);
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

      return response;
    } catch (err) {
      console.error('❌ FetchIGAPI Error:', err);
      throw err;
    }
  }

  private buildHeaders = (agent: string = config.iPhone, options?: any) => {
    const baseHeaders = {
      'user-agent': agent,
      'cookie': `${this.cookie}`,
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
