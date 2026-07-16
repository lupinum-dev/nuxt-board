export default {
  ginkoDocs: {
    site: {
      url: 'https://vue-board.vercel.app',
      name: { en: 'Vue Board' },
      description: { en: 'A real board model for Vue and Nuxt products.' },
      logo: { light: '/favicon.ico', dark: '/favicon.ico' },
      localeSwitcher: 'dropdown',
      docsSidebarSwitcher: 'tabs',
    },
    social: { github: 'https://github.com/Mat4m0/canvas' },
    repository: {
      url: 'https://github.com/Mat4m0/canvas',
      branch: 'main',
      contentDirectory: 'apps/docs/content',
    },
    landing: {
      eyebrow: { en: 'Headless engine. Focused Vue renderer.' },
      title: { en: 'Build the board your product actually needs.' },
      description: {
        en: 'Predictable commands, custom node rendering, JSON Canvas persistence, and focused packages for connections and history.',
      },
      primary: {
        label: { en: 'Build your first board' },
        to: { en: '/docs/start-building/your-first-board' },
      },
      secondary: {
        label: { en: 'Understand the system' },
        to: { en: '/docs/evaluate/how-vue-board-works' },
      },
      features: [
        {
          title: { en: 'Command-driven core' },
          description: {
            en: 'Transactions, guards, events, and history operate on one explicit document model.',
          },
          icon: 'lucide:terminal-square',
        },
        {
          title: { en: 'Rendering stays yours' },
          description: {
            en: 'Use the built-in renderer or provide custom node visuals without forking the engine.',
          },
          icon: 'lucide:panel-top',
        },
        {
          title: { en: 'Composable features' },
          description: {
            en: 'Connections, minimap, history, persistence, and Nuxt integration remain focused packages.',
          },
          icon: 'lucide:network',
        },
      ],
    },
  },
}
