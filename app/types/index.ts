// app/types/index.ts

export interface Model {
  id: string;
  name: string;
  badge: string;
  color: string;
  desc: string;
  price: number;
}

export interface Generation {
  id: string;
  user_id: string;
  prompt: string;
  image_url: string;
  created_at: string;
  is_favorite: boolean;
}