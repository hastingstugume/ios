export interface SourcePresetDefinition {
  name: string;
  type: string;
  config: Record<string, any>;
}

export interface SourcePresetPack {
  id: string;
  name: string;
  audience: string;
  description: string;
  recommendedKeywords?: string[];
  recommendedNegativeKeywords?: string[];
  sources: SourcePresetDefinition[];
}

export const SOURCE_PRESET_PACKS: SourcePresetPack[] = [
  {
    id: 'single-shopify-migration-watch',
    name: 'Single-source Shopify migration watch',
    audience: 'Shopify experts and agencies looking for migration and rebuild demand',
    description: 'A focused pack for brands asking about Shopify migrations, replatforming, and implementation help.',
    recommendedKeywords: ['shopify migration', 'replatform', 'shopify expert', 'store rebuild'],
    recommendedNegativeKeywords: ['theme giveaway', 'job opening'],
    sources: [
      {
        name: 'Shopify migration requests',
        type: 'WEB_SEARCH',
        config: {
          query: '"shopify migration" OR "moving to shopify" OR "need a shopify expert" OR "store rebuild"',
          domains: ['community.shopify.com', 'news.ycombinator.com', 'indiehackers.com'],
          excludeTerms: ['theme giveaway', 'job opening'],
          sourceWeight: 1.05,
        },
      },
    ],
  },
  {
    id: 'single-ecommerce-tracking-rescue',
    name: 'Single-source ecommerce tracking rescue',
    audience: 'Consultants fixing checkout, attribution, pixel, and catalog issues for ecommerce brands',
    description: 'Targets direct pain around conversion tracking, merchant feeds, catalog sync, and broken storefront analytics.',
    recommendedKeywords: ['ga4 ecommerce', 'meta pixel', 'merchant center', 'catalog sync'],
    recommendedNegativeKeywords: ['course', 'job opening'],
    sources: [
      {
        name: 'Ecommerce tracking issues',
        type: 'WEB_SEARCH',
        config: {
          query: '"ga4 ecommerce" OR "meta pixel" OR "merchant center" OR "catalog sync" OR "checkout tracking"',
          domains: ['community.shopify.com', 'support.google.com', 'stackoverflow.com'],
          excludeTerms: ['course', 'job opening'],
          sourceWeight: 1.0,
        },
      },
    ],
  },
  {
    id: 'single-shopify-recommendations',
    name: 'Single-source Shopify recommendations',
    audience: 'Agencies looking for explicit recommendations and who-to-hire requests',
    description: 'Finds direct asks for Shopify agencies, experts, and ecommerce implementation partners.',
    recommendedKeywords: ['recommend shopify agency', 'shopify expert', 'ecommerce consultant'],
    recommendedNegativeKeywords: ['theme', 'job opening'],
    sources: [
      {
        name: 'Shopify recommendation requests',
        type: 'WEB_SEARCH',
        config: {
          query: '"recommend a shopify agency" OR "looking for a shopify expert" OR "need an ecommerce consultant"',
          domains: ['community.shopify.com', 'indiehackers.com', 'news.ycombinator.com'],
          excludeTerms: ['theme', 'job opening'],
          sourceWeight: 1.0,
        },
      },
    ],
  },
  {
    id: 'single-sam-gov-procurement',
    name: 'Single-source procurement watch',
    audience: 'Agencies and consultants looking for direct public-sector buying intent',
    description: 'A focused SAM.gov source for current contract and procurement demand with real timelines.',
    recommendedKeywords: ['implementation support', 'migration services', 'technical consulting'],
    recommendedNegativeKeywords: ['janitorial', 'construction'],
    sources: [
      {
        name: 'SAM.gov consulting demand',
        type: 'SAM_GOV',
        config: {
          query: '"implementation support" OR "technical consulting" OR "migration services"',
          postedWithinDays: 30,
          noticeTypes: ['solicitation'],
          sourceWeight: 1.1,
        },
      },
    ],
  },
  {
    id: 'single-freelancer-radar',
    name: 'Single-source freelancer radar',
    audience: 'Freelancers who want one fast source to validate demand',
    description: 'A minimal starting point that watches Ask HN for direct freelancer and consultant requests.',
    recommendedKeywords: ['need freelancer', 'consultant', 'implementation help'],
    recommendedNegativeKeywords: ['internship', 'junior role'],
    sources: [
      {
        name: 'Ask HN freelancer demand',
        type: 'HN_SEARCH',
        config: {
          query: '"need freelancer" OR "looking for consultant" OR "implementation help"',
          tags: 'story,comment',
          sourceWeight: 1.0,
        },
      },
    ],
  },
  {
    id: 'single-community-recommendations',
    name: 'Single-source recommendations',
    audience: 'Consultants and agencies looking for recommendation-style buying intent',
    description: 'A lightweight Hacker News pack for people asking who to hire or what consultant to use.',
    recommendedKeywords: ['recommend consultant', 'recommend agency', 'who should we hire'],
    recommendedNegativeKeywords: ['course', 'template'],
    sources: [
      {
        name: 'Ask HN recommendation demand',
        type: 'HN_SEARCH',
        config: {
          query: '"recommend consultant" OR "recommend agency" OR "who should we hire"',
          tags: 'story,comment',
          sourceWeight: 1.0,
        },
      },
    ],
  },
  {
    id: 'single-web-buyer-intent',
    name: 'Single-source web buyer intent',
    audience: 'Teams that want one broader search source instead of multiple feeds',
    description: 'A single web-search source scanning known communities for buyer-intent phrases.',
    recommendedKeywords: ['looking for consultant', 'need agency', 'implementation partner'],
    recommendedNegativeKeywords: ['course', 'job board'],
    sources: [
      {
        name: 'Web buyer-intent search',
        type: 'WEB_SEARCH',
        config: {
          query: '"looking for consultant" OR "need agency" OR "implementation partner"',
          domains: ['news.ycombinator.com', 'stackoverflow.com', 'github.com'],
          excludeTerms: ['course', 'job board'],
          sourceWeight: 1.0,
        },
      },
    ],
  },
  {
    id: 'single-stackoverflow-urgent',
    name: 'Single-source Stack Overflow rescue',
    audience: 'Technical freelancers solving urgent implementation and troubleshooting pain',
    description: 'A single Stack Overflow search source for urgent help-now problems and blocked teams.',
    recommendedKeywords: ['urgent help', 'blocked', 'migration help'],
    recommendedNegativeKeywords: ['homework', 'tutorial'],
    sources: [
      {
        name: 'Stack Overflow rescue issues',
        type: 'STACKOVERFLOW_SEARCH',
        config: {
          query: '"urgent" OR "blocked" OR "migration help" OR "need support"',
          sort: 'activity',
          sourceWeight: 1.0,
        },
      },
    ],
  },
  {
    id: 'single-hn-asks',
    name: 'Single-source Ask HN demand',
    audience: 'Freelancers and agencies testing HN as a single discovery channel',
    description: 'A focused Hacker News search pack for people asking for tools, help, and implementation support.',
    recommendedKeywords: ['consultant', 'need help', 'implementation'],
    recommendedNegativeKeywords: ['job', 'show hn'],
    sources: [
      {
        name: 'Ask HN implementation demand',
        type: 'HN_SEARCH',
        config: {
          query: '"consultant" OR "need help" OR "implementation"',
          tags: 'story,comment',
          sourceWeight: 1.0,
        },
      },
    ],
  },
  {
    id: 'single-github-discussions',
    name: 'Single-source GitHub discussions',
    audience: 'Teams selling implementation help into developer communities',
    description: 'A GitHub-only pack for support, migration, and delivery pain described in discussions.',
    recommendedKeywords: ['need help', 'migration', 'support'],
    recommendedNegativeKeywords: ['feature request', 'documentation'],
    sources: [
      {
        name: 'GitHub discussion pain',
        type: 'GITHUB_SEARCH',
        config: {
          query: '"need help" OR migration OR "looking for support"',
          type: 'discussions',
          sourceWeight: 1.0,
        },
      },
    ],
  },
  {
    id: 'single-github-issues',
    name: 'Single-source GitHub issues',
    audience: 'Technical consultants solving urgent implementation and reliability problems',
    description: 'A focused GitHub issues pack for operational blockers, migrations, and help requests.',
    recommendedKeywords: ['blocked', 'incident', 'migration'],
    recommendedNegativeKeywords: ['chore', 'typo'],
    sources: [
      {
        name: 'GitHub issue blockers',
        type: 'GITHUB_SEARCH',
        config: {
          query: '"blocked" OR incident OR migration OR "need support"',
          type: 'issues',
          sourceWeight: 1.0,
        },
      },
    ],
  },
  {
    id: 'single-rss-ask-hn',
    name: 'Single-source Ask HN RSS',
    audience: 'Freelancers and agencies who want one low-friction RSS feed to monitor',
    description: 'A single RSS source following Ask HN posts for new operator and founder demand.',
    recommendedKeywords: ['consultant', 'need help', 'implementation'],
    recommendedNegativeKeywords: ['job', 'show hn'],
    sources: [
      {
        name: 'Ask HN RSS feed',
        type: 'RSS',
        config: {
          url: 'https://hnrss.org/ask',
          sourceWeight: 1.0,
        },
      },
    ],
  },
  {
    id: 'single-operator-community-watch',
    name: 'Single-source operator community watch',
    audience: 'Consultants looking for founder and operator pain outside purely technical forums',
    description: 'A broader community search focused on operator pain, agency recommendations, and implementation asks.',
    recommendedKeywords: ['recommend agency', 'need consultant', 'operations help'],
    recommendedNegativeKeywords: ['job board', 'course'],
    sources: [
      {
        name: 'Operator community demand',
        type: 'WEB_SEARCH',
        config: {
          query: '"recommend agency" OR "need consultant" OR "operations help"',
          domains: ['indiehackers.com', 'community.shopify.com', 'news.ycombinator.com'],
          excludeTerms: ['job board', 'course'],
          sourceWeight: 1.0,
        },
      },
    ],
  },
  {
    id: 'single-rss-founder-requests',
    name: 'Single-source founder requests RSS',
    audience: 'Agencies wanting a lightweight founder-focused RSS stream',
    description: 'An RSS stream for fresh Ask HN and HN-style founder requests related to consultants, agencies, and implementation help.',
    recommendedKeywords: ['consultant', 'agency', 'implementation help'],
    recommendedNegativeKeywords: ['job', 'show hn'],
    sources: [
      {
        name: 'Founder request RSS stream',
        type: 'RSS',
        config: {
          url: 'https://hnrss.org/newest?q=consultant',
          sourceWeight: 1.0,
        },
      },
    ],
  },
  {
    id: 'two-source-shopify-growth',
    name: 'Shopify growth and retention',
    audience: 'Agencies helping ecommerce brands with CRO, retention, and lifecycle tooling',
    description: 'Pairs community asks with founder demand around Klaviyo, conversion issues, retention, and storefront growth.',
    recommendedKeywords: ['klaviyo help', 'conversion rate', 'shopify growth', 'retention setup'],
    recommendedNegativeKeywords: ['job opening', 'theme giveaway', 'course'],
    sources: [
      {
        name: 'Shopify growth search',
        type: 'WEB_SEARCH',
        config: {
          query: '"klaviyo help" OR "shopify conversion rate" OR "retention setup" OR "need ecommerce growth help"',
          domains: ['community.shopify.com', 'indiehackers.com', 'news.ycombinator.com'],
          excludeTerms: ['job opening', 'theme giveaway', 'course'],
          sourceWeight: 1.0,
        },
      },
      {
        name: 'Founder ecommerce growth feed',
        type: 'RSS',
        config: {
          url: 'https://hnrss.org/newest?q=shopify',
          sourceWeight: 0.85,
        },
      },
    ],
  },
  {
    id: 'two-source-ecommerce-platform-pain',
    name: 'Ecommerce platform pain',
    audience: 'Implementation partners solving storefront, feed, checkout, and app-stack problems',
    description: 'Captures clear ecommerce platform pain from operator communities and technical troubleshooting sources.',
    recommendedKeywords: ['checkout issue', 'merchant center', 'shopify app', 'catalog sync'],
    recommendedNegativeKeywords: ['job opening', 'theme swap'],
    sources: [
      {
        name: 'Ecommerce operator platform pain',
        type: 'WEB_SEARCH',
        config: {
          query: '"checkout issue" OR "merchant center" OR "catalog sync" OR "shopify app problem"',
          domains: ['community.shopify.com', 'support.bigcommerce.com', 'support.google.com'],
          excludeTerms: ['job opening', 'theme swap'],
          sourceWeight: 1.0,
        },
      },
      {
        name: 'Stack Overflow ecommerce implementation',
        type: 'STACKOVERFLOW_SEARCH',
        config: {
          query: '"shopify" OR "merchant center" OR "conversion tracking" OR "checkout"',
          sort: 'activity',
          sourceWeight: 0.9,
        },
      },
    ],
  },
  {
    id: 'two-source-procurement-radar',
    name: 'Procurement radar',
    audience: 'Agencies and consultants tracking open public-sector buying demand',
    description: 'Pairs SAM.gov procurement notices with broader implementation conversations for direct and predictive demand.',
    recommendedKeywords: ['technical consulting', 'implementation support', 'migration services'],
    recommendedNegativeKeywords: ['janitorial', 'construction', 'equipment supply'],
    sources: [
      {
        name: 'SAM.gov active solicitations',
        type: 'SAM_GOV',
        config: {
          query: '"technical consulting" OR "implementation support" OR "migration services"',
          postedWithinDays: 30,
          noticeTypes: ['solicitation'],
          sourceWeight: 1.15,
        },
      },
      {
        name: 'HN implementation demand',
        type: 'HN_SEARCH',
        config: {
          query: '"implementation help" OR "need consultant" OR "migration"',
          tags: 'story,comment',
          sourceWeight: 0.95,
        },
      },
    ],
  },
  {
    id: 'two-source-recommendation',
    name: 'Recommendation requests',
    audience: 'Service businesses looking for high-intent referral and recommendation asks',
    description: 'Two focused non-Reddit sources for buyer conversations where people explicitly ask who to hire.',
    recommendedKeywords: ['recommend agency', 'recommend consultant', 'who should we hire'],
    recommendedNegativeKeywords: ['course', 'template'],
    sources: [
      {
        name: 'Ask HN recommendation asks',
        type: 'HN_SEARCH',
        config: {
          query: '"recommend" consultant OR "recommend" agency OR "who should we hire"',
          tags: 'story,comment',
          sourceWeight: 1.0,
        },
      },
      {
        name: 'GitHub recommendation pain',
        type: 'GITHUB_SEARCH',
        config: {
          query: '"recommend" OR "who should we hire" OR "looking for support"',
          type: 'discussions',
          sourceWeight: 0.95,
        },
      },
    ],
  },
  {
    id: 'two-source-github-stackoverflow',
    name: 'Engineering rescue',
    audience: 'Consultants solving technical blockers, migrations, and implementation pain',
    description: 'Combines GitHub and Stack Overflow to capture both community pain and practical delivery issues.',
    recommendedKeywords: ['migration help', 'blocked', 'need support'],
    recommendedNegativeKeywords: ['tutorial', 'homework'],
    sources: [
      {
        name: 'GitHub delivery blockers',
        type: 'GITHUB_SEARCH',
        config: {
          query: '"blocked" OR migration OR "need support"',
          type: 'discussions',
          sourceWeight: 1.05,
        },
      },
      {
        name: 'Stack Overflow technical rescue',
        type: 'STACKOVERFLOW_SEARCH',
        config: {
          query: '"need help" OR migration OR incident OR consultant',
          sort: 'activity',
          sourceWeight: 0.95,
        },
      },
    ],
  },
  {
    id: 'two-source-founder-demand',
    name: 'Founder demand signals',
    audience: 'Agencies looking for founder and operator buying intent',
    description: 'Combines Ask HN search with the Ask HN RSS feed for fast-moving founder demand.',
    recommendedKeywords: ['consultant', 'recommend agency', 'need help'],
    recommendedNegativeKeywords: ['job', 'show hn'],
    sources: [
      {
        name: 'Ask HN buyer search',
        type: 'HN_SEARCH',
        config: {
          query: '"consultant" OR "recommend agency" OR "need help"',
          tags: 'story,comment',
          sourceWeight: 1.05,
        },
      },
      {
        name: 'Ask HN RSS watch',
        type: 'RSS',
        config: {
          url: 'https://hnrss.org/ask',
          sourceWeight: 0.95,
        },
      },
    ],
  },
  {
    id: 'two-source-operator-communities',
    name: 'Operator community demand',
    audience: 'Service businesses chasing founder, operator, and small-business buying intent',
    description: 'Pairs broader operator community search with an RSS founder stream for cleaner non-Reddit demand coverage.',
    recommendedKeywords: ['recommend agency', 'need consultant', 'implementation help'],
    recommendedNegativeKeywords: ['course', 'job board'],
    sources: [
      {
        name: 'Operator community search',
        type: 'WEB_SEARCH',
        config: {
          query: '"recommend agency" OR "need consultant" OR "implementation help"',
          domains: ['indiehackers.com', 'community.shopify.com', 'news.ycombinator.com'],
          excludeTerms: ['course', 'job board'],
          sourceWeight: 1.0,
        },
      },
      {
        name: 'Founder request RSS',
        type: 'RSS',
        config: {
          url: 'https://hnrss.org/newest?q=agency',
          sourceWeight: 0.95,
        },
      },
    ],
  },
  {
    id: 'two-source-ecommerce-operators',
    name: 'Ecommerce operator demand',
    audience: 'Consultants and agencies helping ecommerce brands with implementation, migration, and rescue work',
    description: 'Tracks ecommerce operator communities and founder streams for platform pain, agency recommendations, and implementation requests.',
    recommendedKeywords: ['shopify consultant', 'migration help', 'recommend agency'],
    recommendedNegativeKeywords: ['theme', 'job board'],
    sources: [
      {
        name: 'Ecommerce operator search',
        type: 'WEB_SEARCH',
        config: {
          query: '"shopify consultant" OR "migration help" OR "recommend agency"',
          domains: ['community.shopify.com', 'support.bigcommerce.com', 'news.ycombinator.com'],
          excludeTerms: ['theme', 'job board'],
          sourceWeight: 1.0,
        },
      },
      {
        name: 'Ecommerce founder RSS',
        type: 'RSS',
        config: {
          url: 'https://hnrss.org/newest?q=shopify',
          sourceWeight: 0.9,
        },
      },
    ],
  },
  {
    id: 'two-source-revops-crm',
    name: 'RevOps and CRM implementation',
    audience: 'Teams selling CRM, RevOps, and integration implementation services',
    description: 'Combines business-system community search with technical integration pain for real implementation demand.',
    recommendedKeywords: ['hubspot consultant', 'salesforce migration', 'integration help'],
    recommendedNegativeKeywords: ['template', 'course'],
    sources: [
      {
        name: 'CRM community demand',
        type: 'WEB_SEARCH',
        config: {
          query: '"hubspot consultant" OR "salesforce migration" OR "integration help"',
          domains: ['community.hubspot.com', 'trailhead.salesforce.com', 'news.ycombinator.com'],
          excludeTerms: ['template', 'course'],
          sourceWeight: 1.0,
        },
      },
      {
        name: 'Integration implementation pain',
        type: 'STACKOVERFLOW_SEARCH',
        config: {
          query: '"integration help" OR "CRM migration" OR "webhook" OR "sync issue"',
          sort: 'activity',
          sourceWeight: 0.9,
        },
      },
    ],
  },
  {
    id: 'two-source-urgent-support',
    name: 'Urgent support requests',
    audience: 'Freelancers and consultants solving urgent blockers quickly',
    description: 'A compact non-Reddit pack for rescue work, operational pain, and help-now conversations.',
    recommendedKeywords: ['urgent help', 'blocked', 'need help now'],
    recommendedNegativeKeywords: ['job', 'hiring full-time'],
    sources: [
      {
        name: 'GitHub urgent blockers',
        type: 'GITHUB_SEARCH',
        config: {
          query: '"urgent" OR "blocked" OR "need help now"',
          type: 'issues',
          sourceWeight: 1.05,
        },
      },
      {
        name: 'Stack Overflow urgent issues',
        type: 'STACKOVERFLOW_SEARCH',
        config: {
          query: '"urgent" OR "blocked" OR "need help now"',
          sort: 'activity',
          sourceWeight: 0.95,
        },
      },
    ],
  },
  {
    id: 'ai-automation',
    name: 'AI Automation Agency',
    audience: 'Agencies building workflows, agents, and internal automations',
    description: 'Covers founder pain, ops automation demand, AI tooling evaluation, and direct consultant requests without relying on Reddit.',
    recommendedKeywords: [
      'AI automation agency',
      'workflow automation',
      'n8n consultant',
      'internal tools',
      'AI developer',
    ],
    recommendedNegativeKeywords: [
      'course',
      'affiliate',
      'newsletter',
      'wordpress',
    ],
    sources: [
      {
        name: 'Ask HN Automation Demand',
        type: 'HN_SEARCH',
        config: {
          query: '"automation" OR "internal tools" OR "AI workflow" consultant',
          tags: 'story',
          sourceWeight: 1.1,
        },
      },
      {
        name: 'Web Search Automation Leads',
        type: 'WEB_SEARCH',
        config: {
          query: '"need automation consultant" OR "recommend automation agency" OR "looking for AI developer"',
          domains: ['news.ycombinator.com', 'stackoverflow.com', 'github.com'],
          excludeTerms: ['course', 'affiliate'],
          sourceWeight: 0.95,
        },
      },
      {
        name: 'GitHub Automation Pain',
        type: 'GITHUB_SEARCH',
        config: {
          query: '"workflow automation" OR "internal tooling" OR "AI agent"',
          type: 'discussions',
          sourceWeight: 0.9,
        },
      },
      {
        name: 'Stack Overflow Automation Problems',
        type: 'STACKOVERFLOW_SEARCH',
        config: {
          query: '"automation" OR "workflow" OR "internal tools" OR consultant',
          sort: 'activity',
          sourceWeight: 0.95,
        },
      },
    ],
  },
  {
    id: 'devops-consultancy',
    name: 'DevOps Consultancy',
    audience: 'Teams selling DevOps, platform, cloud, and SRE implementation work',
    description: 'Targets Kubernetes, CI/CD, platform reliability, AWS migration, and DevOps rescue opportunities across cleaner engineering communities.',
    recommendedKeywords: [
      'DevOps consultant',
      'Kubernetes help',
      'AWS migration',
      'CI/CD pipeline',
      'platform engineering',
    ],
    recommendedNegativeKeywords: [
      'full-time',
      'certification',
      'course',
      'bootcamp',
    ],
    sources: [
      {
        name: 'GitHub DevOps Rescue',
        type: 'GITHUB_SEARCH',
        config: {
          query: '"need DevOps consultant" OR "Kubernetes help" OR "CI/CD pipeline" OR "platform engineering"',
          type: 'discussions',
          sourceWeight: 1.15,
        },
      },
      {
        name: 'Stack Overflow DevOps Pain',
        type: 'STACKOVERFLOW_SEARCH',
        config: {
          query: '"need help" OR "production issue" OR "migration" OR "consultant"',
          tags: ['kubernetes', 'devops', 'docker', 'aws'],
          sort: 'activity',
          sourceWeight: 0.95,
        },
      },
      {
        name: 'Ask HN Infra Problems',
        type: 'HN_SEARCH',
        config: {
          query: '"kubernetes" OR "aws migration" OR "platform engineering" OR "incident"',
          tags: 'story,comment',
          sourceWeight: 1.05,
        },
      },
      {
        name: 'Web Search Cloud Migration',
        type: 'WEB_SEARCH',
        config: {
          query: '"looking for kubernetes consultant" OR "need AWS migration help" OR "recommend DevOps agency"',
          domains: ['news.ycombinator.com', 'stackoverflow.com', 'github.com'],
          excludeTerms: ['tutorial', 'course'],
          sourceWeight: 0.9,
        },
      },
    ],
  },
  {
    id: 'software-implementation',
    name: 'Software Implementation Partner',
    audience: 'Teams implementing CRMs, internal tools, integrations, and business systems',
    description: 'Finds requests for integrations, process cleanup, tooling migrations, and implementation partners without leaning on Reddit.',
    recommendedKeywords: [
      'implementation partner',
      'integration consultant',
      'CRM migration',
      'ERP implementation',
      'tool migration',
    ],
    recommendedNegativeKeywords: [
      'template',
      'job opening',
      'theme',
      'plugin',
    ],
    sources: [
      {
        name: 'GitHub Systems Implementation',
        type: 'GITHUB_SEARCH',
        config: {
          query: '"implement" CRM OR "integration help" OR "looking for implementation partner"',
          type: 'discussions',
          sourceWeight: 1.1,
        },
      },
      {
        name: 'Web Search Systems Pain',
        type: 'WEB_SEARCH',
        config: {
          query: '"need implementation partner" OR "recommend integration consultant" OR "system migration help"',
          domains: ['news.ycombinator.com', 'stackoverflow.com', 'github.com'],
          excludeTerms: ['template', 'job opening'],
          sourceWeight: 0.9,
        },
      },
      {
        name: 'Ask HN Tooling Rollouts',
        type: 'HN_SEARCH',
        config: {
          query: '"CRM" OR "ERP" OR "integration" OR "tool migration"',
          tags: 'story',
          sourceWeight: 1.0,
        },
      },
    ],
  },
  {
    id: 'freelance-b2b',
    name: 'Freelance B2B Builder',
    audience: 'Freelancers hunting technical pain and short consulting engagements',
    description: 'Focuses on recommendation requests, urgent pain, and technical implementation work that can convert fast across engineering-friendly communities.',
    recommendedKeywords: [
      'need freelancer',
      'recommend developer',
      'consultant',
      'implementation help',
      'technical support',
    ],
    recommendedNegativeKeywords: [
      'internship',
      'junior role',
      'resume',
      'portfolio review',
    ],
    sources: [
      {
        name: 'Ask HN Freelancer Leads',
        type: 'HN_SEARCH',
        config: {
          query: '"recommend developer" OR "need freelancer" OR "looking for consultant"',
          tags: 'story,comment',
          sourceWeight: 1.15,
        },
      },
      {
        name: 'Stack Overflow Implementation Help',
        type: 'STACKOVERFLOW_SEARCH',
        config: {
          query: '"how do we" OR "need help" OR "consultant"',
          sort: 'activity',
          sourceWeight: 0.95,
        },
      },
      {
        name: 'GitHub Issue Pain',
        type: 'GITHUB_SEARCH',
        config: {
          query: '"looking for help" OR "need support" OR "migration"',
          type: 'issues',
          sourceWeight: 0.9,
        },
      },
    ],
  },
  {
    id: 'four-source-buyer-intent',
    name: 'Full buyer-intent coverage',
    audience: 'Teams that want broader intent coverage across multiple communities',
    description: 'A broader pack for testing multi-source installs across HN, web, Stack Overflow, and GitHub.',
    recommendedKeywords: ['consultant', 'agency', 'implementation partner', 'need help'],
    recommendedNegativeKeywords: ['course', 'job board', 'bootcamp'],
    sources: [
      {
        name: 'Ask HN buyer intent',
        type: 'HN_SEARCH',
        config: {
          query: '"looking for consultant" OR "need agency" OR "implementation partner"',
          tags: 'story,comment',
          sourceWeight: 1.1,
        },
      },
      {
        name: 'Ask HN buyer demand',
        type: 'HN_SEARCH',
        config: {
          query: '"consultant" OR "agency" OR "implementation partner"',
          tags: 'story,comment',
          sourceWeight: 1.0,
        },
      },
      {
        name: 'Web buyer search',
        type: 'WEB_SEARCH',
        config: {
          query: '"looking for consultant" OR "need agency" OR "implementation partner"',
          domains: ['news.ycombinator.com', 'stackoverflow.com', 'github.com'],
          excludeTerms: ['course', 'job board'],
          sourceWeight: 0.9,
        },
      },
      {
        name: 'GitHub pain discussions',
        type: 'GITHUB_SEARCH',
        config: {
          query: '"need help" OR "looking for support" OR "migration"',
          type: 'discussions',
          sourceWeight: 0.9,
        },
      },
    ],
  },
  {
    id: 'community-intent-network',
    name: 'Community intent network',
    audience: 'Teams that want broad, cleaner community coverage without depending on Reddit',
    description: 'A multi-source pack across GitHub, Stack Overflow, Hacker News, and RSS feeds for stronger early demand coverage.',
    recommendedKeywords: ['consultant', 'need help', 'migration', 'recommend'],
    recommendedNegativeKeywords: ['course', 'job board', 'tutorial'],
    sources: [
      {
        name: 'GitHub discussion intent',
        type: 'GITHUB_SEARCH',
        config: {
          query: '"need help" OR "looking for support" OR migration',
          type: 'discussions',
          sourceWeight: 1.0,
        },
      },
      {
        name: 'Stack Overflow operational pain',
        type: 'STACKOVERFLOW_SEARCH',
        config: {
          query: '"need help" OR incident OR migration OR consultant',
          sort: 'activity',
          sourceWeight: 0.95,
        },
      },
      {
        name: 'Ask HN founder asks',
        type: 'HN_SEARCH',
        config: {
          query: '"consultant" OR "recommend agency" OR "need help"',
          tags: 'story,comment',
          sourceWeight: 1.0,
        },
      },
      {
        name: 'Ask HN RSS stream',
        type: 'RSS',
        config: {
          url: 'https://hnrss.org/ask',
          sourceWeight: 0.9,
        },
      },
    ],
  },
  {
    id: 'b2b-saas-customer-rescue',
    name: 'B2B SaaS customer rescue',
    audience: 'Agencies and consultants helping SaaS teams with support escalations, migrations, and delivery fixes',
    description: 'Focuses on public signs that a SaaS team is blocked, needs implementation support, or is looking for outside help to stabilize delivery.',
    recommendedKeywords: ['migration help', 'support escalation', 'implementation partner', 'integration issue'],
    recommendedNegativeKeywords: ['feature request', 'changelog', 'release notes'],
    sources: [
      {
        name: 'GitHub customer-blocker discussions',
        type: 'GITHUB_SEARCH',
        config: {
          query: '"need help" OR "looking for support" OR migration OR integration',
          type: 'discussions',
          sourceWeight: 1.05,
        },
      },
      {
        name: 'Stack Overflow support rescue',
        type: 'STACKOVERFLOW_SEARCH',
        config: {
          query: '"need support" OR migration OR "integration issue" OR "production issue"',
          sort: 'activity',
          sourceWeight: 0.95,
        },
      },
      {
        name: 'Discourse operator support asks',
        type: 'DISCOURSE',
        config: {
          baseUrl: 'https://meta.discourse.org',
          query: '"need consultant" OR migration OR "implementation help"',
          tags: ['support'],
          postedWithinDays: 30,
          sourceWeight: 0.9,
        },
      },
    ],
  },
  {
    id: 'data-bi-analytics-implementation',
    name: 'Data and BI implementation',
    audience: 'Consultants delivering analytics stacks, dashboards, ELT pipelines, and reporting systems',
    description: 'Tracks public demand around broken reporting, data migrations, dashboard rebuilds, and analytics implementation work.',
    recommendedKeywords: ['dashboard migration', 'data pipeline', 'analytics implementation', 'reporting help'],
    recommendedNegativeKeywords: ['course', 'certification', 'tutorial'],
    sources: [
      {
        name: 'Ask HN analytics demand',
        type: 'HN_SEARCH',
        config: {
          query: '"dashboard" OR "reporting" OR "data pipeline" OR "need analytics help"',
          tags: 'story,comment',
          sourceWeight: 1.0,
        },
      },
      {
        name: 'Stack Overflow data delivery pain',
        type: 'STACKOVERFLOW_SEARCH',
        config: {
          query: '"dashboard" OR "etl" OR "reporting" OR migration OR "need help"',
          sort: 'activity',
          sourceWeight: 0.95,
        },
      },
      {
        name: 'Web analytics consultant search',
        type: 'WEB_SEARCH',
        config: {
          query: '"need analytics consultant" OR "dashboard migration" OR "reporting implementation"',
          domains: ['news.ycombinator.com', 'github.com', 'community.shopify.com'],
          excludeTerms: ['course', 'tutorial'],
          sourceWeight: 0.9,
        },
      },
    ],
  },
  {
    id: 'shopify-ecommerce-implementation',
    name: 'Shopify and ecommerce implementation',
    audience: 'Freelancers and agencies helping ecommerce brands with migrations, apps, storefronts, and operations fixes',
    description: 'Combines ecommerce operator communities with technical pain signals for Shopify, storefront, and integration work.',
    recommendedKeywords: ['shopify migration', 'storefront help', 'conversion issue', 'integration help'],
    recommendedNegativeKeywords: ['dropshipping course', 'theme giveaway', 'job board'],
    sources: [
      {
        name: 'Ecommerce operator search',
        type: 'WEB_SEARCH',
        config: {
          query: '"shopify consultant" OR "need ecommerce help" OR "store migration"',
          domains: ['community.shopify.com', 'news.ycombinator.com', 'indiehackers.com'],
          excludeTerms: ['course', 'job board'],
          sourceWeight: 1.0,
        },
      },
      {
        name: 'Discourse ecommerce implementation',
        type: 'DISCOURSE',
        config: {
          baseUrl: 'https://meta.discourse.org',
          query: 'migration OR integration OR "need support"',
          postedWithinDays: 30,
          sourceWeight: 0.85,
        },
      },
      {
        name: 'Founder ecommerce asks',
        type: 'RSS',
        config: {
          url: 'https://hnrss.org/newest?q=shopify',
          sourceWeight: 0.85,
        },
      },
    ],
  },
  {
    id: 'local-service-freelancer-opportunities',
    name: 'Local-service freelancer opportunities',
    audience: 'Solo operators and freelancers looking for smaller, faster-turnaround implementation and support work',
    description: 'A lighter pack for consultants who want shorter-cycle opportunities from public recommendation and help-needed threads.',
    recommendedKeywords: ['need freelancer', 'recommend consultant', 'quick fix', 'implementation help'],
    recommendedNegativeKeywords: ['full time', 'internship', 'course'],
    sources: [
      {
        name: 'Ask HN freelancer requests',
        type: 'HN_SEARCH',
        config: {
          query: '"need freelancer" OR "recommend consultant" OR "quick fix"',
          tags: 'story,comment',
          sourceWeight: 1.05,
        },
      },
      {
        name: 'Web quick-turn consultant search',
        type: 'WEB_SEARCH',
        config: {
          query: '"need consultant this week" OR "quick implementation help" OR "recommend freelancer"',
          domains: ['news.ycombinator.com', 'indiehackers.com', 'community.shopify.com'],
          excludeTerms: ['job board', 'course'],
          sourceWeight: 0.9,
        },
      },
    ],
  },
  {
    id: 'trigger-event-funding-watch',
    name: 'Funding and expansion watch',
    audience: 'Agencies and consultants tracking companies likely to buy after funding or expansion milestones',
    description: 'Looks for public posts and discussions about new funding, expansion, and implementation-heavy growth moments.',
    recommendedKeywords: ['funding', 'seed round', 'series a', 'expansion'],
    recommendedNegativeKeywords: ['newsletter', 'podcast', 'job board'],
    sources: [
      {
        name: 'Founder funding chatter',
        type: 'HN_SEARCH',
        config: {
          query: '"raised" OR funding OR "seed round" OR "series a"',
          tags: 'story,comment',
          sourceWeight: 0.95,
        },
      },
      {
        name: 'Growth trigger search',
        type: 'WEB_SEARCH',
        config: {
          query: '"raised seed" OR "series a" OR "just raised" OR "expanding team"',
          domains: ['news.ycombinator.com', 'indiehackers.com', 'techcrunch.com'],
          excludeTerms: ['newsletter', 'podcast'],
          sourceWeight: 0.85,
        },
      },
    ],
  },
  {
    id: 'trigger-event-hiring-watch',
    name: 'Hiring and team-change watch',
    audience: 'Service firms watching for companies entering a likely buying window after hiring or leadership changes',
    description: 'Tracks hiring spikes and new growth, ops, and implementation leadership signals that often precede vendor demand.',
    recommendedKeywords: ['hiring head of growth', 'new cmo', 'implementation manager', 'hiring revops'],
    recommendedNegativeKeywords: ['recruiter', 'internship', 'career fair'],
    sources: [
      {
        name: 'Leadership change search',
        type: 'WEB_SEARCH',
        config: {
          query: '"new CMO" OR "new head of growth" OR "joined as" OR "hiring revops"',
          domains: ['linkedin.com', 'news.ycombinator.com', 'indiehackers.com'],
          excludeTerms: ['recruiter', 'career fair'],
          sourceWeight: 0.85,
        },
      },
      {
        name: 'Ask HN hiring triggers',
        type: 'HN_SEARCH',
        config: {
          query: '"hiring" OR "head of growth" OR "new team" OR "hiring ops"',
          tags: 'story,comment',
          sourceWeight: 0.9,
        },
      },
    ],
  },
];

