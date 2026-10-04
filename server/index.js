import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import helmet from 'helmet';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import Mailgun from 'mailgun.js';
import formData from 'form-data';
import { createClient } from '@supabase/supabase-js';

import { categoriesSeed, productsSeed, testimonials } from './data.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  : null;

export const catalog = [...productsSeed];
export const orders = [];
export const inquiries = [];
export const newsletterSignup = [];

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

const parseNumber = (value) => Number(value ?? 0);
const moneyFormat = (value) => new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
}).format(value);

const productLookup = new Map(catalog.map((product) => [product.id, product]));

function normalizeProduct(product) {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const image = product.image || product.cover_image || images[0] || null;
  const categories = Array.isArray(product.categories) ? product.categories[0] : product.categories;
  const gallery = Array.isArray(product.gallery) && product.gallery.length
    ? product.gallery.filter(Boolean)
    : images.length
      ? images
      : image
        ? [image]
        : [];

  return {
    ...product,
    image,
    gallery,
    category: product.category ?? categories?.name ?? null,
    categoryId: product.categoryId ?? product.category_id ?? null,
    stock: product.stock ?? product.stock_quantity ?? 0,
    notes: product.notes ?? product.fragrance_notes ?? [],
    priceIsTemporary: product.priceIsTemporary ?? product.tags?.includes('temporary-price') ?? false,
    stockIsTemporary: product.stockIsTemporary ?? product.tags?.includes('temporary-stock') ?? false,
    createdAt: product.createdAt ?? product.created_at,
  };
}

async function fetchProductsFromDb() {
  if (!supabase) {
    return catalog.map(normalizeProduct);
  }

  const { data, error } = await supabase.from('products').select('*, categories(name, slug)').eq('active', true);
  if (error || !data) {
    return catalog.map(normalizeProduct);
  }

  return data.map(normalizeProduct);
}

async function fetchCategoriesFromDb() {
  if (!supabase) {
    return [...categoriesSeed];
  }

  const { data, error } = await supabase.from('categories').select('*');
  if (error || !data) {
    return [...categoriesSeed];
  }

  return data;
}

