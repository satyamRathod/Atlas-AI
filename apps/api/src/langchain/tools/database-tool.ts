import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import type { RegisteredTool } from './tool.types.js';

const NAME = 'order_lookup';
const DESCRIPTION =
  'Looks up Apex Retail customer orders by order ID, customer email, and/or status. ' +
  'Returns matching orders with item, amount, status, and dates — useful together with ' +
  'refund-policy questions to check whether a specific order is actually eligible.';

const ORDER_STATUSES = ['processing', 'shipped', 'delivered', 'refunded', 'cancelled'] as const;

const schema = z.object({
  orderId: z.string().trim().min(1).optional().describe('e.g. "ORD-1004".'),
  customerEmail: z.string().trim().min(1).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
});

type DatabaseArgs = z.infer<typeof schema>;

interface Order {
  orderId: string;
  customerEmail: string;
  item: string;
  category: 'apparel' | 'electronics' | 'final_sale';
  amount: number;
  currency: 'USD';
  status: (typeof ORDER_STATUSES)[number];
  orderDate: string;
  deliveryDate?: string;
}

/**
 * A small seeded in-memory dataset standing in for the roadmap's "Database
 * tool" — deliberately not a real SQL engine (the "PostgreSQL" stretch goal
 * stays separate). Paired with `knowledge/refund-policy.md`'s existing
 * Apex Retail return policy, so a question like "is order ORD-1004 still
 * eligible for a refund?" exercises RAG (policy text) and this tool (actual
 * order data) together (§2 of docs/phases/phase-5-tools.md).
 */
const ORDERS: readonly Order[] = [
  {
    orderId: 'ORD-1001',
    customerEmail: 'jane.doe@example.com',
    item: 'Wireless Headphones',
    category: 'electronics',
    amount: 129.99,
    currency: 'USD',
    status: 'delivered',
    orderDate: '2026-07-02',
    deliveryDate: '2026-07-06',
  },
  {
    orderId: 'ORD-1002',
    customerEmail: 'jane.doe@example.com',
    item: 'Running Shoes (Size 9)',
    category: 'apparel',
    amount: 89.5,
    currency: 'USD',
    status: 'shipped',
    orderDate: '2026-07-28',
  },
  {
    orderId: 'ORD-1003',
    customerEmail: 'mike.chen@example.com',
    item: '$50 Gift Card',
    category: 'final_sale',
    amount: 50.0,
    currency: 'USD',
    status: 'delivered',
    orderDate: '2026-06-15',
    deliveryDate: '2026-06-15',
  },
  {
    orderId: 'ORD-1004',
    customerEmail: 'mike.chen@example.com',
    item: 'Winter Jacket',
    category: 'apparel',
    amount: 214.0,
    currency: 'USD',
    status: 'delivered',
    orderDate: '2026-07-20',
    deliveryDate: '2026-07-24',
  },
  {
    orderId: 'ORD-1005',
    customerEmail: 'priya.nair@example.com',
    item: 'Laptop Stand',
    category: 'electronics',
    amount: 45.0,
    currency: 'USD',
    status: 'processing',
    orderDate: '2026-08-10',
  },
  {
    orderId: 'ORD-1006',
    customerEmail: 'priya.nair@example.com',
    item: 'Bluetooth Speaker',
    category: 'electronics',
    amount: 76.25,
    currency: 'USD',
    status: 'refunded',
    orderDate: '2026-06-30',
    deliveryDate: '2026-07-03',
  },
  {
    orderId: 'ORD-1007',
    customerEmail: 'sam.oconnor@example.com',
    item: 'Denim Jacket',
    category: 'apparel',
    amount: 98.0,
    currency: 'USD',
    status: 'cancelled',
    orderDate: '2026-08-01',
  },
  {
    orderId: 'ORD-1008',
    customerEmail: 'sam.oconnor@example.com',
    item: '4K Monitor',
    category: 'electronics',
    amount: 329.99,
    currency: 'USD',
    status: 'delivered',
    orderDate: '2026-07-10',
    deliveryDate: '2026-07-15',
  },
  {
    orderId: 'ORD-1009',
    customerEmail: 'lucia.fernandez@example.com',
    item: 'Yoga Mat',
    category: 'apparel',
    amount: 32.0,
    currency: 'USD',
    status: 'delivered',
    orderDate: '2026-05-20',
    deliveryDate: '2026-05-24',
  },
  {
    orderId: 'ORD-1010',
    customerEmail: 'lucia.fernandez@example.com',
    item: 'Noise-Cancelling Earbuds',
    category: 'electronics',
    amount: 159.0,
    currency: 'USD',
    status: 'shipped',
    orderDate: '2026-08-05',
  },
  {
    orderId: 'ORD-1011',
    customerEmail: 'omar.ibrahim@example.com',
    item: 'Software License Key',
    category: 'final_sale',
    amount: 19.99,
    currency: 'USD',
    status: 'delivered',
    orderDate: '2026-06-01',
    deliveryDate: '2026-06-01',
  },
  {
    orderId: 'ORD-1012',
    customerEmail: 'omar.ibrahim@example.com',
    item: 'Hiking Backpack',
    category: 'apparel',
    amount: 74.5,
    currency: 'USD',
    status: 'processing',
    orderDate: '2026-08-11',
  },
];

async function execute(args: DatabaseArgs): Promise<{ count: number; orders: Order[] }> {
  if (!args.orderId && !args.customerEmail && !args.status) {
    throw new Error('Provide at least one of orderId, customerEmail, or status.');
  }

  const matches = ORDERS.filter(
    (order) =>
      (!args.orderId || order.orderId.toLowerCase() === args.orderId.toLowerCase()) &&
      (!args.customerEmail ||
        order.customerEmail.toLowerCase() === args.customerEmail.toLowerCase()) &&
      (!args.status || order.status === args.status),
  );

  return { count: matches.length, orders: matches };
}

export function createDatabaseTool(): RegisteredTool {
  return {
    name: NAME,
    description: DESCRIPTION,
    schema,
    execute,
    structuredTool: tool(execute, { name: NAME, description: DESCRIPTION, schema }),
  } as unknown as RegisteredTool;
}
