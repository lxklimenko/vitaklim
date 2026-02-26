export {}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void
        expand: () => void
        disableVerticalSwipes?: () => void

        BackButton: {
          show: () => void
          hide: () => void
          onClick: (cb: () => void) => void
        }
      }
    }
  }
}