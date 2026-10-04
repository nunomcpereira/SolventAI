import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: 'Using the app',
      collapsed: false,
      items: [
        'dashboard',
        'accounts-and-income',
        'loans-and-expenses',
        'contract-upload',
        'simulation',
        'settings',
        'demo-accounts',
      ],
    },
    {
      type: 'category',
      label: 'How it works',
      items: ['financial-engine', 'history-replay', 'privacy'],
    },
  ],
};

export default sidebars;
