import { ItemStories, StoriesGraphQL } from '../types';

export class ParserService {

  /**
   *
   * @param {StoriesGraphQL} metadata
   * @returns {ItemStories[]}
   */
  parseStories = (metadata: StoriesGraphQL): ItemStories[] => {
    const items = metadata.items;
    const storyList: any[] = [];
    items.forEach(item => {
      if (item.media_type === 1) {
        storyList.push({
          type: 'image',
          mimetype: 'image/jpeg',
          url: item.image_versions2.candidates[0].url,
          taken_at: item.taken_at,
          expiring_at: item.expiring_at,
          id: item.id,
          original_width: item.original_width,
          original_height: item.original_height,
          has_audio:
            item.has_audio !== undefined ? item.has_audio : null,
          video_duration:
            item.video_duration !== undefined
              ? item.video_duration
              : null,
          caption: item.caption,
        });
      } else {
        storyList.push({
          type: 'video',
          mimetype: 'video/mp4',
          url: item.video_versions[0].url,
          taken_at: item.taken_at,
          expiring_at: item.expiring_at,
          id: item.id,
          original_width: item.original_width,
          original_height: item.original_height,
          has_audio:
            item.has_audio !== undefined ? item.has_audio : false,
          video_duration:
            item.video_duration !== undefined
              ? item.video_duration
              : null,
          caption: item.caption,
        });
      }
    });
    return storyList;
  }
}