export const SOURCE_QUERY_TEMPLATES: Array<{
  type: string;
  label: string;
  description?: string;
  baseUrl?: string;
  query?: string;
  subreddit?: string;
  domains?: string[];
  tags?: string[];
  postedWithinDays?: number;
  repo?: string;
  contentType?: string;
  stackTags?: string[];
  stackSort?: string;
  sort?: string;
  gitlabScope?: string;
  project?: string;
  youtubeOrder?: string;
  recommendedKeywords?: string[];
  recommendedNegativeKeywords?: string[];
}> = [
  {
    type: 'GITLAB_SEARCH',
    label: 'GitLab Issue Blockers',
    description: 'Public GitLab issues and merge requests where teams are blocked, migrating, or looking for implementation support.',
    query: 'blocked OR migration OR "need support" OR consultant',
    gitlabScope: 'issues',
    recommendedKeywords: ['blocked migration', 'implementation support', 'consultant'],
    recommendedNegativeKeywords: ['documentation typo', 'chore'],
  },
  {
    type: 'GITLAB_SEARCH',
    label: 'GitLab Merge-Request Friction',
    description: 'Detects delivery friction in merge-request discussions that often imply implementation help demand.',
    query: 'incident OR rollback OR "need help" OR "breaking change"',
    gitlabScope: 'merge_requests',
    recommendedKeywords: ['incident', 'rollback', 'breaking change'],
    recommendedNegativeKeywords: ['release notes', 'minor refactor'],
  },
  {
    type: 'YOUTUBE_SEARCH',
    label: 'YouTube Migration Pain',
    description: 'Recent practitioner videos discussing migration failures, integration pain, and implementation lessons.',
    query: '"migration failed" OR "integration issue" OR "need help automation"',
    postedWithinDays: 30,
    youtubeOrder: 'date',
    recommendedKeywords: ['migration', 'integration issue', 'automation help'],
    recommendedNegativeKeywords: ['tutorial for beginners', 'course promo'],
  },
  {
    type: 'YOUTUBE_SEARCH',
    label: 'YouTube Tooling Complaints',
    description: 'Fresh video content surfacing tooling pain, outages, and blocked workflows.',
    query: 'incident OR outage OR "blocked workflow" OR "tooling pain"',
    postedWithinDays: 14,
    youtubeOrder: 'date',
    recommendedKeywords: ['incident', 'outage', 'blocked workflow'],
    recommendedNegativeKeywords: ['product review', 'unboxing'],
  },
  {
    type: 'DEVTO_SEARCH',
    label: 'Dev.to Implementation Pain',
    description: 'Dev.to posts describing migration blockers, tooling pain, and requests for practical implementation help.',
    query: '"need help" OR migration OR consultant OR "looking for support"',
    tags: ['devops', 'webdev', 'ai'],
    postedWithinDays: 30,
    recommendedKeywords: ['migration', 'implementation help', 'consultant'],
    recommendedNegativeKeywords: ['beginner tutorial', 'job post'],
  },
  {
    type: 'DEVTO_SEARCH',
    label: 'Dev.to Agency Recommendation Signals',
    description: 'Recommendation-style posts where teams compare agencies, freelancers, or implementation partners.',
    query: '"recommend" OR "best" OR agency OR consultant OR "implementation partner"',
    tags: ['saas', 'startup', 'programming'],
    postedWithinDays: 30,
    recommendedKeywords: ['recommend consultant', 'agency', 'implementation partner'],
    recommendedNegativeKeywords: ['course', 'hiring full-time'],
  },
  {
    type: 'DISCOURSE',
    label: 'Operator Community Watch',
    description: 'Public Discourse communities discussing consultants, migration help, and implementation support.',
    baseUrl: 'https://meta.discourse.org',
    query: '"need consultant" OR migration OR "implementation help"',
    tags: ['support'],
    postedWithinDays: 30,
    recommendedKeywords: ['consultant', 'implementation help', 'migration'],
    recommendedNegativeKeywords: ['release notes', 'feature request'],
  },
  {
    type: 'DISCOURSE',
    label: 'Recommendation Threads',
    description: 'A starter query for recommendation-style posts in public Discourse communities.',
    baseUrl: 'https://meta.discourse.org',
    query: '"recommend" OR "looking for support" OR "who should we hire"',
    tags: ['support'],
    postedWithinDays: 30,
    recommendedKeywords: ['recommend', 'support partner', 'who should we hire'],
    recommendedNegativeKeywords: ['job board', 'newsletter'],
  },
  {
    type: 'SAM_GOV',
    label: 'Open Solicitations',
    description: 'Current procurement notices for consulting, migration, or implementation work.',
    query: '"technical consulting" OR "implementation support" OR "migration services"',
    recommendedKeywords: ['technical consulting', 'implementation support', 'migration services'],
    recommendedNegativeKeywords: ['construction', 'equipment supply'],
  },
  {
    type: 'SAM_GOV',
    label: 'CRM / RevOps Procurement',
    description: 'Public-sector buying intent related to CRM, systems integration, and business process improvement.',
    query: '"CRM implementation" OR "systems integration" OR "business process improvement"',
    recommendedKeywords: ['CRM implementation', 'systems integration'],
    recommendedNegativeKeywords: ['training only', 'staffing'],
  },
  {
    type: 'REDDIT_SEARCH',
    label: 'Buyer Intent',
    description: 'Explicit asks for consultants, agencies, or implementation support.',
    query: '"looking for" consultant OR "need help" implementation OR "recommend" agency',
    sort: 'new',
    recommendedKeywords: ['consultant', 'agency', 'implementation help'],
    recommendedNegativeKeywords: ['job board', 'newsletter'],
  },
  {
    type: 'REDDIT_SEARCH',
    label: 'Pain Complaints',
    description: 'Operational pain and frustration that can be turned into discovery calls.',
    query: '"struggling with" automation OR "manual process" OR "this is painful"',
    sort: 'new',
    recommendedKeywords: ['manual process', 'workflow', 'automation'],
    recommendedNegativeKeywords: ['rant', 'meme'],
  },
  {
    type: 'REDDIT_SEARCH',
    label: 'Small Business',
    description: 'Owner-led buying intent from smaller teams.',
    query: '"need automation" OR "recommend developer" OR "looking for agency"',
    subreddit: 'smallbusiness',
    sort: 'new',
    recommendedKeywords: ['small business automation', 'developer recommendation'],
  },
  {
    type: 'HN_SEARCH',
    label: 'Ops + Tooling',
    description: 'Founders and engineers discussing internal operations and tooling gaps.',
    query: '"internal tools" OR "automation" OR "workflow"',
    tags: ['story'],
    recommendedKeywords: ['internal tools', 'workflow automation'],
  },
  {
    type: 'HN_SEARCH',
    label: 'Infra Pain',
    description: 'Reliability, migration, and infra-pressure signals.',
    query: '"kubernetes" OR "incident" OR "migration"',
    tags: ['story', 'comment'],
    recommendedKeywords: ['kubernetes', 'migration', 'incident'],
  },
  {
    type: 'WEB_SEARCH',
    label: 'Agency Recommendations',
    description: 'Searches broad communities for recommendation-style buying signals.',
    query: '"recommend" "automation agency" OR "recommend devops consultant"',
    domains: ['news.ycombinator.com', 'github.com'],
    recommendedKeywords: ['automation agency', 'devops consultant'],
  },
  {
    type: 'WEB_SEARCH',
    label: 'Implementation Help',
    description: 'Finds requests for migrations, partners, and systems help.',
    query: '"need implementation partner" OR "integration consultant" OR "migration help"',
    domains: ['stackoverflow.com', 'github.com', 'news.ycombinator.com'],
    recommendedKeywords: ['implementation partner', 'integration consultant'],
    recommendedNegativeKeywords: ['template', 'course'],
  },
  {
    type: 'GITHUB_SEARCH',
    label: 'Discussions Pain',
    description: 'Community discussions where teams describe support and delivery pain.',
    query: '"looking for help" OR "need support" OR "migration"',
    contentType: 'discussions',
    recommendedKeywords: ['migration', 'support', 'implementation'],
  },
  {
    type: 'GITHUB_SEARCH',
    label: 'Issue Friction',
    description: 'Issue trackers showing implementation blockers and delivery friction.',
    query: '"consultant" OR "implementation" OR "support needed"',
    contentType: 'issues',
    recommendedKeywords: ['implementation', 'support needed'],
  },
  {
    type: 'STACKOVERFLOW_SEARCH',
    label: 'DevOps Issues',
    description: 'High-friction technical problems that can lead to advisory work.',
    query: '"need help" OR "production issue" OR "migration"',
    stackTags: ['kubernetes', 'devops', 'docker'],
    stackSort: 'activity',
    recommendedKeywords: ['production issue', 'migration', 'devops'],
  },
  {
    type: 'STACKOVERFLOW_SEARCH',
    label: 'Automation Questions',
    description: 'Automation and integration problems with buying potential.',
    query: '"workflow" OR "automation" OR "integration"',
    stackTags: ['python', 'api', 'automation'],
    stackSort: 'activity',
    recommendedKeywords: ['workflow automation', 'integration'],
  },
];
