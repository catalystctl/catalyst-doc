import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Production docs site for https://docs.catalystctl.com
// Static output is deployed directly to Cloudflare Pages (see DEPLOYMENT.md).
export default defineConfig({
  site: 'https://docs.catalystctl.com',
  integrations: [
    starlight({
      title: 'Catalyst Docs',
      description: 'Use, operate, and integrate with Catalyst — the game-server control panel.',
      logo: {
        src: './src/assets/logo.png',
        alt: 'Catalyst',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/catalystctl/catalyst' },
      ],
      editLink: {
        baseUrl: 'https://github.com/catalystctl/catalyst-doc/edit/main/',
      },
      customCss: ['./src/styles/custom.css'],
      head: [
        {
          tag: 'meta',
          attrs: { name: 'theme-color', content: '#0a0908' },
        },
        {
          tag: 'link',
          attrs: { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        },
      ],
      sidebar: [
        {
          label: 'Catalyst Website',
          link: 'https://catalystctl.com/',
          attrs: { target: '_blank', rel: 'noopener' },
        },
        {
          label: 'Getting Started',
          items: [
            { label: 'What is Catalyst?', slug: 'getting-started/what-is-catalyst' },
            { label: 'Terminology', slug: 'getting-started/terminology' },
            { label: 'Your First Server', slug: 'getting-started/first-server' },
            { label: 'Connecting to Your Server', slug: 'getting-started/connecting' },
          ],
        },
        {
          label: 'Game Server Guide',
          items: [
            { label: 'Overview', slug: 'users/overview' },
            { label: 'Console', slug: 'users/console' },
            { label: 'Power Controls', slug: 'users/power' },
            { label: 'Files', slug: 'users/files' },
            { label: 'SFTP', slug: 'users/sftp' },
            { label: 'Backups', slug: 'users/backups' },
            { label: 'Databases', slug: 'users/databases' },
            { label: 'Tasks', slug: 'users/tasks' },
            { label: 'Networking', slug: 'users/networking' },
            { label: 'Startup & Variables', slug: 'users/startup' },
            { label: 'Reinstalling', slug: 'users/reinstalling' },
            { label: 'Users & Subusers', slug: 'users/subusers' },
            { label: 'Activity', slug: 'users/activity' },
            { label: 'Metrics & Alerts', slug: 'users/metrics' },
            { label: 'Mods & Plugins', slug: 'users/mods-plugins' },
          ],
        },
        {
          label: 'Administrator Guide',
          items: [
            { label: 'Overview', slug: 'admin/overview' },
            { label: 'Requirements', slug: 'admin/requirements' },
            { label: 'Installation', slug: 'admin/installation' },
            { label: 'First-Time Setup', slug: 'admin/first-time-setup' },
            { label: 'Configuration', slug: 'admin/configuration' },
            {
              label: 'Nodes',
              items: [
                { label: 'Overview', slug: 'admin/nodes/overview' },
                { label: 'Installing a Node', slug: 'admin/nodes/installing' },
                { label: 'Registering a Node', slug: 'admin/nodes/registering' },
                { label: 'Updating a Node', slug: 'admin/nodes/updating' },
              ],
            },
            { label: 'Networking', slug: 'admin/networking' },
            { label: 'Storage', slug: 'admin/storage' },
            { label: 'Users', slug: 'admin/users' },
            { label: 'Roles & Permissions', slug: 'admin/roles' },
            { label: 'Templates', slug: 'admin/templates' },
            { label: 'Importing Pterodactyl Eggs', slug: 'admin/importing-eggs' },
            { label: 'Backups', slug: 'admin/backups' },
            { label: 'Security', slug: 'admin/security' },
            { label: 'Monitoring & Logs', slug: 'admin/monitoring' },
            { label: 'Updating Catalyst', slug: 'admin/updating' },
            { label: 'Migration', slug: 'admin/migration' },
            { label: 'Disaster Recovery', slug: 'admin/disaster-recovery' },
          ],
        },
        {
          label: 'API & Developers',
          items: [
            { label: 'Overview', slug: 'api/overview' },
            { label: 'Authentication', slug: 'api/authentication' },
            { label: 'Authorization & Permissions', slug: 'api/authorization' },
            { label: 'Errors', slug: 'api/errors' },
            { label: 'Pagination', slug: 'api/pagination' },
            { label: 'Rate Limits', slug: 'api/rate-limits' },
            { label: 'Realtime & Events', slug: 'api/websockets' },
            { label: 'Guides', slug: 'api/guides' },
            { label: 'Plugin Development', slug: 'api/plugins' },
            { label: 'API Reference', slug: 'api/reference' },
          ],
        },
        {
          label: 'Troubleshooting',
          items: [
            { label: 'Overview', slug: 'troubleshooting/overview' },
            { label: 'Server Issues', slug: 'troubleshooting/server' },
            { label: 'Node Issues', slug: 'troubleshooting/node' },
            { label: 'Panel Issues', slug: 'troubleshooting/panel' },
            { label: 'Networking Issues', slug: 'troubleshooting/networking' },
            { label: 'Common Errors', slug: 'troubleshooting/common-errors' },
          ],
        },
        {
          label: 'Contributing',
          items: [{ label: 'Docs Contributor Guide', slug: 'contributing/docs' }],
        },
      ],
    }),
  ],
});