function compareProducts(a, b) {
  if (a.featured && !b.featured) return -1;
  if (!a.featured && b.featured) return 1;
  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

function buildSearchResults(products, query, category, brand, minPrice, maxPrice, sort) {
  const filtered = products.filter((product) => {
    const matchesQuery = !query || `${product.name} ${product.brand}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = !category || product.category === category || product.categoryId === category;
    const matchesBrand = !brand || product.brand === brand;
    const matchesMin = !minPrice || product.price >= Number(minPrice);
    const matchesMax = !maxPrice || product.price <= Number(maxPrice);
    return matchesQuery && matchesCategory && matchesBrand && matchesMin && matchesMax;
  });

  const sorter = {
    newest: (list) => [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    priceAsc: (list) => [...list].sort((a, b) => a.price - b.price),
    priceDesc: (list) => [...list].sort((a, b) => b.price - a.price),
    popularity: (list) => [...list].sort(compareProducts),
  };

  return (sorter[sort] || sorter.popularity)(filtered);
}

function findProductById(id) {
  const product = productLookup.get(id) || catalog.find((item) => item.id === id || item.slug === id);
  return product || null;
}

async function sendMailgunEmail({ to, subject, text }) {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    console.log(`[MAILGUN] Skipped email: ${subject} -> ${to}`);
    return { status: 'skipped', message: 'Mailgun is not configured.' };
  }

  const mailgun = new Mailgun(formData);
  const client = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY });

  await client.messages.create(process.env.MAILGUN_DOMAIN, {
    from: process.env.MAILGUN_FROM || 'Noir Scents <hello@mg.yourdomain.com>',
    to,
    subject,
    text,
  });

  return { status: 'sent' };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'Noir Scents API', uptime: process.uptime() });
});

app.get('/api/categories', async (_req, res) => {
  const categories = await fetchCategoriesFromDb();
  res.json(categories);
});

app.get('/api/products', async (req, res) => {
  const { q, category, brand, minPrice, maxPrice, sort = 'popularity' } = req.query;
  const products = await fetchProductsFromDb();
  const results = buildSearchResults(products, q || '', category || '', brand || '', minPrice || '', maxPrice || '', sort);
  res.json(results);
});

app.get('/api/products/:id', async (req, res) => {
  const products = await fetchProductsFromDb();
  const product = products.find((item) => item.id === req.params.id || item.slug === req.params.id)
    || findProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  const related = products.filter((item) => item.id !== product.id && item.category === product.category).slice(0, 4);
  return res.json({ ...product, related });
});

app.get('/api/testimonials', (_req, res) => {
  res.json(testimonials);
});

app.post('/api/newsletter', [body('email').isEmail().withMessage('Please provide a valid email address.')], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const email = req.body.email.trim().toLowerCase();
  if (!newsletterSignup.some((item) => item.email === email)) {
    newsletterSignup.push({ id: uuidv4(), email, createdAt: new Date().toISOString() });
  }

  return res.status(201).json({ message: 'You are now subscribed to our newsletter.' });
});

app.post('/api/contact', [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('email').isEmail().withMessage('A valid email is required.'),
  body('message').trim().isLength({ min: 10 }).withMessage('Your message must be at least 10 characters.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const inquiry = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString(),
  };
  inquiries.push(inquiry);

  try {
    await sendMailgunEmail({
      to: 'hello@noirscents.com',
      subject: `New customer inquiry from ${inquiry.name}`,
      text: `${inquiry.name} (${inquiry.email}) sent:\n\n${inquiry.message}`,
    });
  } catch (error) {
    console.error('Inquiry email failed', error);
  }

  return res.status(201).json({ message: 'Your message has been sent. Our team will reply soon.' });
});

app.get('/api/admin/stats', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ message: 'Supabase is not configured.' });
  }

  const authorization = req.get('authorization') || '';
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return res.status(401).json({ message: 'Sign in is required.' });
  }

  const authenticatedClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: authData, error: authError } = await authenticatedClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return res.status(401).json({ message: 'Your sign-in session is invalid or expired.' });
  }

  const { data: profile, error: profileError } = await authenticatedClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error('Admin profile could not be verified', profileError);
    return res.status(500).json({ message: 'Could not verify admin access.' });
  }
  if (profile?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }

  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const averageOrder = orders.length ? totalRevenue / orders.length : 0;

  return res.json({
    totalOrders: orders.length,
    totalRevenue,
    averageOrder,
    lowStockItems: catalog.filter((product) => product.stock < 10).length,
  });
});

app.post('/api/checkout', [
  body('customer.name').trim().notEmpty().withMessage('Customer name is required.'),
  body('customer.email').isEmail().withMessage('Customer email is required.'),
  body('customer.phone').trim().notEmpty().withMessage('Customer phone is required.'),
  body('customer.address').trim().notEmpty().withMessage('Delivery address is required.'),
  body('customer.state').trim().notEmpty().withMessage('State is required.'),
  body('customer.city').trim().notEmpty().withMessage('City is required.'),
  body('items').isArray({ min: 1 }).withMessage('Your cart must contain at least one item.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { items, customer } = req.body;
  const orderItems = [];
  let subtotal = 0;

  const availableProducts = await fetchProductsFromDb();
  for (const item of items) {
    const product = availableProducts.find((entry) => entry.id === item.id || entry.slug === item.id)
      || findProductById(item.id);
    if (!product) {
      return res.status(404).json({ message: `Product ${item.id} is no longer available.` });
    }

    if (item.quantity > product.stock) {
      return res.status(400).json({ message: `${product.name} is limited to ${product.stock} units in stock.` });
    }

    const unitPrice = product.price;
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;

    orderItems.push({
      id: uuidv4(),
      productId: product.id,
      name: product.name,
      image: product.image,
      quantity: item.quantity,
      unitPrice,
    });

    product.stock = Math.max(0, product.stock - item.quantity);
  }

  const shippingFee = subtotal > 225000 ? 0 : 15000;
  const total = subtotal + shippingFee;

  const order = {
    id: uuidv4(),
    orderReference: `NS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      state: customer.state,
      city: customer.city,
    },
    items: orderItems,
    subtotal,
    shippingFee,
    total,
    paymentStatus: 'pending',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  orders.push(order);

  try {
    await sendMailgunEmail({
      to: customer.email,
      subject: `Order confirmation: ${order.orderReference}`,
      text: `Hello ${customer.name},\n\nYour order ${order.orderReference} has been received. The total is ${moneyFormat(total)}. ` +
        `We will contact you once your order is dispatched.`,
    });
  } catch (error) {
    console.error('Order email send failed', error);
  }

  return res.status(201).json({
    message: 'Order placed successfully.',
    order,
  });
});

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

app.listen(port, () => {
  console.log(`Noir Scents API listening on http://localhost:${port}`);
});
