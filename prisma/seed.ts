import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Sokrates database seeding...');

  // 1. Seed 10 Interest Categories
  const categoriesData = [
    { name: 'Philosophy & Logic', slug: 'philosophy', icon: '🧠' },
    { name: 'Ethics & Morality', slug: 'ethics', icon: '⚖️' },
    { name: 'Epistemology & Knowledge', slug: 'epistemology', icon: '🔍' },
    { name: 'Metaphysics & Existence', slug: 'metaphysics', icon: '🌌' },
    { name: 'Political Philosophy', slug: 'political-theory', icon: '🏛️' },
    { name: 'AI & Consciousness', slug: 'ai-ethics', icon: '🤖' },
    { name: 'Aesthetics & Art', slug: 'aesthetics', icon: '🎨' },
    { name: 'Bioethics & Genetics', slug: 'bioethics', icon: '🧬' },
    { name: 'Philosophy of Mind', slug: 'philosophy-of-mind', icon: '💭' },
    { name: 'Existentialism & Meaning', slug: 'existentialism', icon: '🔥' },
  ];

  const categoryMap: Record<string, string> = {};

  for (const cat of categoriesData) {
    const created = await prisma.interestCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon },
      create: cat,
    });
    categoryMap[cat.slug] = created.id;
    console.log(`  Created/Updated category: ${cat.name} (${cat.slug})`);
  }

  // 2. Seed 20 System Topics
  const topicsData = [
    {
      title: 'The Ship of Theseus and Personal Identity',
      description: 'If every part of a ship is replaced over time, is it still the same ship? How does this apply to human identity as our cells regenerate?',
      categorySlug: 'metaphysics',
    },
    {
      title: 'Is Utilitarianism Morally Bankrupt?',
      description: 'Does calculating the greatest good for the greatest number justify sacrificing minority rights or fundamental individual dignity?',
      categorySlug: 'ethics',
    },
    {
      title: 'Can Artificial Intelligence Ever Possess True Consciousness?',
      description: 'Is machine consciousness possible through neural networks, or are machines merely executing syntax without genuine semantic understanding?',
      categorySlug: 'ai-ethics',
    },
    {
      title: 'The Epistemology of Deep Fakes and Truth in the Digital Age',
      description: 'When perception can be perfectly falsified through AI generation, what foundation remains for empirical knowledge and truth?',
      categorySlug: 'epistemology',
    },
    {
      title: 'Free Will vs. Hard Determinism',
      description: 'If physical law governs every atom in our brains, is human free will an illusion? Are we morally responsible for our choices?',
      categorySlug: 'philosophy-of-mind',
    },
    {
      title: 'The Problem of Evil: Reconciling Suffering with Benevolence',
      description: 'How can an all-powerful, all-knowing, and perfectly good entity permit innocent suffering in the universe?',
      categorySlug: 'philosophy',
    },
    {
      title: 'Social Contract Theory vs. Anarchism',
      description: 'Is political authority inherently legitimate through tacit consent, or is the state an unsanctioned monopoly on violence?',
      categorySlug: 'political-theory',
    },
    {
      title: 'Genetic Editing and Human Augmentation',
      description: 'CRISPR allows us to alter human embryos. Where is the line between therapeutic curing and unethical germline engineering?',
      categorySlug: 'bioethics',
    },
    {
      title: 'Objective Beauty vs. Subjective Preference in Art',
      description: 'Does aesthetic value reside in intrinsic formal properties of an artwork, or is beauty entirely in the eye of the beholder?',
      categorySlug: 'aesthetics',
    },
    {
      title: 'The Simulation Hypothesis: Are We Living in a Virtual World?',
      description: 'If computing power grows exponentially, is it statistically more likely that we are simulated ancestral beings than physical humans?',
      categorySlug: 'metaphysics',
    },
    {
      title: 'Absurdism and Camus: Finding Meaning in a Meaningless Universe',
      description: 'In the face of an indifferent cosmos, should we surrender to despair, construct artificial meaning, or rebelliously embrace the absurdity?',
      categorySlug: 'existentialism',
    },
    {
      title: 'The Trolley Problem in Autonomous Vehicle Ethics',
      description: 'How should self-driving vehicle algorithms weigh driver safety against pedestrian protection in unavoidable crash scenarios?',
      categorySlug: 'ethics',
    },
    {
      title: 'Solipsism and the Limits of Skepticism',
      description: 'Can you prove with 100% certainty that minds other than your own exist? Where does radical skepticism leave practical life?',
      categorySlug: 'epistemology',
    },
    {
      title: 'Corporate Personhood and Moral Agency',
      description: 'Do corporations possess moral responsibilities independent of their executive leaders and shareholders?',
      categorySlug: 'political-theory',
    },
    {
      title: 'The Hard Problem of Consciousness: Qualia and Physicalism',
      description: 'Why should physical brain processing give rise to subjective subjective experiences like the redness of a rose?',
      categorySlug: 'philosophy-of-mind',
    },
    {
      title: 'Algorithmic Bias and Social Justice',
      description: 'When machine learning models reproduce systemic human biases, who holds accountability — the engineers, data, or the algorithm?',
      categorySlug: 'ai-ethics',
    },
    {
      title: 'The Ethics of Radical Life Extension and Immortality',
      description: 'If biogerontology cures aging, will overpopulation and generational stagnation outweigh the individual benefit of immortality?',
      categorySlug: 'bioethics',
    },
    {
      title: 'Do We Have a Moral Obligation to Future Generations?',
      description: 'How should present societies value the rights and resource access of individuals who have not yet been born?',
      categorySlug: 'ethics',
    },
    {
      title: 'Posthumanism: What Comes After Homo Sapiens?',
      description: 'Will biological integration with technology produce a new evolutionary step, and will post-humans retain human values?',
      categorySlug: 'philosophy',
    },
    {
      title: 'Nihilism vs. Existential Courage in Modern Society',
      description: 'As traditional grand narratives lose authority, how can individuals cultivate existential courage without falling into nihilistic cynicism?',
      categorySlug: 'existentialism',
    },
  ];

  for (const topic of topicsData) {
    const categoryId = categoryMap[topic.categorySlug];
    if (!categoryId) {
      console.warn(`Category slug missing: ${topic.categorySlug}`);
      continue;
    }

    const existing = await prisma.systemTopic.findFirst({
      where: { title: topic.title },
    });

    if (!existing) {
      await prisma.systemTopic.create({
        data: {
          title: topic.title,
          description: topic.description,
          categoryId: categoryId,
        },
      });
      console.log(`  Created topic: "${topic.title}"`);
    } else {
      console.log(`  Topic exists: "${topic.title}"`);
    }
  }

  console.log('✅ Sokrates database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
