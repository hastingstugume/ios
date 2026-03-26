import { PrismaClient, UserRole, SourceType, SourceStatus, SignalCategory, SignalStatus, AlertFrequency, AuditAction } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ──────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('demo1234!', 10);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@acmegrowth.io' },
    update: {},
    create: {
      email: 'alice@acmegrowth.io',
      name: 'Alice Thornton',
      passwordHash,
      emailVerified: true,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@acmegrowth.io' },
    update: {},
    create: {
      email: 'bob@acmegrowth.io',
      name: 'Bob Ramirez',
      passwordHash,
      emailVerified: true,
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: 'carol@acmegrowth.io' },
    update: {},
    create: {
      email: 'carol@acmegrowth.io',
      name: 'Carol Yuen',
      passwordHash,
      emailVerified: true,
    },
  });

  // ── Organization ──────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-growth' },
    update: {},
    create: {
      name: 'Acme Growth Agency',
      slug: 'acme-growth',
      plan: 'pro',
    },
  });

  const secondOrg = await prisma.organization.upsert({
    where: { slug: 'northstar-advisory' },
    update: {},
    create: {
      name: 'Northstar Advisory',
      slug: 'northstar-advisory',
      plan: 'starter',
    },
  });

  // ── Members ───────────────────────────────────────────────────────────────
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: alice.id } },
    update: {},
    create: { organizationId: org.id, userId: alice.id, role: UserRole.OWNER },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: bob.id } },
    update: {},
    create: { organizationId: org.id, userId: bob.id, role: UserRole.ADMIN },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: carol.id } },
    update: {},
    create: { organizationId: org.id, userId: carol.id, role: UserRole.ANALYST },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: secondOrg.id, userId: alice.id } },
    update: {},
    create: { organizationId: secondOrg.id, userId: alice.id, role: UserRole.ADMIN },
  });

  await prisma.invitation.upsert({
    where: { token: 'invite-demo-northstar' },
    update: {},
    create: {
      organizationId: secondOrg.id,
      email: 'newhire@northstar.io',
      role: UserRole.ANALYST,
      token: 'invite-demo-northstar',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  // ── Session for Alice ─────────────────────────────────────────────────────
  await prisma.session.upsert({
    where: { token: 'demo-session-token-alice' },
    update: {},
    create: {
      userId: alice.id,
      token: 'demo-session-token-alice',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  // ── Keywords ──────────────────────────────────────────────────────────────
  const keywordPhrases = [
    { phrase: 'AI automation agency', description: 'People looking to hire AI automation firms' },
    { phrase: 'n8n consultant', description: 'Requests for n8n workflow help' },
    { phrase: 'DevOps consultant', description: 'DevOps expertise requests' },
    { phrase: 'Kubernetes help', description: 'K8s implementation requests' },
    { phrase: 'recommend automation tool', description: 'Tool recommendation requests' },
    { phrase: 'looking for AI developer', description: 'Hiring signals for AI devs' },
    { phrase: 'implement Zapier alternative', description: 'Workflow tool buyers' },
    { phrase: 'NestJS developer', description: 'NestJS implementation requests' },
  ];

  const keywords = await Promise.all(
    keywordPhrases.map((k) =>
      prisma.keyword.create({ data: { organizationId: org.id, ...k } })
    )
  );

  // ── Sources ───────────────────────────────────────────────────────────────
  const redditSource = await prisma.source.create({
    data: {
      organizationId: org.id,
      name: 'r/entrepreneur',
      type: SourceType.REDDIT,
      status: SourceStatus.ACTIVE,
      config: { subreddit: 'entrepreneur', limit: 100 },
      lastFetchedAt: new Date(Date.now() - 1000 * 60 * 30),
    },
  });

  const redditSource2 = await prisma.source.create({
    data: {
      organizationId: org.id,
      name: 'r/devops',
      type: SourceType.REDDIT,
      status: SourceStatus.ACTIVE,
      config: { subreddit: 'devops', limit: 100 },
      lastFetchedAt: new Date(Date.now() - 1000 * 60 * 45),
    },
  });

  const rssSource = await prisma.source.create({
    data: {
      organizationId: org.id,
      name: 'Hacker News: Ask HN',
      type: SourceType.RSS,
      status: SourceStatus.ACTIVE,
      config: { url: 'https://hnrss.org/ask' },
      lastFetchedAt: new Date(Date.now() - 1000 * 60 * 15),
    },
  });

  // ── Signals ───────────────────────────────────────────────────────────────
  const signalData = [
    {
      sourceId: redditSource.id,
      externalId: 'reddit-abc123',
      sourceUrl: 'https://reddit.com/r/entrepreneur/comments/abc123',
      authorHandle: 'startup_founder_99',
      originalTitle: 'Looking for an AI automation agency to build our internal workflows',
      originalText: `We're a 50-person SaaS company and we're completely drowning in manual processes. 
        HR sends onboarding emails manually, our sales team copies data between CRMs by hand, 
        and our support team manually tags every ticket. We've looked at Zapier and Make but 
        they feel limiting for what we need. We want to work with a proper AI automation agency 
        that can build custom workflows using modern tools like n8n or custom Python scripts. 
        Budget is around $20-50k. Does anyone have recommendations?`,
      normalizedText: 'Company seeking AI automation agency for custom workflow development. Budget $20-50k. Currently using manual processes for HR, sales, and support operations.',
      category: SignalCategory.BUYING_INTENT,
      confidenceScore: 94,
      whyItMatters: 'High-value buyer with clear budget, specific pain points, and explicit ask for agency recommendations. Ready to purchase.',
      suggestedOutreach: 'Lead with specific workflow automation case studies. Mention n8n expertise and custom integration capabilities.',
      status: SignalStatus.SAVED,
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
    },
    {
      sourceId: redditSource2.id,
      externalId: 'reddit-def456',
      sourceUrl: 'https://reddit.com/r/devops/comments/def456',
      authorHandle: 'k8s_newbie_2024',
      originalTitle: 'Need a Kubernetes consultant to help migrate our monolith',
      originalText: `Our team is trying to migrate from a traditional VM-based deployment to Kubernetes 
        but we're stuck. We have a Rails monolith with about 15 services that need to be containerized. 
        We've been at it for 3 months and keep hitting issues with networking and persistent storage. 
        Looking for a senior K8s consultant who can do a 2-3 week engagement to help us set up the 
        cluster architecture and train our team. We're on AWS so EKS experience is important. 
        Anyone have consultants they'd recommend?`,
      normalizedText: 'Seeking senior Kubernetes/EKS consultant for 2-3 week engagement to help migrate Rails monolith. AWS/EKS experience required.',
      category: SignalCategory.BUYING_INTENT,
      confidenceScore: 91,
      whyItMatters: 'Clear timeline, specific technical requirements, and explicit consultant request. High conversion likelihood.',
      suggestedOutreach: 'Highlight EKS migration case studies. Propose a discovery call to assess their specific architecture challenges.',
      status: SignalStatus.NEW,
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    },
    {
      sourceId: rssSource.id,
      externalId: 'hn-ghi789',
      sourceUrl: 'https://news.ycombinator.com/item?id=ghi789',
      authorHandle: 'techfounder',
      originalTitle: 'Ask HN: Best AI workflow automation tools in 2025?',
      originalText: `We're evaluating options for automating our internal operations. Currently looking at 
        n8n, Activepieces, and Windmill. Has anyone done a serious comparison? We specifically need 
        good Python support and the ability to run locally for compliance reasons. Also open to 
        hearing from consultants/agencies who specialize in this space if you've solved this problem 
        for other companies.`,
      normalizedText: 'Evaluating AI workflow automation tools (n8n, Activepieces, Windmill). Seeking recommendations and open to consulting engagements.',
      category: SignalCategory.RECOMMENDATION_REQUEST,
      confidenceScore: 78,
      whyItMatters: 'Active evaluation phase with named tools. Explicitly open to consulting help. Strong buying signal.',
      suggestedOutreach: 'Provide a technical comparison guide as a lead magnet, then offer a free architecture review.',
      status: SignalStatus.BOOKMARKED,
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
    },
    {
      sourceId: redditSource.id,
      externalId: 'reddit-jkl012',
      sourceUrl: 'https://reddit.com/r/entrepreneur/comments/jkl012',
      authorHandle: 'scaling_ops',
      originalTitle: 'Our CI/CD pipeline is a nightmare - who do you use for DevOps consulting?',
      originalText: `Startup founder here. Our CI/CD setup is embarrassingly broken - builds take 45 minutes, 
        deployments fail constantly, and our dev team is losing morale. We need someone who can come in 
        and fix our GitHub Actions + Docker setup and ideally help us move toward a proper GitOps workflow. 
        Looking for individual consultants or small agencies. We've had bad experiences with large firms. 
        Budget is flexible for the right person.`,
      normalizedText: 'Startup seeking DevOps consultant to fix CI/CD pipeline. GitHub Actions + Docker + GitOps. Flexible budget.',
      category: SignalCategory.PAIN_COMPLAINT,
      confidenceScore: 85,
      whyItMatters: 'Active pain with urgency signals. Flexible budget and explicit consulting request. Reachable audience.',
      suggestedOutreach: 'Lead with CI/CD optimization wins and time-to-fix metrics. Offer a pipeline audit.',
      status: SignalStatus.NEW,
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    },
    {
      sourceId: redditSource2.id,
      externalId: 'reddit-mno345',
      sourceUrl: 'https://reddit.com/r/devops/comments/mno345',
      authorHandle: 'platform_eng',
      originalTitle: 'Hiring: Senior DevOps Engineer / Platform Engineer (remote, $160-200k)',
      originalText: `We're a Series B company building developer tooling. Looking for a senior platform 
        engineer to own our infrastructure. Must have experience with Kubernetes, Terraform, and ideally 
        ArgoCD. We're fully remote, pay well, and have a strong engineering culture. 
        Would also consider fractional/consulting arrangements while we find the right full-time hire.`,
      normalizedText: 'Series B company hiring senior DevOps/Platform Engineer. Also open to fractional/consulting arrangements.',
      category: SignalCategory.HIRING_SIGNAL,
      confidenceScore: 72,
      whyItMatters: 'Open to consulting while hiring. Series B budget available. Immediate infrastructure need.',
      suggestedOutreach: 'Offer fractional DevOps engagement while they search for FTE. Low friction entry point.',
      status: SignalStatus.NEW,
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
    },
    {
      sourceId: rssSource.id,
      externalId: 'hn-pqr678',
      sourceUrl: 'https://news.ycombinator.com/item?id=pqr678',
      authorHandle: 'yc_w24_cto',
      originalTitle: 'Ask HN: Anyone successfully outsourced their entire DevOps function?',
      originalText: `We're a 10-person YC startup and don't have the bandwidth to hire a dedicated 
        infrastructure person. We're looking at either a managed DevOps service or a retainer 
        with a consulting firm. Has anyone done this successfully? What was your budget and 
        what did you get? We're spending too much time on infrastructure and it's killing 
        our product velocity.`,
      normalizedText: 'YC startup seeking managed DevOps or retainer consulting arrangement. Pain: infrastructure consuming too much eng time.',
      category: SignalCategory.BUYING_INTENT,
      confidenceScore: 88,
      whyItMatters: 'YC-backed company with clear budget intent and urgent pain. Perfect agency client profile.',
      suggestedOutreach: 'Pitch a managed DevOps retainer. Reference other YC portfolio companies served.',
      status: SignalStatus.NEW,
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    },
    {
      sourceId: redditSource.id,
      externalId: 'reddit-stu901',
      sourceUrl: 'https://reddit.com/r/entrepreneur/comments/stu901',
      authorHandle: 'saas_ops_lead',
      originalTitle: 'Is the AI automation agency market getting saturated?',
      originalText: `I've been noticing a lot more AI automation agencies popping up over the past year. 
        Used to be you could differentiate just by knowing n8n or Make. Now everyone does that. 
        What are agencies doing to differentiate? Seems like the ones winning are either hyper-niche 
        (e.g., only serve real estate) or have proprietary frameworks. Curious what others are seeing.`,
      normalizedText: 'Market trend discussion about AI automation agency saturation and differentiation strategies.',
      category: SignalCategory.MARKET_TREND,
      confidenceScore: 45,
      whyItMatters: 'Useful market intelligence for positioning. Not a direct buying signal but relevant for strategy.',
      suggestedOutreach: null,
      status: SignalStatus.IGNORED,
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 36),
    },
    {
      sourceId: rssSource.id,
      externalId: 'hn-vwx234',
      sourceUrl: 'https://news.ycombinator.com/item?id=vwx234',
      authorHandle: 'data_infra',
      originalTitle: 'Ask HN: NestJS for enterprise APIs - your experience?',
      originalText: `We're choosing between NestJS and Fastify for a new microservices project. 
        The team has mixed opinions. We'd love to hear from people who've built large-scale 
        NestJS apps. Also interested if there are consultants who specialize in NestJS 
        architecture - we'd pay for a 2-hour architecture review session.`,
      normalizedText: 'Seeking NestJS architecture consultant for 2-hour paid review session. Choosing between NestJS and Fastify for microservices.',
      category: SignalCategory.RECOMMENDATION_REQUEST,
      confidenceScore: 69,
      whyItMatters: 'Explicit paid consulting request with defined scope. Easy win for NestJS-specialized consultants.',
      suggestedOutreach: 'Offer a paid 2-hour NestJS architecture review. Low commitment, high value for both sides.',
      status: SignalStatus.NEW,
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    },
  ];

  const signals = await Promise.all(
    signalData.map((s) =>
      prisma.signal.create({
        data: {
          organizationId: org.id,
          classifiedAt: new Date(),
          ...s,
        },
      })
    )
  );

  // ── Signal-Keyword relations ───────────────────────────────────────────────
  const k = keywords;
  const keywordMappings = [
    { sig: signals[0], kws: [k[0], k[1]] },
    { sig: signals[1], kws: [k[2], k[3]] },
    { sig: signals[2], kws: [k[0], k[4], k[6]] },
    { sig: signals[3], kws: [k[2]] },
    { sig: signals[4], kws: [k[2], k[3], k[5]] },
    { sig: signals[5], kws: [k[2]] },
    { sig: signals[6], kws: [k[0]] },
    { sig: signals[7], kws: [k[7]] },
  ];

  for (const { sig, kws } of keywordMappings) {
    for (const kw of kws) {
      await prisma.signalKeyword.upsert({
        where: { signalId_keywordId: { signalId: sig.id, keywordId: kw.id } },
        update: {},
        create: { signalId: sig.id, keywordId: kw.id },
      });
    }
  }

  // ── Annotations ───────────────────────────────────────────────────────────
  await prisma.signalAnnotation.create({
    data: {
      signalId: signals[0].id,
      userId: alice.id,
      note: 'Following up on Monday - Alice to send intro email with case studies',
    },
  });

  // ── Alert Rules ───────────────────────────────────────────────────────────
  await prisma.alertRule.create({
    data: {
      organizationId: org.id,
      name: 'High-Confidence Buying Intent',
      isActive: true,
      minConfidence: 85,
      categories: [SignalCategory.BUYING_INTENT],
      frequency: AlertFrequency.IMMEDIATE,
      emailRecipients: ['alice@acmegrowth.io', 'bob@acmegrowth.io'],
    },
  });

  await prisma.alertRule.create({
    data: {
      organizationId: org.id,
      name: 'Daily Digest - All Signals',
      isActive: true,
      minConfidence: 50,
      categories: [
        SignalCategory.BUYING_INTENT,
        SignalCategory.RECOMMENDATION_REQUEST,
        SignalCategory.HIRING_SIGNAL,
      ],
      frequency: AlertFrequency.DAILY,
      emailRecipients: ['alice@acmegrowth.io'],
    },
  });

  // ── Audit Logs ────────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { organizationId: org.id, userId: alice.id, action: AuditAction.LOGIN },
      { organizationId: org.id, userId: alice.id, action: AuditAction.SOURCE_CREATED, metadata: { sourceName: 'r/entrepreneur' } },
      { organizationId: org.id, userId: bob.id, action: AuditAction.ALERT_CREATED, metadata: { alertName: 'High-Confidence Buying Intent' } },
    ],
  });

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Email: alice@acmegrowth.io');
  console.log('  Password: demo1234!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
