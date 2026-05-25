export default defineAppConfig({
  ui: {
    colors: {
      primary: 'primary',
      neutral: 'slate',
    },
    footer: {
      slots: {
        root: 'border-t border-default',
        left: 'text-sm text-muted',
      },
    },
  },
  seo: {
    siteName: 'Vue Board',
  },
  header: {
    title: 'Vue Board',
    to: '/',
    logo: {
      alt: 'Vue Board',
      light: '',
      dark: '',
    },
    colorMode: true,
    links: [
      {
        icon: 'i-tabler-brand-github',
        to: 'https://github.com/lupinum/nuxt-board',
        target: '_blank',
        'aria-label': 'GitHub',
      },
      {
        icon: 'i-tabler-player-play',
        to: '/examples/basic-board',
        'aria-label': 'Examples',
      },
    ],
  },
  footer: {
    credits: `Vue Board • © ${new Date().getFullYear()}`,
    colorMode: false,
    links: [
      {
        icon: 'i-tabler-brand-github',
        to: 'https://github.com/lupinum/nuxt-board',
        target: '_blank',
        'aria-label': 'Vue Board on GitHub',
      },
    ],
  },
  toc: {
    title: 'Table of Contents',
    bottom: {
      title: 'Project',
      edit: 'https://github.com/lupinum/nuxt-board/edit/main/apps/docs/content',
      links: [
        {
          icon: 'i-tabler-star',
          label: 'Star on GitHub',
          to: 'https://github.com/lupinum/nuxt-board',
          target: '_blank',
        },
        {
          icon: 'i-tabler-player-play',
          label: 'Open examples',
          to: '/examples/basic-board',
        },
      ],
    },
  },
})
