import { getCookies } from './lib/handler';


export function getCookie(username: string, password: string, withLoginData: boolean = false) {
  return getCookies(username, password, withLoginData);
}

export { InstaService } from './lib/client.service';
export { LoginService } from './lib/login.service';
export type { LoginServiceConfig } from './lib/login.service';
export { BloksLoginService } from './lib/login.bloks';
export type { BloksLoginResult, BloksDeviceParams } from './lib/login.bloks';
