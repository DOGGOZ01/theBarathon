export interface User {
  id: number;
  username: string;
  is_admin: boolean;
  avatar: string | null;
}

export interface City {
  id: number;
  name: string;
  country: string;
  photo: string | null;
  latitude: string;
  longitude: string;
  is_default: boolean;
  created_at: string;
}

export type PlaceType = "bar" | "restaurant" | "endroit";

export const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  bar: "Bar",
  restaurant: "Restaurant",
  endroit: "Endroit",
};

// Bar and restaurant share all 3 rating criteria; "endroit" has no drinks criterion.
export const PLACE_TYPES_WITH_DRINKS: PlaceType[] = ["bar", "restaurant"];

// Same underlying field (rating_drinks/avg_drinks) everywhere — only the
// displayed label changes, since "Boissons" alone reads oddly for a
// restaurant where the criterion covers food and drinks together.
export const DRINKS_CRITERION_LABEL: Record<PlaceType, string> = {
  bar: "Boissons",
  restaurant: "Cuisine & Boissons",
  endroit: "Boissons",
};

export interface Place {
  id: number;
  city: number;
  name: string;
  place_type: PlaceType;
  photo: string | null;
  latitude: string;
  longitude: string;
  avg_atmosphere: string;
  avg_drinks: string;
  avg_price: string;
  avg_overall: string;
  avg_spent: string;
  created_by: User | null;
}

export interface ReviewPhoto {
  id: number;
  review: number;
  image: string;
  uploaded_at: string;
}

export type ReactionEmoji = "like" | "love" | "haha" | "wow" | "sad" | "angry";

export const REACTION_GLYPHS: Record<ReactionEmoji, string> = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😡",
};

export interface ReactionCount {
  emoji: ReactionEmoji;
  count: number;
}

export interface ReactionSummary {
  reactions_summary: ReactionCount[];
  my_reaction: ReactionEmoji | null;
}

export interface CommentPhoto {
  id: number;
  comment: number;
  image: string;
  uploaded_at: string;
}

export interface Comment extends ReactionSummary {
  id: number;
  review: number;
  parent: number | null;
  user: User;
  text: string;
  photos: CommentPhoto[];
  replies: Comment[];
  created_at: string;
  updated_at: string;
}

export interface Review extends ReactionSummary {
  id: number;
  place: number;
  user: User;
  rating_atmosphere: number;
  rating_drinks: number | null;
  rating_price: number;
  amount_spent: string | null;
  text: string;
  photos: ReviewPhoto[];
  comments: Comment[];
  created_at: string;
  updated_at: string;
}

export interface PlaceDetail extends Place {
  created_at: string;
  reviews: Review[];
}

export interface InviteConfig {
  code: string;
  updated_at: string;
}

export type NotificationVerb = "reply" | "reaction";

export interface AppNotification {
  id: number;
  actor: User;
  verb: NotificationVerb;
  review: number;
  comment: number | null;
  reaction_emoji: ReactionEmoji | "";
  is_read: boolean;
  created_at: string;
  place_id: number;
  place_name: string;
  city_id: number;
  preview_text: string;
}

export type ActivityItemType = "place" | "review" | "comment";

export interface ActivityItem {
  type: ActivityItemType;
  id: number;
  created_at: string;
  user: User | null;
  place_id: number;
  place_name: string;
  city_id: number;
  text: string;
}
