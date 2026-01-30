export interface Prompt {
  id: number
  title: string
  tool: string
  category: string
  price: number
  prompt: string
  image?: {
    src: string
    width: number
    height: number
    aspect: string
  }
  description: string
  bestFor: string
}
