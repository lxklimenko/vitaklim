// app/types/index.ts

/**
 * Represents a generative model available in the application.
 */
export interface Model {
  /** Unique identifier for the model. */
  id: string;
  /** Display name of the model. */
  name: string;
  /** Short label or tag (e.g., "NEW", "PRO"). */
  badge: string;
  /** Theme color associated with the model (CSS color value). */
  color: string;
  /** Brief description of the model's capabilities. */
  desc: string;
  /** Price per generation in the smallest currency unit (e.g., cents). */
  price: number;
  /** ISO 4217 currency code (e.g., "USD", "EUR"). Defaults to "USD". */
  currency?: string;
  /** Timestamp when the model was added to the catalog. */
  created_at?: string; // ISO date string
}

/**
 * Represents a single generation created by a user.
 */
export interface Generation {
  id: string
  user_id: string
  prompt: string

  // старое поле (оставляем для совместимости)
  image_url: string | null

  // новые реальные поля БД
  storage_path: string | null
  reference_image_url: string | null
  reference_storage_path: string | null

  created_at: string

  is_favorite: boolean

  status: 'pending' | 'completed' | 'failed'
  generation_time_ms: number | null
  refunded: boolean
}