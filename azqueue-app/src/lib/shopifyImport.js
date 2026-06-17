/**
 * shopifyImport.js — One-time / repeatable data import from Shopify into AzQueue.
 *
 * This is NOT a new integration — it reuses the Shopify connection the
 * branch owner already set up himself in Settings → Integrations → Shopify
 * (his own shop domain + Admin API access token, stored in
 * channel_connections). This module never sees or asks for credentials;
 * it just reads the saved connection and pulls data through it. Runs
 * entirely in the browser — a Custom App token is safe to use directly
 * from the owner's own session (gated by Supabase RLS, same as Freshdesk).
 *
 * What gets imported, and where it lands:
 *   - Shopify customers → AzQueue customers        (matched/merged by email or phone)
 *   - Shopify orders    → AzQueue customer_events   (channel: 'shopify')
 *   - Shopify products  → shopify_products           (catalog/inventory snapshot)
 *
 * Safe to re-run: customers deduped by shopify_id/email/phone (existing
 * identity resolution in customers.js), events deduped by Shopify order ID
 * via the unique (branch_id, channel, external_id) index, products
 * upserted by shopify_product_id.
 *
 * Lives in its own file (not shopify.js or customers.js), same reasoning
 * as freshdeskImport.js — keeps the orchestration separate from the raw
 * API client and avoids pulling import-only logic into customers.js.
 */

import { supabase } from "./supabase";
import { getShopifyConfig, listShopifyCustomers, listShopifyOrders, listShopifyProducts } from "./shopify";
import { findOrCreateCustomer, logEvent } from "./customers";

function shopifyCustomerName(c) {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || c.email || `Shopify customer ${c.id}`;
}

/** Import a single Shopify customer object as an AzQueue customer. */
async function importShopifyCustomer(branchId, c) {
  await findOrCreateCustomer(branchId, {
    name:      shopifyCustomerName(c),
    email:     c.email ?? null,
    phone:     c.phone ?? c.default_address?.phone ?? null,
    shopifyId: String(c.id),
  });
}

/** Decide the AzQueue event_type for a Shopify order's current state. */
function orderEventType(order) {
  if (order.cancelled_at) return "order_cancelled";
  if (order.fulfillment_status === "fulfilled") return "order_fulfilled";
  return "order_placed";
}

/** Import a single Shopify order as a customer_events row. */
async function importShopifyOrder(branchId, order) {
  const oc = order.customer;
  const customer = await findOrCreateCustomer(branchId, {
    name:      oc ? shopifyCustomerName(oc) : (order.email ?? "Shopify guest"),
    email:     order.email ?? oc?.email ?? null,
    phone:     order.phone ?? oc?.phone ?? null,
    shopifyId: oc ? String(oc.id) : null,
  });

  const total = order.total_price ?? order.current_total_price ?? "0";
  const currency = order.currency ?? "";

  await logEvent(customer.id, branchId, {
    channel:    "shopify",
    eventType:  orderEventType(order),
    content:    `Order ${order.name ?? "#" + order.order_number} — ${total} ${currency} (${order.financial_status ?? "unknown"})`,
    externalId: String(order.id),
    metadata: {
      financial_status: order.financial_status,
      fulfillment_status: order.fulfillment_status,
      total_price: total,
      currency,
      line_items: (order.line_items ?? []).map((li) => ({ title: li.title, quantity: li.quantity })),
    },
  });

  return customer;
}

/**
 * Upsert a single Shopify product into the shopify_products snapshot table.
 * Stock is summed across all variants — Shopify's true per-location inventory
 * tracking needs the separate Inventory API, which is out of scope here;
 * this is a "total units across all variants" approximation, good enough
 * for a catalog overview.
 */
async function importShopifyProduct(branchId, product) {
  const variants = product.variants ?? [];
  const firstVariant = variants[0] ?? {};
  const stockQty = variants.reduce((sum, v) => sum + (Number(v.inventory_quantity) || 0), 0);

  const { error } = await supabase.from("shopify_products").upsert(
    {
      branch_id:          branchId,
      shopify_product_id: String(product.id),
      name:               product.title ?? null,
      sku:                firstVariant.sku ?? null,
      price:               firstVariant.price ? Number(firstVariant.price) : null,
      stock_qty:           variants.length ? stockQty : null,
      raw:                 product,
      synced_at:           new Date().toISOString(),
    },
    { onConflict: "branch_id,shopify_product_id" }
  );
  if (error) throw error;
}

/**
 * Run a full import: customers → customers, orders → events, products → catalog.
 *
 * @param {string} branchId
 * @param {{ onProgress?: (info: {stage: string, done: number, total?: number}) => void }} opts
 * @returns {Promise<{ customersImported: number, ordersLogged: number, productsSynced: number, errors: string[] }>}
 */
export async function syncShopifyData(branchId, { onProgress } = {}) {
  const config = await getShopifyConfig(branchId);
  if (!config) {
    throw new Error("Shopify isn't connected for this branch yet — connect it above first.");
  }

  const result = {
    customersImported: 0,
    ordersLogged: 0,
    productsSynced: 0,
    errors: [],
  };

  // 1. Customers
  let customers = [];
  try {
    customers = await listShopifyCustomers(config.accessToken, config.shopDomain);
  } catch (e) {
    result.errors.push(`Couldn't list customers: ${e.message}`);
  }
  for (let i = 0; i < customers.length; i++) {
    try {
      await importShopifyCustomer(branchId, customers[i]);
      result.customersImported++;
    } catch (e) {
      result.errors.push(`Customer "${customers[i]?.email ?? customers[i]?.id}": ${e.message}`);
    }
    onProgress?.({ stage: "customers", done: i + 1, total: customers.length });
  }

  // 2. Orders → events (also catches/creates customers behind guest orders)
  let orders = [];
  try {
    orders = await listShopifyOrders(config.accessToken, config.shopDomain);
  } catch (e) {
    result.errors.push(`Couldn't list orders: ${e.message}`);
  }
  for (let i = 0; i < orders.length; i++) {
    try {
      await importShopifyOrder(branchId, orders[i]);
      result.ordersLogged++;
    } catch (e) {
      result.errors.push(`Order "${orders[i]?.name ?? orders[i]?.id}": ${e.message}`);
    }
    onProgress?.({ stage: "orders", done: i + 1, total: orders.length });
  }

  // 3. Products → catalog snapshot
  let products = [];
  try {
    products = await listShopifyProducts(config.accessToken, config.shopDomain);
  } catch (e) {
    result.errors.push(`Couldn't list products: ${e.message}`);
  }
  for (let i = 0; i < products.length; i++) {
    try {
      await importShopifyProduct(branchId, products[i]);
      result.productsSynced++;
    } catch (e) {
      result.errors.push(`Product "${products[i]?.title ?? products[i]?.id}": ${e.message}`);
    }
    onProgress?.({ stage: "products", done: i + 1, total: products.length });
  }

  return result;
}
