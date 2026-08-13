export default {
  ginkoDocs: {
    site: {
      url: 'https://nuxt-board.lupinum.com',
      name: { en: 'Vue Board' },
      description: { en: 'A real board model for Vue and Nuxt products.' },
      logo: { light: '/app-icon.svg', dark: '/app-icon.svg' },
      docsSidebarSwitcher: 'tabs',
      legalLinks: [
        { label: { en: 'Legal notice' }, to: 'https://lupinum.com/impressum' },
        { label: { en: 'Privacy' }, to: 'https://lupinum.com/datenschutz' },
      ],
    },
    social: {
      github: 'https://github.com/lupinum-dev/nuxt-board',
      discord: 'https://discord.gg/RPH6SeA36N',
    },
    analytics: { plausible: { scriptId: 'XxT9ZOr0ZLg10B4KV40xH' } },
    feedback: { enabled: true },
    repository: {
      url: 'https://github.com/lupinum-dev/nuxt-board',
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
