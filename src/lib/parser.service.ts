import { ItemStories, StoriesGraphQL } from '../types';

export class ParserService {

  safeCandidate = (v: any) => v?.image_versions2?.candidates?.[0] || {};
  safeVideo = (v: any) => v?.video_versions?.[0] || {};

  /**
   *
   * @param {StoriesGraphQL} metadata
   * @returns {ItemStories[]}
   */
  parseStories = (metadata: StoriesGraphQL): ItemStories[] => {
    const items = metadata.items;
    const storyList: ItemStories[] = [];

    items.forEach(item => {
      const img = this.safeCandidate(item);
      const vid = this.safeVideo(item);

      const baseStory = {
        id: item.id,
        taken_at: item.taken_at,
        expiring_at: item.expiring_at,
        original_width: item.original_width,
        original_height: item.original_height,
        caption: item.caption,
        thumbnail: img.url || '',
      };

      if (item.media_type === 1) {
        // Image
        // @ts-ignore
        storyList.push({
          ...baseStory,
          type: 'image',
          mimetype: 'image/jpeg',
          url: img.url,
          has_audio: item.has_audio !== undefined ? item.has_audio : false,
          video_duration: 0,
        });
      } else {
        // Video
        // @ts-ignore
        storyList.push({
          ...baseStory,
          type: 'video',
          mimetype: 'video/mp4',
          url: vid.url,
          has_audio: item.has_audio !== undefined ? item.has_audio : false,
          video_duration: item.video_duration !== undefined ? item.video_duration : 0,
        });
      }
    });

    return storyList;
  }
}
