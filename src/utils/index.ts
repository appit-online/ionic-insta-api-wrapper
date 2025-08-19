import { formattedShortcode, IGPostType, postType, ProductType } from '../types';
import * as bigInt from 'big-integer';

// https://stackoverflow.com/questions/16758316/where-do-i-find-the-instagram-media-id-of-a-image
// https://gist.github.com/sclark39/9daf13eea9c0b381667b61e3d2e7bc11
const lower = 'abcdefghijklmnopqrstuvwxyz';
const upper = lower.toUpperCase();
const numbers = '0123456789'
const igAlphabet = upper + lower + numbers + '-_'
const bigintAlphabet = numbers + lower
/**
 * convert instagram shortcode into media_id
 * @param shortcode 
 * @returns 
 */
export const shortcodeToMediaID = (shortcode: string) => {
    const o = shortcode.replace(/\S/g, m => {
        const c = igAlphabet.indexOf(m);
        const b = bigintAlphabet.charAt(c);
        return (b !== "") ? b : `<${c}>`
    })
    return bigInt(o, 64).toString(10)
}

export const shortcodeFromMediaID = (mediaId: string) => {
    const o = bigInt(mediaId).toString(64);
    return o.replace(/<(\d+)>|(\w)/g, (_m: any, m1: string, m2: string) => {
        return igAlphabet.charAt((m1)
          // tslint:disable-next-line:radix
            ? parseInt(m1)
            : bigintAlphabet.indexOf(m2))
    });
}

/** Instagram post regex */
export const IGPostRegex = /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com(?:\/.+?)?\/(p|reel(?:s|)|tv)\/)([\w-]+)(?:\/)?(\?.*)?$/gim

/**
 * format instagram long url to get shortcode
 * @param url a instagram post url
 * @returns {formattedShortcode}
 */
export const shortcodeFormatter = (url: string): formattedShortcode => {
    const splitted = /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com(?:\/.+?)?\/(p|reel(?:s|)|tv)\/)([\w-]+)(?:\/)?(\?.*)?$/gim.exec(url) || '';
    return {
        type: splitted[1],
        shortcode: splitted[2],
        url: 'https://www.instagram.com/' + splitted[1] + '/' + splitted[2],
        media_id: shortcodeToMediaID(splitted[2])
    }
};

/**
 * is Instagram Url?
 * @param url instagram post url
 * @returns 
 */
export const isIgPostUrl = (url: string): boolean => {
    return /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com(?:\/.+?)?\/(p|reel(?:s|)|tv)\/)([\w-]+)(?:\/)?(\?.*)?$/gim.test(url);
}

/**
 * get instagram post type
 * @param type product_type
 * @returns 
 */
export const getPostType = (type: string): postType => {
    switch (type) {
        case ProductType.CAROUSEL:
            return IGPostType.carousel_container;

        case ProductType.REEL:
            return IGPostType.clips;

        case ProductType.SINGLE:
            return IGPostType.feed;

        case ProductType.TV:
            return IGPostType.igtv;

        case ProductType.STORY: 
            return IGPostType.story;

        default:
            return IGPostType.feed;
    }
};

