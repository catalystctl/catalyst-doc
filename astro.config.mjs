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
          attrs: { name: 'theme-color', content: '#161412' },
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
            {
              label: 'Core concepts',
              items: [
                { label: 'What is Catalyst?', slug: 'getting-started/what-is-catalyst' },
                { label: 'Terminology', slug: 'getting-started/terminology' },
              ],
            },
            {
              label: 'First steps',
              items: [
                { label: 'Your First Server', slug: 'getting-started/first-server' },
                { label: 'Connecting to Your Server', slug: 'getting-started/connecting' },
              ],
            },
          ],
        },
        {
          label: 'Game Server Guide',
          items: [
            {
              label: 'Server basics',
              items: [
                { label: 'Overview', slug: 'users/overview' },
                { label: 'Console', slug: 'users/console' },
                { label: 'Power Controls', slug: 'users/power' },
              ],
            },
            {
              label: 'Files & backups',
              items: [
                { label: 'Files', slug: 'users/files' },
                { label: 'SFTP', slug: 'users/sftp' },
                { label: 'Backups', slug: 'users/backups' },
                { label: 'Databases', slug: 'users/databases' },
              ],
            },
            {
              label: 'Configuration & maintenance',
              items: [
                { label: 'Startup & Variables', slug: 'users/startup' },
                { label: 'Reinstalling', slug: 'users/reinstalling' },
                { label: 'Cloning', slug: 'users/cloning' },
                { label: 'Mods & Plugins', slug: 'users/mods-plugins' },
              ],
            },
            {
              label: 'Networking & sharing',
              items: [
                { label: 'Networking', slug: 'users/networking' },
                { label: 'Users & Subusers', slug: 'users/subusers' },
              ],
            },
            {
              label: 'Automation & insights',
              items: [
                { label: 'Tasks', slug: 'users/tasks' },
                { label: 'Activity', slug: 'users/activity' },
                { label: 'Metrics & Alerts', slug: 'users/metrics' },
              ],
            },
            {
              label: 'Account',
              items: [{ label: 'Your Account', slug: 'users/account' }],
            },
          ],
        },
        {
          label: 'Administrator Guide',
          items: [
            { label: 'Overview', slug: 'admin/overview' },
            {
              label: 'Install & Update',
              items: [
                { label: 'Requirements', slug: 'admin/requirements' },
                { label: 'Installation', slug: 'admin/installation' },
                { label: 'First-Time Setup', slug: 'admin/first-time-setup' },
                { label: 'Updating Catalyst', slug: 'admin/updating' },
              ],
            },
            {
              label: 'Nodes',
              items: [
                { label: 'Overview', slug: 'admin/nodes/overview' },
                { label: 'Registering a Node', slug: 'admin/nodes/registering' },
                { label: 'Installing a Node', slug: 'admin/nodes/installing' },
                { label: 'Updating a Node', slug: 'admin/nodes/updating' },
              ],
            },
            {
              label: 'Configuration',
              items: [
                { label: 'Configuration', slug: 'admin/configuration' },
                { label: 'Networking', slug: 'admin/networking' },
                { label: 'Storage', slug: 'admin/storage' },
              ],
            },
            {
              label: 'Access & Security',
              items: [
                { label: 'Users', slug: 'admin/users' },
                { label: 'Roles & Permissions', slug: 'admin/roles' },
                { label: 'Security', slug: 'admin/security' },
              ],
            },
            {
              label: 'Content',
              items: [
                { label: 'Templates', slug: 'admin/templates' },
                { label: 'Importing Pterodactyl Eggs', slug: 'admin/importing-eggs' },
              ],
            },
            {
              label: 'Extensions',
              items: [{ label: 'Plugins', slug: 'admin/plugins' }],
            },
            {
              label: 'Operations',
              items: [
                { label: 'Backups', slug: 'admin/backups' },
                { label: 'Monitoring & Logs', slug: 'admin/monitoring' },
              ],
            },
            {
              label: 'Migration & Recovery',
              items: [
                { label: 'Migration', slug: 'admin/migration' },
                { label: 'Disaster Recovery', slug: 'admin/disaster-recovery' },
              ],
            },
          ],
        },
        {
          label: 'API & Developers',
          items: [
            { label: 'Overview', slug: 'api/overview' },
            {
              label: 'REST API',
              items: [
                { label: 'Authentication', slug: 'api/authentication' },
                { label: 'Authorization & Permissions', slug: 'api/authorization' },
                { label: 'Errors', slug: 'api/errors' },
                { label: 'Pagination', slug: 'api/pagination' },
                { label: 'Rate Limits', slug: 'api/rate-limits' },
                { label: 'Realtime Events', slug: 'api/websockets' },
                { label: 'API Guides', slug: 'api/guides' },
              ],
            },
            {
              label: 'Plugin development',
              items: [
                { label: 'Plugin Development', slug: 'api/plugins' },
                { label: 'Create a Plugin', slug: 'api/plugins/creating' },
                { label: 'Plugin Manifest', slug: 'api/plugins/manifest' },
                { label: 'Plugin Backend', slug: 'api/plugins/backend' },
                { label: 'Plugin Frontend', slug: 'api/plugins/frontend' },
                { label: 'Plugin Data & Permissions', slug: 'api/plugins/data' },
                { label: 'Sign-in Plugins', slug: 'api/plugins/auth' },
                { label: 'Plugin Licensing', slug: 'api/plugins/licensing' },
                { label: 'Packaging & Marketplace', slug: 'api/plugins/packaging' },
              ],
            },
            {
              label: 'Reference',
              items: [{ label: 'API Reference', slug: 'api/reference' }],
            },
          ],
        },
        {
          label: 'Troubleshooting',
          items: [
            { label: 'Overview', slug: 'troubleshooting/overview' },
            {
              label: 'Server owners',
              items: [
                { label: 'Server Issues', slug: 'troubleshooting/server' },
                { label: 'Networking Issues', slug: 'troubleshooting/networking' },
                { label: 'Common Errors', slug: 'troubleshooting/common-errors' },
              ],
            },
            {
              label: 'Administrators',
              items: [
                { label: 'Node Issues', slug: 'troubleshooting/node' },
                { label: 'Panel Issues', slug: 'troubleshooting/panel' },
                { label: 'Diagnostics Bundle', slug: 'troubleshooting/diagnostics-bundle' },
              ],
            },
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
