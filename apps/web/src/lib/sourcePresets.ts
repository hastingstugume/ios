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
];

export const SOURCE_QUERY_TEMPLATES: Array<{
  type: string;
  label: string;
  description?: string;
  query?: string;
  subreddit?: string;
  domains?: string[];
  tags?: string[];
  repo?: string;
  contentType?: string;
  stackTags?: string[];
  stackSort?: string;
  sort?: string;
  recommendedKeywords?: string[];
  recommendedNegativeKeywords?: string[];
}> = [
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
