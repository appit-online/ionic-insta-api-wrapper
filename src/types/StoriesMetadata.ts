import { Item, MimeType, User } from '.';

export interface StoryUser {
	id: string;
	full_name: string;
	username: string;
	story_duration_secs: number;
	media_count: number;
	has_video: boolean;
	profile_pic_url: string;
	is_verified: boolean;
	is_private: boolean;
}

/** an Array of simplified StoriesMetadata */
export interface ItemStories {
	type: string;
	mimetype: MimeType;
	/** Downloadable media url */
	url: string;
	thumbnailVideoDefault: string;
	/** a timestamp of posted media */
	taken_at: number;
	/** a timestamp of expire stories */
	expiring_at: number;
	/** stories media id */
	id: number;
	/** media pixels weight */
	original_width: number;
	/** media pixels height */
	original_height: number;
	/** has audio */
	has_audio: boolean;
	/** video duration */
	video_duration: number;
	/** stories caption */
	caption: string;
}

export interface StoriesGraphQL {
	id: number;
	latest_reel_media: number;
	expiring_at: number;
	seen: number;
	can_reply: boolean;
	can_gif_quick_reply: boolean;
	can_reshare: boolean;
	reel_type: string;
	ad_expiry_timestamp_in_millis: null;
	is_cta_sticker_available: null;
	user: User;
	items: Item[];
	prefetch_count: number;
	has_besties_media: boolean;
	media_count: number;
	media_ids: number[];
	has_fan_club_media: boolean;
	status: string;
}
