export class CookiesService {
  formatCookie(setCookie: string[] | undefined): string {
    return setCookie?.map(x => x.match(/(.*?=.*?);/)?.[1])?.join('; ') || '';
  }

  getEarliestExpireDate(setCookie: string[] | undefined): string | null {
    if (!setCookie) return null;

    const now = new Date();

    const expireDates = setCookie
      .map(cookie => {
        // max-age hat Vorrang vor expires
        const maxAgeMatch = cookie.match(/max-age=([^;]+)/i);
        if (maxAgeMatch) {
          const seconds = parseInt(maxAgeMatch[1], 10);
          if (!isNaN(seconds)) {
            return new Date(now.getTime() + seconds * 1000);
          }
        }

        // fallback auf expires
        const expiresMatch = cookie.match(/expires=([^;]+)/i);
        if (expiresMatch) {
          const expiresDate = new Date(expiresMatch[1]);
          if (!isNaN(expiresDate.getTime())) {
            return expiresDate;
          }
        }

        return null;
      })
      .filter((date): date is Date => date !== null && !isNaN(date.getTime()));

    if (expireDates.length === 0) return null;

    const earliest = expireDates.reduce((min, current) =>
      current < min ? current : min
    );

    return earliest.toUTCString();
  }
}
