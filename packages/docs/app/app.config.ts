export default defineAppConfig({
  ui: {
    colors: {
      primary: 'teal',
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
    search: true,
    colorMode: true,
    links: [
      {
        icon: 'i-simple-icons-github',
        to: 'https://github.com/Mat4m0/canvas',
        target: '_blank',
        'aria-label': 'GitHub',
      },
      {
        icon: 'i-lucide-square-play',
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
        icon: 'i-simple-icons-github',
        to: 'https://github.com/Mat4m0/canvas',
        target: '_blank',
        'aria-label': 'Vue Board on GitHub',
      },
    ],
  },
  toc: {
    title: 'Table of Contents',
    bottom: {
      title: 'Project',
      edit: 'https://github.com/Mat4m0/canvas/edit/main/packages/docs/content',
      links: [
        {
          icon: 'i-lucide-star',
          label: 'Star on GitHub',
          to: 'https://github.com/Mat4m0/canvas',
          target: '_blank',
        },
        {
          icon: 'i-lucide-play',
          label: 'Open examples',
          to: '/examples/basic-board',
        },
      ],
    },
  },
})
