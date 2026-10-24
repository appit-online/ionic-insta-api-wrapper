// Bloks CAA login client — direct Instagram Bloks protocol (no backend proxy).
//
// Port of instlytics/backend/pkg/instago/auth.go + auth_bloks2fa.go.
// Calls b.i.instagram.com directly from the user's device so login uses the
// user's IP instead of the backend's IP.
//
// Flow:
//   login()     → send_login_request → session OR { twoFactorRequired: true }
//   verify2FA() → entrypoint → (airwave?) method_picker → verify_code.async
//
import { v4 as uuidv4 } from 'uuid';
import * as forge from 'node-forge';
import { HTTP } from '@awesome-cordova-plugins/http/ngx';

export interface BloksLoginResult {
  twoFactorRequired?: boolean;
  authorization?: string; // Bearer IGT:2:...
  userId?: string;
}

const DEFAULT_BLOKS_VERSION_ID = '7189b949425f9bf80ea8bd880cf5a3080b292d9b1c4b38a18d112f7c4b71e7a8';
const DEFAULT_ANDROID_UA       = 'Instagram 428.0.0.47.67 Android (34/14; 480dpi; 1344x2992; Google/google; Pixel 8 Pro; husky; husky; en_US; 961145276)';
const APP_ID                   = '567067343352427';
const IG_API                   = 'https://i.instagram.com/api/v1';
const BLOKS_API                = 'https://b.i.instagram.com/api/v1';

export interface BloksDeviceParams {
  version?: string;
  defaultCodeName?: string;
  defaultManufacturer?: string;
  defaultModel?: string;
  defaultAndroidVersion?: string;
  defaultAndroidRelease?: string;
  defaultScreenDpi?: string;
  defaultResolution?: string;
  defaultAppVersionCode?: string;
  bloksVersioningId?: string;
}

export class BloksLoginService {
  private pubKey: string  = '';
  private pubKeyId: number = -1;
  private bloks2FAContext  = '';
  private bloks2FAScreenID = '';
  private bloksVersionId   = DEFAULT_BLOKS_VERSION_ID;
  private userAgent        = DEFAULT_ANDROID_UA;

  constructor(
    private readonly uuid: string,
    private readonly phoneId: string,
    private readonly androidDeviceId: string,
  ) {}

