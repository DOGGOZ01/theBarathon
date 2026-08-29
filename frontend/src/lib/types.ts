export interface User {
  id: number;
  username: string;
  is_admin: boolean;
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

export interface Place {
  id: number;
  city: number;
  name: string;
  photo: string | null;
  latitude: string;
  longitude: string;
  avg_atmosphere: string;
  avg_drinks: string;
  avg_price: string;
  avg_overall: string;
}

export interface ReviewPhoto {
  id: number;
  review: number;
  image: string;
  uploaded_at: string;
}

export interface Review {
  id: number;
  place: number;
  user: User;
  rating_atmosphere: number;
  rating_drinks: number;
  rating_price: number;
  text: string;
  photos: ReviewPhoto[];
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
