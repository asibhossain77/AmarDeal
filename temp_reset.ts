// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDeal() {
  const deal = await prisma.deal.findFirst({ where: { title: 'Pay Now Test Deal' } });
  if (!deal) { console.log('Deal not found'); return; }
  await prisma.deal.update({
    where: { id: deal.id },
    data: {
      status: 'Pending_Verification',
      rejectionReason: null,
      senderNumber: null,
      transactionId: null,
      paymentAmount: null,
      paymentMethodId: null,
    },
  });
  console.log('Status:', deal.status);
  await prisma.$disconnect();
}

resetDeal().catch((e) => console.error(e));