  /**
   * Override device parameters fetched from the backend /api/details endpoint.
   * Call this before login() to ensure consistent headers with the backend.
   */
  setDeviceParams(p: BloksDeviceParams): void {
    if (p.bloksVersioningId) this.bloksVersionId = p.bloksVersioningId;
    if (p.version) {
      const res = p.defaultResolution || '1344x2992';
      const mfr = p.defaultManufacturer || 'Google/google';
      this.userAgent =
        `Instagram ${p.version} Android ` +
        `(${p.defaultAndroidVersion || '34'}/${p.defaultAndroidRelease || '14'}; ` +
        `${p.defaultScreenDpi || '480dpi'}; ${res}; ${mfr}; ` +
        `${p.defaultModel || 'Pixel 8 Pro'}; ${p.defaultCodeName || 'husky'}; ${p.defaultCodeName || 'husky'}; ` +
        `en_US; ${p.defaultAppVersionCode || '961145276'})`;
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async login(username: string, password: string): Promise<BloksLoginResult> {
    await this.preLoginFlow();

    if (!this.pubKey || this.pubKeyId < 0) {
      await this.fetchPubKey();
    }

    const encPass = this.encryptPassword(password, this.pubKey, this.pubKeyId);

    const params = {
      client_input_params: {
        contact_point:    username,
        password:         encPass,
        device_id:        this.androidDeviceId,
        family_device_id: this.phoneId,
        machine_id:       uuidv4(),
      },
      server_params: {
        waterfall_id:        uuidv4(),
        login_entry_point:   'logged_out',
        two_step_login_type: 'one_step_login',
      },
    };

    const resp = await this.bloksRequest(
      'bloks/apps/com.bloks.www.bloks.caa.login.async.send_login_request/',
      params,
      'IgApi: bloks/async_action/com.bloks.www.bloks.caa.login.async.send_login_request/',
    );

    const rawStr = JSON.stringify(resp);
    const twoFACtx = bloksExtract2FAContext(rawStr);

    if (twoFACtx) {
      this.bloks2FAContext  = twoFACtx;
      this.bloks2FAScreenID = bloksExtractScreenID(rawStr);
      this.save2FACtx(username);
      return { twoFactorRequired: true };
    }

    const session = bloksExtractSession(rawStr);
    if (!session) {
      throw new Error('ig: bloks login — no session in response');
    }
    this.clear2FACtx(username);
    return session;
  }

  async verify2FA(username: string, code: string): Promise<BloksLoginResult> {
    if (!this.bloks2FAContext) {
      if (!this.load2FACtx(username)) {
        throw new Error('ig: no 2FA context — start login first');
      }
    }

    // Attempt 1: direct verify_code
    try {
      const r1 = await this.callVerifyCode(code);
      const s1 = bloksExtractSession(JSON.stringify(r1));
      if (s1) { this.clear2FACtx(username); return s1; }
    } catch (_) {}

    // Attempt 2: entrypoint → (airwave?) method_picker → navigation.async
    const epResult = await this.callEntrypoint();
    if (epResult) {
      const epStr = JSON.stringify(epResult);
      const updCtx = bloksExtract2FAContext(epStr);
      if (updCtx) { this.bloks2FAContext = updCtx; this.save2FACtx(username); }
      const updSID = bloksExtractScreenID(epStr);
      if (updSID) this.bloks2FAScreenID = updSID;

      if (bloksDetectAirwave(epStr)) {
        await this.callMethodPicker();

        const navResult = await this.callMethodPickerNavigation();
        if (navResult) {
          const navStr = JSON.stringify(navResult);
          const navCtx = bloksExtract2FAContext(navStr);
          if (navCtx) { this.bloks2FAContext = navCtx; this.save2FACtx(username); }
          const navSID = bloksExtractScreenID(navStr);
          if (navSID) this.bloks2FAScreenID = navSID;
        }
      }
    }

    // Attempt 3a: verify_code with challenge=totp
    try {
      const r3a = await this.callVerifyCodeTOTP(code);
      const s3a = bloksExtractSession(JSON.stringify(r3a));
      if (s3a) { this.clear2FACtx(username); return s3a; }
    } catch (_) {}

    // Attempt 3b: verify_code with screenID (fallback)
    const r3b = await this.callVerifyCode(code);
    const s3b = bloksExtractSession(JSON.stringify(r3b));
    if (!s3b) throw new Error('ig: 2FA verify failed — no session in response');
    this.clear2FACtx(username);
    return s3b;
  }

  // ─── Pre-login & key fetch ─────────────────────────────────────────────────

  private async preLoginFlow(): Promise<void> {
    try {
      const http = new HTTP();
      http.setDataSerializer('urlencoded');
      await http.post(
        `${IG_API}/launcher/sync/`,
        this.signedBody({ id: this.uuid, server_config_retrieval: '1' }),
        this.baseHeaders(),
      );
    } catch (_) {} // throttling errors are non-fatal
  }

  private async fetchPubKey(): Promise<void> {
    const http = new HTTP();
    http.setDataSerializer('urlencoded');
    const resp = await http.post(
      `${IG_API}/launcher/sync/`,
      this.signedBody({ id: this.uuid, server_config_retrieval: '1' }),
      this.baseHeaders(),
    );
    const k = resp.headers['ig-set-password-encryption-pub-key'] || '';
    const i = resp.headers['ig-set-password-encryption-key-id'];
    if (k && i) {
      this.pubKey   = k;
      this.pubKeyId = parseInt(i, 10);
    }
  }

  // ─── Bloks HTTP ────────────────────────────────────────────────────────────

  private async bloksRequest(
    endpoint: string,
    params: Record<string, any>,
    friendlyName: string,
  ): Promise<any> {
    const http = new HTTP();
    http.setDataSerializer('urlencoded');

    const body = this.signedBody({
      params:              JSON.stringify(params),
      _uuid:               this.uuid,
      bk_client_context:   this.bkCtx(),
      bloks_versioning_id: this.bloksVersionId,
    });

    const headers = { ...this.baseHeaders(), 'X-FB-Friendly-Name': friendlyName };

    try {
      const resp = await http.post(`${BLOKS_API}/${endpoint}`, body, headers);
      return typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
    } catch (err: any) {
      // 400/404 responses from Bloks still carry useful JSON — parse and return
      if (err?.status === 400 || err?.status === 404) {
        const raw = typeof err.error === 'string' ? err.error : JSON.stringify(err.error || {});
        try { return JSON.parse(raw); } catch (_) { return null; }
      }
      throw err;
    }
  }

  // ─── 2FA sub-calls ─────────────────────────────────────────────────────────

  private callEntrypoint(): Promise<any> {
    const screenID = this.bloks2FAScreenID || 'qdnv2w:3';
    return this.bloksRequest(
      'bloks/apps/com.bloks.www.two_step_verification.entrypoint/',
      {
        client_input_params: { device_id: this.androidDeviceId, is_whatsapp_installed: 0, machine_id: uuidv4() },
        server_params: {
          two_step_verification_context: this.bloks2FAContext,
          flow_source:                   'two_factor_login',
          device_id:                     this.androidDeviceId,
          family_device_id:              this.phoneId,
          INTERNAL_INFRA_screen_id:      screenID,
        },
      },
      'IgApi: bloks/async_action/com.bloks.www.two_step_verification.entrypoint/',
    );
  }

  private callMethodPicker(): Promise<any> {
    return this.bloksRequest(
      'bloks/apps/com.bloks.www.two_step_verification.method_picker/',
      {
        client_input_params: { device_id: this.androidDeviceId, is_whatsapp_installed: 0, machine_id: uuidv4() },
        server_params: {
          two_step_verification_context: this.bloks2FAContext,
          flow_source:                   'two_factor_login',
          device_id:                     this.androidDeviceId,
          family_device_id:              this.phoneId,
          INTERNAL_INFRA_screen_id:      this.bloks2FAScreenID,
        },
      },
      'IgApi: bloks/async_action/com.bloks.www.two_step_verification.method_picker/',
    );
  }

  private callMethodPickerNavigation(): Promise<any> {
    return this.bloksRequest(
      'bloks/apps/com.bloks.www.two_step_verification.method_picker.navigation.async/',
      {
        client_input_params: { selected_method: 'totp', cloud_trust_token: null, network_bssid: null },
        server_params: {
          two_step_verification_context: this.bloks2FAContext,
          flow_source:                   'two_factor_login',
          should_fallback_to_sms:        false,
          device_id:                     this.androidDeviceId,
          family_device_id:              this.phoneId,
          INTERNAL_INFRA_screen_id:      this.bloks2FAScreenID,
        },
      },
      'IgApi: bloks/async_action/com.bloks.www.two_step_verification.method_picker.navigation.async/',
    );
  }

  private callVerifyCode(code: string): Promise<any> {
    return this.bloksRequest(
      'bloks/apps/com.bloks.www.two_step_verification.verify_code.async/',
      {
        client_input_params: {
          code,
          device_id:              this.androidDeviceId,
          family_device_id:       this.phoneId,
          machine_id:             uuidv4(),
          should_trust_device:    0,
          cloud_trust_token:      null,
          network_bssid:          null,
          auth_secure_device_id:  '',
          block_store_machine_id: '',
        },
        server_params: {
          two_step_verification_context: this.bloks2FAContext,
          flow_source:                   'two_factor_login',
          device_id:                     this.androidDeviceId,
          INTERNAL_INFRA_screen_id:      this.bloks2FAScreenID,
        },
      },
      'IgApi: bloks/async_action/com.bloks.www.two_step_verification.verify_code.async/',
    );
  }

  private callVerifyCodeTOTP(code: string): Promise<any> {
    return this.bloksRequest(
      'bloks/apps/com.bloks.www.two_step_verification.verify_code.async/',
      {
        client_input_params: {
          code,
          machine_id:             uuidv4(),
          device_id:              this.androidDeviceId,
          cloud_trust_token:      null,
          block_store_machine_id: '',
          should_trust_device:    false,
          family_device_id:       this.phoneId,
          auth_secure_device_id:  '',
          network_bssid:          null,
        },
        server_params: {
          two_step_verification_context: this.bloks2FAContext,
          flow_source:                   'two_factor_login',
          challenge:                     'totp',
          device_id:                     this.androidDeviceId,
          spectra_reg_login_data:        null,
        },
      },
      'IgApi: bloks/async_action/com.bloks.www.two_step_verification.verify_code.async/',
    );
  }

  // ─── Headers & body helpers ────────────────────────────────────────────────

  private baseHeaders(): Record<string, string> {
    return {
      'User-Agent':                  this.userAgent,
      'X-Bloks-Version-Id':          this.bloksVersionId,
      'X-Bloks-Is-Layout-RTL':       'false',
      'X-Bloks-Is-Panorama-Enabled': 'true',
      'X-IG-App-ID':                 APP_ID,
      'X-IG-Device-ID':              this.uuid,
      'X-IG-Family-Device-ID':       this.phoneId,
      'X-IG-Android-ID':             this.androidDeviceId,
      'X-IG-WWW-Claim':              '0',
      'X-IG-Connection-Type':        'WIFI',
      'X-IG-Capabilities':           '3brTv10=',
      'Content-Type':                'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept-Language':             'en-US',
      'X-FB-HTTP-Engine':            'Liger',
      'X-FB-Client-IP':              'True',
      'X-FB-Server-Cluster':         'True',
    };
  }

  private signedBody(data: Record<string, any>): Record<string, string> {
    return { signed_body: `SIGNATURE.${JSON.stringify(data)}` };
  }

  private bkCtx(): string {
    return JSON.stringify({ bloks_version: this.bloksVersionId, styles_id: 'instagram' });
  }

  // ─── 2FA context storage (localStorage) ───────────────────────────────────

  private save2FACtx(username: string): void {
    try {
      localStorage.setItem(`ig_2fa_${username}`, JSON.stringify({
        ctx: this.bloks2FAContext,
        sid: this.bloks2FAScreenID,
        exp: Date.now() + 30 * 60 * 1000,
      }));
    } catch (_) {}
  }

  private load2FACtx(username: string): boolean {
    try {
      const raw = localStorage.getItem(`ig_2fa_${username}`);
      if (!raw) return false;
      const e = JSON.parse(raw);
      if (Date.now() > e.exp) { localStorage.removeItem(`ig_2fa_${username}`); return false; }
      this.bloks2FAContext  = e.ctx;
      this.bloks2FAScreenID = e.sid;
      return true;
    } catch (_) { return false; }
  }

  private clear2FACtx(username: string): void {
    try { localStorage.removeItem(`ig_2fa_${username}`); } catch (_) {}
  }

  // ─── Password encryption (same as legacy flow) ────────────────────────────

  private encryptPassword(password: string, pubKeyBase64: string, pubKeyVersion: number): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const pemText   = forge.util.decode64(pubKeyBase64);
    const publicKey = forge.pki.publicKeyFromPem(pemText);
    const aesKey    = forge.random.getBytesSync(32);
    const encKey    = publicKey.encrypt(aesKey, 'RSAES-PKCS1-V1_5');
    const iv        = forge.random.getBytesSync(12);
    // @ts-ignore
    const aad    = forge.util.createBuffer(timestamp, 'raw');
    const cipher = forge.cipher.createCipher('AES-GCM', aesKey);
    // @ts-ignore
    cipher.start({ iv, additionalData: aad, tagLength: 128 });
    cipher.update(forge.util.createBuffer(password, 'utf8'));
    cipher.finish();
    const full = cipher.output.getBytes() + cipher.mode.tag.getBytes();
    const ct   = full.slice(0, full.length - 16);
    const tag  = full.slice(full.length - 16);
    const lsb  = String.fromCharCode(encKey.length & 0xff, (encKey.length >> 8) & 0xff);
    const payload = String.fromCharCode(1) + String.fromCharCode(pubKeyVersion) + iv + lsb + encKey + tag + ct;
    return `#PWD_INSTAGRAM:4:${timestamp}:${forge.util.encode64(payload)}`;
  }
}

// ─── Standalone parse helpers (exported for tests) ───────────────────────────

export function bloksExtract2FAContext(rawStr: string): string {
  const marker = 'two_step_verification_context';
  const idx = rawStr.indexOf(marker);
  if (idx === -1) return '';
  const search = rawStr.slice(idx + marker.length);
  for (let i = 0; i < search.length - 100; i++) {
    if (search[i] !== '"') continue;
    const end = search.indexOf('"', i + 1);
    if (end > i + 50) {
      const val = search.slice(i + 1, end).replace(/\\$/, '');
      if (val.startsWith('AW')) return val;
    }
  }
  return '';
}

export function bloksExtractScreenID(rawStr: string): string {
  const marker = 'INTERNAL_INFRA_screen_id';
  const idx = rawStr.indexOf(marker);
  if (idx === -1) return '';
  const search = rawStr.slice(idx + marker.length);
  for (let i = 0; i < search.length - 20; i++) {
    if (search[i] !== '"') continue;
    const end = search.indexOf('"', i + 1);
    if (end > i + 2 && end < i + 30) {
      const val = search.slice(i + 1, end).replace(/\\$/, '');
      if (val.includes(':')) return val;
    }
  }
  return '';
}

export function bloksDetectAirwave(rawStr: string): boolean {
  return rawStr.includes('has_been_allowed') ||
         rawStr.includes('approve_from_another_device') ||
         rawStr.includes('AIRWAVE') ||
         rawStr.includes('airwave');
}

export function bloksExtractSession(rawStr: string): BloksLoginResult | null {
  const igtMarker = 'IGT:2:';
  const idx = rawStr.indexOf(igtMarker);
  if (idx === -1) return null;

  let end = rawStr.length;
  for (let i = idx; i < rawStr.length; i++) {
    if (rawStr[i] === '"' || rawStr[i] === '\\') { end = i; break; }
  }
  const token = rawStr.slice(idx, end);
  const authorization = `Bearer ${token}`;

  // ds_user_id from raw string
  const uidMarker = '"ds_user_id":"';
  const uidIdx = rawStr.indexOf(uidMarker);
  let userId = '';
  if (uidIdx !== -1) {
    const uStart = uidIdx + uidMarker.length;
    const uEnd   = rawStr.indexOf('"', uStart);
    if (uEnd > uStart) userId = rawStr.slice(uStart, uEnd);
  }

  return { authorization, userId };
}
