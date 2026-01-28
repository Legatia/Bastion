// Script to create a test user for development

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating test user...\n');

  // Create test user
  const user = await prisma.user.create({
    data: {
      email: 'test@bastion.sh',
      password: 'hashed_password_demo', // In production, use bcrypt
      name: 'Test User',
      apiKey: `bst_demo_${randomUUID().replace(/-/g, '').substring(0, 16)}`,
      tier: 'PRO',
    },
  });

  console.log('✅ User created:');
  console.log('   Email:', user.email);
  console.log('   API Key:', user.apiKey);
  console.log('   Tier:', user.tier);

  // Create sample agent
  const agent = await prisma.agent.create({
    data: {
      userId: user.id,
      name: 'Demo Agent',
      description: 'Test agent for development',
      language: 'python',
      framework: 'langchain',
      status: 'ACTIVE',
    },
  });

  console.log('\n✅ Agent created:');
  console.log('   ID:', agent.id);
  console.log('   Name:', agent.name);

  // Create sample policies
  const policies = await Promise.all([
    prisma.policy.create({
      data: {
        userId: user.id,
        name: 'Daily Spending Limit',
        description: 'Block transactions over $500 per day',
        type: 'SPENDING_LIMIT',
        config: {
          max_amount: 500,
          window: '24h',
        },
        enabled: true,
        priority: 10,
      },
    }),
    prisma.policy.create({
      data: {
        userId: user.id,
        name: 'Rate Limiter',
        description: 'Max 100 requests per hour',
        type: 'RATE_LIMIT',
        config: {
          max_requests: 100,
          per: '1h',
        },
        enabled: true,
        priority: 5,
      },
    }),
    prisma.policy.create({
      data: {
        userId: user.id,
        name: 'File Protection',
        description: 'Protect system directories',
        type: 'FILE_PROTECTION',
        config: {
          protected_paths: ['/etc', '/sys', '/var'],
          allowed_paths: ['/tmp', '/home'],
        },
        enabled: true,
        priority: 8,
      },
    }),
  ]);

  console.log(`\n✅ Created ${policies.length} sample policies`);

  console.log('\n🎉 Setup complete!');
  console.log('\nTo use with CLI:');
  console.log(`   export BASTION_API_KEY="${user.apiKey}"`);
  console.log('   bastion start -- python your_agent.py');

  console.log('\nOr test with curl:');
  console.log(`   curl -X POST http://localhost:3000/v1/authorize \\
     -H "X-API-Key: ${user.apiKey}" \\
     -H "Content-Type: application/json" \\
     -d '{"action":{"type":"http_request","details":{"url":"https://api.stripe.com"}}}'`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
