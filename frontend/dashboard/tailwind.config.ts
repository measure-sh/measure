import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-josefin-sans)'],
        body: ['var(--font-space-mono)']
      },
      colors: {
        'redd': '#ff6286'
      }
    },
  },
  plugins: [require("@tailwindcss/forms")],
}
export default config
