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
    id: 'ai-automation',
    name: 'AI Automation Agency',
    audience: 'Agencies building workflows, agents, and internal automations',
    description: 'Covers founder pain, ops automation demand, AI tooling evaluation, and direct consultant requests.',
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
        name: 'AI Ops Buyer Intent',
        type: 'REDDIT_SEARCH',
        config: {
          query: '"looking for" AI automation agency OR "need" automation consultant OR "workflow automation" help',
          sort: 'new',
          excludeTerms: ['job board', 'newsletter'],
          sourceWeight: 1.15,
        },
      },
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
          domains: ['reddit.com', 'news.ycombinator.com', 'stackoverflow.com'],
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
    ],
  },
  {
    id: 'devops-consultancy',
    name: 'DevOps Consultancy',
    audience: 'Teams selling DevOps, platform, cloud, and SRE implementation work',
    description: 'Targets Kubernetes, CI/CD, platform reliability, AWS migration, and DevOps rescue opportunities.',
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
        name: 'Reddit DevOps Rescue',
        type: 'REDDIT_SEARCH',
        config: {
          query: '"need DevOps consultant" OR "Kubernetes help" OR "CI/CD pipeline" consultant',
          sort: 'new',
          excludeTerms: ['hiring full-time'],
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
          domains: ['reddit.com', 'news.ycombinator.com'],
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
    description: 'Finds requests for integrations, process cleanup, tooling migrations, and implementation partners.',
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
        name: 'Reddit Systems Implementation',
        type: 'REDDIT_SEARCH',
        config: {
          query: '"implement" CRM OR "integration help" OR "looking for implementation partner"',
          sort: 'new',
          sourceWeight: 1.1,
        },
      },
      {
        name: 'Web Search Systems Pain',
        type: 'WEB_SEARCH',
        config: {
          query: '"need implementation partner" OR "recommend integration consultant" OR "system migration help"',
          domains: ['reddit.com', 'news.ycombinator.com', 'stackoverflow.com'],
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
    description: 'Focuses on recommendation requests, urgent pain, and technical implementation work that can convert fast.',
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
        name: 'Reddit Freelancer Leads',
        type: 'REDDIT_SEARCH',
        config: {
          query: '"recommend developer" OR "need freelancer" OR "looking for consultant"',
          sort: 'new',
          excludeTerms: ['full-time', 'internship'],
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
    domains: ['reddit.com', 'news.ycombinator.com'],
    recommendedKeywords: ['automation agency', 'devops consultant'],
  },
  {
    type: 'WEB_SEARCH',
    label: 'Implementation Help',
    description: 'Finds requests for migrations, partners, and systems help.',
    query: '"need implementation partner" OR "integration consultant" OR "migration help"',
    domains: ['reddit.com', 'stackoverflow.com'],
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
