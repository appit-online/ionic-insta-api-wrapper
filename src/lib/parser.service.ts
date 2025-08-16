import { FeedItem, FirstFrame, ImageVersions2, ItemStories, MediaType, StoriesGraphQL } from '../types';

export class ParserService {

  safeCandidate = (v: any) => v?.image_versions2?.candidates?.[0] || {};
  safeVideo = (v: any) => v?.video_versions?.[0] || {};

  parseInstagramFeedItems(graphqlItems: any[]): FeedItem[] {
    return graphqlItems.map((item: any): FeedItem => {
      const img = item.image_versions2?.candidates?.[0] || {};
      const vid = item.video_versions?.[0] || {};

      const thumbImageDefault = this.selectMiddleNonSquareImage(item.image_versions2);

      return {
        like_and_view_counts_disabled: item.like_and_view_counts_disabled,
        has_privately_liked: item.has_privately_liked,
        is_post_live_clips_media: item.is_post_live_clips_media,
        is_quiet_post: item.is_quiet_post,
        taken_at: item.taken_at,
        has_tagged_users: item.has_tagged_users,
        media_type: item.media_type,
        code: item.code,
        caption: item.caption ? { text: item.caption.text } : undefined,
        play_count: item.play_count,
        has_views_fetching: item.has_views_fetching,
        ig_play_count: item.ig_play_count,
        image_versions2: item.image_versions2
          ? {
            candidates: item.image_versions2.candidates.map((c: any) => ({
              height: c.height,
              width: c.width,
              url: c.url,
            })),
          }
          : undefined,
        original_width: item.original_width,
        original_height: item.original_height,
        is_artist_pick: item.is_artist_pick,
        location: item.location
          ? {
            pk: item.location.pk,
            facebook_places_id: item.location.facebook_places_id,
            external_source: item.location.external_source,
            name: item.location.name,
            address: item.location.address,
            city: item.location.city,
            has_viewer_saved: item.location.has_viewer_saved,
            short_name: item.location.short_name,
            lng: item.location.lng,
            lat: item.location.lat,
          }
          : undefined,
        lng: item.lng,
        lat: item.lat,
        like_count: item.like_count,
        number_of_qualities: item.number_of_qualities,
        video_versions: item.video_versions?.map((v: any) => ({
          id: v.id,
          url: v.url,
          type: v.type,
          height: v.height,
          width: v.width,
          bandwidth: v.bandwidth ?? null,
        })),
        video_duration: item.video_duration,
        has_audio: item.has_audio,
        thumbnail: img.url || '',
        thumbnailDefault: thumbImageDefault?.url || '',
        url: item.media_type === MediaType.IMAGE ? img.url || '' : vid.url || '',
        type: item.media_type === MediaType.IMAGE ? 'image' : 'video',
        dimensions: {
          height: item.media_type === MediaType.IMAGE ? img.height || 0 : vid.height || 0,
          width: item.media_type === MediaType.IMAGE ? img.width || 0 : vid.width || 0,
        },
      };
    });
  }

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

      const thumbImageDefault = this.selectMiddleNonSquareImage(item.image_versions2);

      const baseStory = {
        id: item.id,
        taken_at: item.taken_at,
        expiring_at: item.expiring_at,
        original_width: item.original_width,
        original_height: item.original_height,
        caption: item.caption,
        thumbnail: img.url || '',
        thumbnailDefault: thumbImageDefault?.url || '',
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
        const vid = this.safeVideo(item);

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

  private selectMiddleNonSquareImage(imageVersions: ImageVersions2): FirstFrame | undefined {
    if (!imageVersions?.candidates?.length) return undefined;

    // 1. Filtere alle quadratischen Bilder raus
    const nonSquareCandidates = imageVersions.candidates.filter(img => img.width !== img.height);

    if (nonSquareCandidates.length <= 2) {
      // Wenn nur 2 oder weniger Bilder übrig sind,
      // gibt es keine "Mitte" zwischen kleinstem und größtem
      return undefined;
    }

    // 2. Sortiere nach Breite aufsteigend
    nonSquareCandidates.sort((a, b) => a.width - b.width);

    // 3. Wähle das Bild zwischen kleinstem und größtem (also z.B. das zweite Bild)
    // Hier kannst du auch nonSquareCandidates[Math.floor(nonSquareCandidates.length / 2)] nehmen,
    // falls es mehrere mittlere Bilder gibt
    return nonSquareCandidates[1];
  }
}
