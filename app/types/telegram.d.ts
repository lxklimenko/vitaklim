export {}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void
        expand: () => void
        setHeaderColor: (color: string) => void
        setBackgroundColor: (color: string) => void
        disableVerticalSwipes?: () => void
        colorScheme?: 'light' | 'dark'
        BackButton: {
          show: () => void
          hide: () => void
          onClick: (cb: () => void) => void
        }
      }
    }
  }
}