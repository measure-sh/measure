import type { DeviceSpec } from "./scenario";
import { PEOPLE, addressLine, fullName } from "./people";

export type UiStyle = "android" | "ios" | "flutter" | "rn_android" | "rn_ios";

const SCREEN_KEYS = [
  "login",
  "home",
  "products",
  "search",
  "product_detail",
  "cart",
  "checkout",
  "payment",
  "order_confirmation",
  "profile",
  "orders",
] as const;

export type ScreenKey = (typeof SCREEN_KEYS)[number];

export function isScreenKey(value: string): value is ScreenKey {
  return (SCREEN_KEYS as readonly string[]).includes(value);
}

export type ScreenState = string;

export type Viewport = {
  style: UiStyle;
  width: number;
  height: number;
  unitScale: number;
};

export type SnapshotNode = {
  id?: string | null;
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scrollable: boolean;
  highlighted: boolean;
  children: SnapshotNode[];
};

export type GestureBox = {
  target: string;
  targetId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Role =
  | "root"
  | "bar"
  | "title"
  | "icon"
  | "text"
  | "muted"
  | "button"
  | "textbutton"
  | "card"
  | "image"
  | "input"
  | "list"
  | "scroll"
  | "chip"
  | "tabbar"
  | "tab"
  | "radio"
  | "switch"
  | "divider"
  | "group"
  | "row"
  | "avatar"
  | "check"
  | "dots";

type N = {
  id?: string;
  role: Role;
  text?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  scrollable?: boolean;
  selected?: boolean;
  center?: boolean;
  hue?: number;
  glyph?: Glyph;
  kids?: N[];
};

type Glyph = "shoe" | "audio" | "apparel" | "bag" | "bottle" | "watch";

export const PRODUCTS: {
  name: string;
  slug: string;
  number: number;
  price: string;
  category: string;
  tags: string[];
  glyph: Glyph;
  hue: number;
  rating: string;
  sizes: string[];
}[] = [
  {
    name: "Trail Runner GTX",
    slug: "trail-runner-gtx",
    number: 1042,
    tags: ["running", "hiking", "trail"],
    price: "$129.00",
    category: "Shoes",
    glyph: "shoe",
    hue: 152,
    rating: "4.6 (312)",
    sizes: ["7", "8", "9", "10", "11"],
  },
  {
    name: "Wireless Earbuds",
    slug: "wireless-earbuds",
    number: 1057,
    tags: ["running", "audio", "music"],
    price: "$79.99",
    category: "Audio",
    glyph: "audio",
    hue: 212,
    rating: "4.4 (1,208)",
    sizes: ["Black", "White", "Sand", "Blue"],
  },
  {
    name: "Bluetooth Speaker",
    slug: "bluetooth-speaker",
    number: 1063,
    tags: ["audio", "music"],
    price: "$59.00",
    category: "Audio",
    glyph: "audio",
    hue: 26,
    rating: "4.3 (587)",
    sizes: ["Charcoal", "Blue", "Sand", "Red"],
  },
  {
    name: "Runner Sneakers",
    slug: "runner-sneakers",
    number: 1071,
    tags: ["running"],
    price: "$89.00",
    category: "Shoes",
    glyph: "shoe",
    hue: 348,
    rating: "4.5 (940)",
    sizes: ["7", "8", "9", "10", "11"],
  },
  {
    name: "Field Jacket",
    slug: "field-jacket",
    number: 1088,
    tags: ["hiking", "jacket"],
    price: "$149.00",
    category: "Apparel",
    glyph: "apparel",
    hue: 92,
    rating: "4.7 (203)",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    name: "Canvas Tote",
    slug: "canvas-tote",
    number: 1094,
    tags: ["bag", "tote"],
    price: "$39.00",
    category: "Bags",
    glyph: "bag",
    hue: 42,
    rating: "4.2 (411)",
    sizes: ["Natural", "Navy", "Olive", "Black"],
  },
  {
    name: "Steel Bottle 750 ml",
    slug: "steel-bottle-750",
    number: 1102,
    tags: ["running", "hiking", "trail"],
    price: "$24.00",
    category: "Outdoor",
    glyph: "bottle",
    hue: 198,
    rating: "4.8 (2,034)",
    sizes: ["500 ml", "750 ml", "1 L", "1.5 L"],
  },
  {
    name: "Smart Watch S2",
    slug: "smart-watch-s2",
    number: 1119,
    tags: ["running", "fitness"],
    price: "$199.00",
    category: "Watches",
    glyph: "watch",
    hue: 268,
    rating: "4.1 (356)",
    sizes: ["40 mm", "44 mm", "40 mm LTE", "44 mm LTE"],
  },
  {
    name: "Merino Crew Socks",
    slug: "merino-crew-socks",
    number: 1125,
    tags: ["running", "hiking"],
    price: "$28.00",
    category: "Apparel",
    glyph: "apparel",
    hue: 12,
    rating: "4.6 (778)",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    name: "Daypack 20L",
    slug: "daypack-20l",
    number: 1136,
    tags: ["hiking", "bag", "trail"],
    price: "$74.00",
    category: "Bags",
    glyph: "bag",
    hue: 122,
    rating: "4.5 (264)",
    sizes: ["18 L", "20 L", "24 L", "28 L"],
  },
];

export const CATEGORIES = [
  "All",
  "Shoes",
  "Audio",
  "Apparel",
  "Bags",
  "Outdoor",
];

const RELATED_OFFSETS = [3, 5];
export const PRICE_CENTS = [
  12900, 7999, 5900, 8900, 14900, 3900, 2400, 19900, 2800, 7400,
];
const SAVED_ITEMS = [5, 7];
const PAST_ORDERS: {
  number: string;
  daysAgo: number;
  product: number;
  status: string;
}[] = [
  { number: "47902", daysAgo: 3, product: 2, status: "Out for delivery" },
  { number: "47455", daysAgo: 12, product: 4, status: "Delivered" },
  { number: "46881", daysAgo: 26, product: 8, status: "Delivered" },
  { number: "46120", daysAgo: 41, product: 7, status: "Returned" },
];

export const COUPONS: Record<string, number> = { WELCOME10: 10, SPRING20: 20 };

export type CartLine = { product: number; option: number; qty: number };

export type PaymentMethod = "card" | "wallet" | "paypal";

export type ShopData = {
  cart: CartLine[];
  coupon: string | null;
  couponInput: string;
  express: boolean;
  address: number;
  method: PaymentMethod;
  query: string;
  results: string;
  order: string | null;
  date: string | null;
  user: number;
};

export const EMPTY_SHOP: ShopData = {
  cart: [],
  coupon: null,
  couponInput: "",
  express: false,
  address: 0,
  method: "card",
  query: "",
  results: "",
  order: null,
  date: null,
  user: 0,
};

export function searchResults(query: string): number[] {
  const q = query.trim().toLowerCase();
  if (q === "") {
    return [];
  }
  return PRODUCTS.flatMap((p, i) =>
    p.name.toLowerCase().includes(q) || p.tags.includes(q) ? [i] : [],
  );
}

export type Totals = {
  count: number;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
};

export function orderTotals(
  lines: CartLine[],
  coupon: string | null,
  express: boolean,
): Totals {
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const subtotal = lines.reduce(
    (sum, line) => sum + line.qty * PRICE_CENTS[line.product],
    0,
  );
  const discount = Math.round(
    (subtotal * (coupon ? (COUPONS[coupon] ?? 0) : 0)) / 100,
  );
  const shipping = express
    ? 900
    : subtotal - discount >= 5000 || count === 0
      ? 0
      : 500;
  const tax = Math.round((subtotal - discount) * 0.08);
  return {
    count,
    subtotal,
    discount,
    shipping,
    tax,
    total: subtotal - discount + shipping + tax,
  };
}

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function dayOf(date: string, plusDays: number): Date {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + plusDays);
  return d;
}

function shortDate(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function longDate(d: Date): string {
  return `${WEEKDAYS[d.getUTCDay()]}, ${shortDate(d)}`;
}

function businessDaysAfter(date: string, days: number): Date {
  let d = dayOf(date, 0);
  let left = days;
  while (left > 0) {
    d = new Date(d.getTime() + 86_400_000);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) {
      left -= 1;
    }
  }
  return d;
}

export function deliveryDate(
  date: string,
  express: boolean,
  shiftDays = 0,
): string {
  const day = businessDaysAfter(date, express ? 1 : 4);
  return longDate(new Date(day.getTime() + shiftDays * 86_400_000));
}

export function viewportFor(style: UiStyle, device: DeviceSpec): Viewport {
  const pointBased = style === "ios" || style === "rn_ios";
  const density = device.device_density || 1;
  return {
    style,
    width: pointBased
      ? Math.round(device.device_width_px / density)
      : device.device_width_px,
    height: pointBased
      ? Math.round(device.device_height_px / density)
      : device.device_height_px,
    unitScale: pointBased ? 1 : density,
  };
}

// Scaling by the density would leave a 1080 px wide device one pixel short
// after rounding, so the scale is taken per axis from the rounded dp size.
function dpSize(vp: Viewport): {
  W: number;
  H: number;
  kx: number;
  ky: number;
} {
  const W = Math.round(vp.width / vp.unitScale);
  const H = Math.round(vp.height / vp.unitScale);
  return { W, H, kx: vp.width / W, ky: vp.height / H };
}

type StateParts = {
  screen: ScreenKey;
  product: number;
  offset: number;
  chipOffset: number;
  variant: string | null;
  shop: ShopData;
};

// Each screen's state carries only the shop fields that screen renders, so
// the same screen reached with the same cart encodes to the same token.
const SCREEN_SHOP_FIELDS: Partial<Record<ScreenKey, (keyof ShopData)[]>> = {
  product_detail: ["date"],
  search: ["query", "results"],
  cart: ["cart", "coupon", "couponInput"],
  checkout: ["cart", "coupon", "express", "address", "date", "user"],
  payment: ["cart", "coupon", "express", "method", "user"],
  order_confirmation: [
    "cart",
    "coupon",
    "express",
    "address",
    "method",
    "order",
    "date",
    "user",
  ],
  orders: ["cart", "coupon", "express", "order", "date"],
  profile: ["user"],
};

const SHOP_LETTERS: Record<keyof ShopData, string> = {
  cart: "c",
  coupon: "k",
  couponInput: "i",
  express: "m",
  address: "a",
  method: "w",
  query: "q",
  results: "r",
  order: "n",
  date: "d",
  user: "u",
};

function encodeShopField(field: keyof ShopData, shop: ShopData): string {
  switch (field) {
    case "cart":
      return shop.cart
        .map((line) => `${line.product}.${line.option}.${line.qty}`)
        .join("-");
    case "express":
      return shop.express ? "1" : "";
    case "address":
      return shop.address > 0 ? String(shop.address) : "";
    case "method":
      return shop.method === "card" ? "" : shop.method;
    case "query":
    case "results":
      return shop[field].replace(/ /g, "+");
    case "user":
      return String(shop.user);
    default:
      return shop[field] ?? "";
  }
}

function decodeShopField(
  shop: ShopData,
  letter: string,
  value: string,
): ShopData {
  const field = (Object.keys(SHOP_LETTERS) as (keyof ShopData)[]).find(
    (key) => SHOP_LETTERS[key] === letter,
  );
  switch (field) {
    case "cart":
      return {
        ...shop,
        cart: value.split("-").map((line) => {
          const [product, option, qty] = line.split(".").map(Number);
          return { product, option, qty };
        }),
      };
    case "express":
      return { ...shop, express: value === "1" };
    case "address":
      return { ...shop, address: Number(value) };
    case "method":
      return { ...shop, method: value as PaymentMethod };
    case "user":
      return { ...shop, user: Number(value) };
    case "query":
    case "results":
      return { ...shop, [field]: value.replace(/\+/g, " ") };
    case undefined:
      return shop;
    default:
      return { ...shop, [field]: value };
  }
}

export function parseState(state: ScreenState): StateParts {
  const [screen, ...rest] = state.split(":");
  let product = 0;
  let offset = 0;
  let chipOffset = 0;
  let variant: string | null = null;
  let shop = EMPTY_SHOP;
  for (const part of rest) {
    const field = part.match(/^([a-z])=(.*)$/);
    if (field) {
      shop = decodeShopField(shop, field[1], field[2]);
    } else if (/^s\d+$/.test(part)) {
      offset = Number(part.slice(1));
    } else if (/^x\d+$/.test(part)) {
      chipOffset = Number(part.slice(1));
    } else if (/^p\d+$/.test(part)) {
      product = Number(part.slice(1));
    } else if (part !== "") {
      variant = part;
    }
  }
  return {
    screen: screen as ScreenKey,
    product,
    offset,
    chipOffset,
    variant,
    shop,
  };
}

function formatState(parts: StateParts): ScreenState {
  let out: string = parts.screen;
  if (parts.screen === "product_detail") {
    out += `:p${parts.product}`;
  }
  if (parts.variant) {
    out += `:${parts.variant}`;
  }
  if (parts.offset > 0) {
    out += `:s${parts.offset}`;
  }
  if (parts.chipOffset > 0) {
    out += `:x${parts.chipOffset}`;
  }
  for (const field of SCREEN_SHOP_FIELDS[parts.screen] ?? []) {
    const value = encodeShopField(field, parts.shop);
    if (value !== "") {
      out += `:${SHOP_LETTERS[field]}=${value}`;
    }
  }
  return out;
}

export function stateAfterScroll(
  vp: Viewport,
  state: ScreenState,
): ScreenState {
  const parts = parseState(state);
  const { screen, maxOffset } = measure(vp, state);
  return formatState({
    ...parts,
    offset: Math.min(maxOffset, parts.offset + screen.scrollBy),
  });
}

export function scrollToReveal(
  vp: Viewport,
  state: ScreenState,
  id: string,
): ScreenState {
  const parts = parseState(state);
  const { screen, frame, maxOffset } = measure(vp, state);
  const target = screen.content
    .map((n) => findNode(n, id))
    .find((n) => n !== null);
  if (!target) {
    return state;
  }
  if (parts.screen === "products" && target.role === "chip") {
    const past = target.x + target.w + 16 - frame.W;
    const before = 16 - target.x;
    if (past > 0 || before > 0) {
      const chipOffset = Math.max(
        0,
        parts.chipOffset + (past > 0 ? past : -before),
      );
      return formatState({ ...parts, chipOffset });
    }
  }
  if (findNode(assemble(vp, state), id)) {
    return state;
  }
  const viewport = frame.contentBottom - frame.contentTop;
  const wanted = target.y + target.h - viewport + 96;
  const offset = Math.max(0, Math.min(maxOffset, Math.round(wanted)));
  return formatState({ ...parts, offset });
}

export function withVariant(
  state: ScreenState,
  variant: string | null,
): ScreenState {
  const parts = parseState(state);
  const keepsScroll =
    parts.screen === "cart" ||
    parts.screen === "product_detail" ||
    parts.screen === "payment" ||
    parts.screen === "checkout";
  return formatState({
    ...parts,
    variant,
    offset: keepsScroll ? parts.offset : 0,
  });
}

export function stateForScreen(
  screen: ScreenKey,
  product: number,
  shop: ShopData = EMPTY_SHOP,
  variant: string | null = null,
): ScreenState {
  return formatState({
    screen,
    product,
    offset: 0,
    chipOffset: 0,
    variant,
    shop,
  });
}

export function withShop(state: ScreenState, shop: ShopData): ScreenState {
  return formatState({ ...parseState(state), shop });
}

type Frame = {
  W: number;
  H: number;
  style: UiStyle;
  barTop: number;
  barH: number;
  contentTop: number;
  contentBottom: number;
  tabH: number;
  bottomInset: number;
};

function frameFor(vp: Viewport, tabs: boolean): Frame {
  const apple = vp.style === "ios" || vp.style === "rn_ios";
  const { W, H } = dpSize(vp);
  // iPads and the home-button iPhone SE keep the 20pt status bar; every other
  // iPhone reserves room for the notch or the Dynamic Island.
  const homeButton = apple && W < 700 && H < 700;
  const barTop = apple
    ? W >= 700 || homeButton
      ? homeButton
        ? 20
        : 24
      : 59
    : 24;
  const barH = apple ? 44 : vp.style === "android" ? 64 : 56;
  const bottomInset = apple ? (homeButton ? 0 : W >= 700 ? 20 : 34) : 24;
  const tabH = apple ? 49 : vp.style === "android" ? 80 : 60;
  const contentTop = barTop + barH;
  const contentBottom = H - bottomInset - (tabs ? tabH : 0);
  return {
    W,
    H,
    style: vp.style,
    barTop,
    barH,
    contentTop,
    contentBottom,
    tabH,
    bottomInset,
  };
}

function node(
  role: Role,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<N> = {},
): N {
  return { role, x, y, w, h, ...extra };
}

function appBar(
  f: Frame,
  title: string,
  opts: { back?: boolean; actions?: { id: string; text: string }[] } = {},
): N {
  const kids: N[] = [];
  const iconS = Math.min(48, f.barH);
  const iconY = f.barTop + (f.barH - iconS) / 2;
  let titleX = 16;
  if (opts.back) {
    kids.push(
      node("icon", 4, iconY, iconS, iconS, {
        id: "btn_back",
        text: "Back",
      }),
    );
    titleX = 56;
  }
  const apple = f.style === "ios" || f.style === "rn_ios";
  const titleW = Math.min(220, f.W - titleX - 112);
  kids.push(
    node(
      "title",
      apple ? (f.W - titleW) / 2 : titleX,
      f.barTop + (f.barH - 28) / 2,
      titleW,
      28,
      { text: title },
    ),
  );
  let ax = f.W - 4 - iconS;
  for (const action of [...(opts.actions ?? [])].reverse()) {
    kids.push(
      node("icon", ax, iconY, iconS, iconS, {
        id: action.id,
        text: action.text,
      }),
    );
    ax -= iconS;
  }
  return node("bar", 0, f.barTop, f.W, f.barH, { kids });
}

function tabBar(f: Frame, active: string): N {
  const items = [
    { id: "nav_home", text: "Home" },
    { id: "nav_search", text: "Search" },
    { id: "nav_cart", text: "Cart" },
    { id: "nav_profile", text: "Profile" },
  ];
  const y = f.H - f.bottomInset - f.tabH;
  const w = f.W / items.length;
  return node("tabbar", 0, y, f.W, f.tabH, {
    kids: items.map((item, i) => {
      const left = Math.round(i * w);
      return node("tab", left, y, Math.round((i + 1) * w) - left, f.tabH, {
        id: item.id,
        text: item.text,
        selected: item.id === active,
      });
    }),
  });
}

function productCard(
  x: number,
  y: number,
  w: number,
  index: number,
  idPrefix = "card_product",
  slot = index,
): N {
  const p = PRODUCTS[index % PRODUCTS.length];
  const imageH = Math.round(w * 0.82);
  return node("card", x, y, w, imageH + 74, {
    id: `${idPrefix}_${idPrefix === "card_product" ? index : slot}`,
    text: p.name,
    kids: [
      node("image", x, y, w, imageH, { hue: p.hue, glyph: p.glyph }),
      node("text", x + 12, y + imageH + 10, w - 24, 20, { text: p.name }),
      node("muted", x + 12, y + imageH + 32, w - 24, 16, {
        text: p.category,
      }),
      node("text", x + 12, y + imageH + 50, w - 24, 18, { text: p.price }),
    ],
  });
}

function productGrid(
  f: Frame,
  y: number,
  indexes: number[],
  idPrefix?: string,
): { kids: N[]; bottom: number } {
  const gap = 12;
  const columns = f.W >= 700 ? 3 : 2;
  const w = Math.floor((f.W - 32 - gap * (columns - 1)) / columns);
  const rowH = Math.round(w * 0.82) + 74 + gap;
  const kids = indexes.map((index, i) =>
    productCard(
      16 + (i % columns) * (w + gap),
      y + Math.floor(i / columns) * rowH,
      w,
      index,
      idPrefix,
      i,
    ),
  );
  return { kids, bottom: y + Math.ceil(indexes.length / columns) * rowH };
}

function chipsRow(
  y: number,
  labels: string[],
  idPrefix: string,
  selected: number,
  firstIndex = 0,
  x = 16,
): N[] {
  return labels.map((label, i) => {
    const w = 28 + label.length * 8;
    const chip = node("chip", x, y, w, 32, {
      id: `${idPrefix}_${i + firstIndex}`,
      text: label,
      selected: i + firstIndex === selected,
    });
    x += w + 8;
    return chip;
  });
}

function sectionTitle(f: Frame, y: number, text: string, action?: string): N[] {
  const kids = [node("text", 16, y + 6, f.W - 140, 24, { text })];
  if (action) {
    kids.push(
      node("textbutton", f.W - 96, y, 80, 36, {
        id: `link_${text.toLowerCase().replace(/\s+/g, "_")}`,
        text: action,
      }),
    );
  }
  return kids;
}

function primaryButton(
  f: Frame,
  y: number,
  id: string,
  text: string,
  inset = 16,
): N {
  const pill = f.style === "android" || f.style === "flutter";
  return node("button", inset, y, f.W - inset * 2, pill ? 48 : 50, {
    id,
    text,
  });
}

function summaryRows(
  f: Frame,
  y: number,
  rows: [string, string][],
): { kids: N[]; bottom: number } {
  const kids: N[] = [];
  rows.forEach(([k, v], i) => {
    const strong = i === rows.length - 1;
    kids.push(
      node(strong ? "text" : "muted", 16, y + i * 26, f.W / 2, 22, {
        text: k,
      }),
      node(strong ? "text" : "muted", f.W / 2, y + i * 26, f.W / 2 - 16, 22, {
        text: v,
      }),
    );
  });
  return { kids, bottom: y + rows.length * 26 };
}

type ScreenBuild = {
  bar: N | null;
  content: N[];
  contentHeight: number;
  scrollId: string;
  listLike: boolean;
  tabs: string | null;
  scrollBy: number;
  pinned?: N[];
};

function buildScreen(f: Frame, state: ScreenState): ScreenBuild {
  const s = parseState(state);
  switch (s.screen) {
    case "login":
      return loginScreen(f);
    case "home":
      return homeScreen(f);
    case "products":
      return productsScreen(f, s.variant, s.chipOffset);
    case "search":
      return searchScreen(f, s.shop);
    case "product_detail":
      return productDetailScreen(f, s.product, s.variant, s.shop);
    case "cart":
      return cartScreen(f, s.variant, s.shop);
    case "checkout":
      return checkoutScreen(f, s.shop);
    case "payment":
      return paymentScreen(f, s.variant, s.shop);
    case "order_confirmation":
      return orderConfirmationScreen(f, s.variant, s.shop);
    case "profile":
      return profileScreen(f, s.variant, s.shop);
    case "orders":
      return ordersScreen(f, s.shop);
  }
}

function loginScreen(f: Frame): ScreenBuild {
  const content: N[] = [];
  const logoY = Math.round(f.H * 0.14);
  content.push(
    node("avatar", f.W / 2 - 32, logoY, 64, 64, { text: "A", hue: 168 }),
    node("title", 32, logoY + 84, f.W - 64, 32, { text: "Welcome back" }),
    node("muted", 32, logoY + 120, f.W - 64, 20, {
      text: "Sign in to continue to Acme Shop",
    }),
    node("input", 24, logoY + 168, f.W - 48, 56, {
      id: "field_email",
      text: "Email",
    }),
    node("input", 24, logoY + 240, f.W - 48, 56, {
      id: "field_password",
      text: "Password",
    }),
    node("textbutton", f.W - 24 - 140, logoY + 304, 140, 36, {
      id: "link_forgot_password",
      text: "Forgot password?",
    }),
    primaryButton(f, logoY + 356, "btn_login", "Log in", 24),
    node("muted", 24, logoY + 428, f.W - 48, 20, { text: "or" }),
    node("textbutton", 24, logoY + 460, f.W - 48, 48, {
      id: "btn_login_google",
      text:
        f.style === "ios" || f.style === "rn_ios"
          ? "Continue with Apple"
          : "Continue with Google",
    }),
    node("textbutton", 24, logoY + 528, f.W - 48, 36, {
      id: "link_create_account",
      text: "New here? Create an account",
    }),
  );
  return {
    bar: null,
    content,
    contentHeight: logoY + 580,
    scrollId: "login_scroll",
    listLike: false,
    tabs: null,
    scrollBy: 0,
  };
}

function homeScreen(f: Frame): ScreenBuild {
  const content: N[] = [];
  let y = 12;
  const heroH = Math.round((f.W - 32) * 0.56);
  content.push(
    node("card", 16, y, f.W - 32, heroH, {
      id: "hero_card",
      text: "Fall Collection",
      kids: [
        node("image", 16, y, f.W - 32, heroH, { hue: 20, glyph: "apparel" }),
        node("title", 32, y + heroH - 96, f.W - 64, 28, {
          text: "Fall Collection",
        }),
        node("muted", 32, y + heroH - 66, f.W - 64, 18, {
          text: "Layers built for the trail and the commute",
        }),
        node("button", 32, y + heroH - 44, 120, 32, {
          id: "hero_cta",
          text: "Shop now",
        }),
      ],
    }),
  );
  y += heroH + 14;
  content.push(...sectionTitle(f, y, "Categories"));
  y += 38;
  content.push(...chipsRow(y, CATEGORIES.slice(1), "chip_category", -1, 1));
  y += 42;
  content.push(...sectionTitle(f, y, "Trending", "See all"));
  y += 40;
  const cardW = Math.round((f.W - 32) / 2.4);
  const trending = [0, 1, 7, 3].map((index, i) =>
    productCard(16 + i * (cardW + 12), y, cardW, index),
  );
  content.push(
    node("list", 0, y, f.W, Math.round(cardW * 0.82) + 74, {
      id: "list_trending",
      scrollable: true,
      kids: trending,
    }),
  );
  y += Math.round(cardW * 0.82) + 74 + 14;
  content.push(...sectionTitle(f, y, "New arrivals", "See all"));
  y += 40;
  const grid = productGrid(f, y, [4, 6, 9, 2, 5, 8]);
  content.push(...grid.kids);
  y = grid.bottom + 2;
  content.push(...sectionTitle(f, y, "Recommended for you"));
  y += 40;
  const more = productGrid(f, y, [1, 7]);
  content.push(...more.kids);
  y = more.bottom;
  return {
    bar: appBar(f, "Acme Shop", {
      actions: [
        { id: "btn_search_icon", text: "Search" },
        { id: "btn_cart_icon", text: "Cart" },
      ],
    }),
    content,
    contentHeight: y + 16,
    scrollId: "home_scroll",
    listLike: false,
    tabs: "nav_home",
    scrollBy: heroH + 14 + 38 + 42 + 40 + Math.round(cardW * 0.82) + 74 + 20,
  };
}

function productsScreen(
  f: Frame,
  variant: string | null,
  chipOffset: number,
): ScreenBuild {
  const byPrice = variant === "price_asc";
  const selected = variant && !byPrice ? CATEGORIES.indexOf(variant) : 0;
  const content: N[] = [];
  let y = 12;
  content.push(
    ...chipsRow(y, CATEGORIES, "chip_category", selected, 0, 16 - chipOffset),
  );
  y += 36;
  const indexes = PRODUCTS.flatMap((p, i) =>
    selected <= 0 || p.category === CATEGORIES[selected] ? [i] : [],
  );
  if (byPrice) {
    indexes.sort((a, b) => PRICE_CENTS[a] - PRICE_CENTS[b]);
  }
  content.push(
    node("muted", 16, y + 8, f.W / 2, 20, {
      text: `${indexes.length} products`,
    }),
    node("textbutton", f.W - 136, y, 120, 36, {
      id: "btn_sort",
      text: byPrice ? "Sort: Price" : "Sort: Popular",
    }),
  );
  y += 40;
  const grid = productGrid(f, y, indexes);
  content.push(...grid.kids);
  return {
    bar: appBar(f, selected > 0 ? CATEGORIES[selected] : "All products", {
      back: true,
      actions: [
        { id: "btn_filter", text: "Filter" },
        { id: "btn_cart_icon", text: "Cart" },
      ],
    }),
    content,
    contentHeight: grid.bottom + 16,
    scrollId: "products_scroll",
    listLike: true,
    tabs: null,
    scrollBy: Math.round((f.contentBottom - f.contentTop) * 0.9),
  };
}

function searchScreen(f: Frame, shop: ShopData): ScreenBuild {
  const content: N[] = [];
  const results = shop.results !== "";
  let y = 8;
  content.push(
    node("input", 16, y, f.W - 32, 52, {
      id: "field_search",
      text: shop.query !== "" ? shop.query : "Search products",
      selected: shop.query !== "",
    }),
  );
  if (!results) {
    y += 62;
    content.push(...sectionTitle(f, y, "Recent searches", "Clear"));
    y += 42;
    ["trail runner", "earbuds", "field jacket", "tote"].forEach((text, i) => {
      content.push(
        node("row", 0, y, f.W, 48, {
          id: `row_recent_${i}`,
          text,
          kids: [
            node("icon", 16, y + 12, 24, 24),
            node("text", 56, y + 14, f.W - 120, 20, { text }),
            node("icon", f.W - 56, y + 12, 24, 24, {
              id: `btn_remove_recent_${i}`,
              text: "Remove",
            }),
          ],
        }),
      );
      y += 48;
    });
    y += 10;
    content.push(...sectionTitle(f, y, "Popular"));
    y += 40;
    content.push(
      ...chipsRow(
        y,
        ["Running", "Earbuds", "Jackets", "Backpacks"],
        "chip_popular",
        -1,
      ),
    );
    y += 48;
  } else {
    const hits = searchResults(shop.results);
    y += 68;
    content.push(
      node("muted", 16, y, f.W - 32, 20, {
        text: `${hits.length} results for "${shop.results}"`,
      }),
    );
    y += 28;
    content.push(...chipsRow(y, ["Under $100", "In stock"], "chip_filter", -1));
    y += 44;
    hits.forEach((index, i) => {
      const p = PRODUCTS[index];
      content.push(
        node("row", 0, y, f.W, 88, {
          id: `row_result_${i}`,
          text: p.name,
          kids: [
            node("image", 16, y + 8, 72, 72, { hue: p.hue, glyph: p.glyph }),
            node("text", 104, y + 14, f.W - 200, 22, { text: p.name }),
            node("muted", 104, y + 38, f.W - 200, 18, { text: p.category }),
            node("text", 104, y + 60, 100, 20, { text: p.price }),
            node("muted", f.W - 90, y + 60, 74, 20, { text: p.rating }),
          ],
        }),
      );
      y += 88;
    });
  }
  return {
    bar: appBar(f, "Search", {
      back: true,
      actions: [{ id: "btn_cart_icon", text: "Cart" }],
    }),
    content,
    contentHeight: y + 16,
    scrollId: "search_scroll",
    listLike: results,
    tabs: "nav_search",
    scrollBy: Math.round((f.contentBottom - f.contentTop) * 0.7),
  };
}

const DESCRIPTIONS: Record<Glyph, string[]> = {
  shoe: [
    "Breathable mesh upper with a cushioned midsole for",
    "long runs. The outsole grips on wet pavement and",
    "packed trails, and the heel counter keeps the fit",
    "steady on uneven ground.",
  ],
  audio: [
    "Balanced sound with deep bass and clear vocals.",
    "Pairs over Bluetooth 5.3, charges over USB-C, and",
    "shrugs off rain and sweat with an IPX5 rating.",
    "Up to 24 hours of playback on a full charge.",
  ],
  apparel: [
    "Soft, durable fabric that layers well from the",
    "trail to the commute. Machine washable, holds its",
    "shape after many washes, and resists odour on",
    "long days out.",
  ],
  bag: [
    "Water-resistant fabric with a padded laptop sleeve",
    "and quick-access front pocket. Straps adjust for a",
    "close fit, and the base is reinforced to stand up",
    "on its own.",
  ],
  bottle: [
    "Double-walled stainless steel keeps drinks cold for",
    "24 hours or hot for 12. Leak-proof lid, fits most",
    "cup holders, and the powder coat resists scratches",
    "and dents.",
  ],
  watch: [
    "Tracks runs, rides and sleep with built-in GPS and",
    "a heart rate sensor. The always-on display stays",
    "readable in sunlight, and the battery lasts up to",
    "a week between charges.",
  ],
};

function productDetailScreen(
  f: Frame,
  product: number,
  variant: string | null,
  shop: ShopData,
): ScreenBuild {
  const p = PRODUCTS[product % PRODUCTS.length];
  const content: N[] = [];
  let y = 0;
  const galleryH = Math.round(f.W * 0.9);
  content.push(
    node("list", 0, y, f.W, galleryH, {
      id: "image_gallery",
      scrollable: true,
      kids: [
        node("image", 0, y, f.W, galleryH, { hue: p.hue, glyph: p.glyph }),
        node("dots", f.W / 2 - 24, y + galleryH - 20, 48, 8),
        node("icon", f.W - 56, y + 12, 44, 44, {
          id: "btn_favorite",
          text: "Add to wishlist",
        }),
      ],
    }),
  );
  y += galleryH + 16;
  content.push(
    node("muted", 16, y, f.W - 32, 18, { text: p.category.toUpperCase() }),
    node("title", 16, y + 22, f.W - 100, 30, { text: p.name }),
    variant === "price_unavailable"
      ? node("muted", 16, y + 58, 200, 24, { text: "Price unavailable" })
      : node("text", 16, y + 58, 120, 24, { text: p.price }),
    node(
      "muted",
      variant === "price_unavailable" ? 220 : 140,
      y + 60,
      160,
      20,
      {
        text: `★ ${p.rating}`,
      },
    ),
  );
  y += 88;
  const sizeLabel = /^\d/.test(p.sizes[0]) ? "Size" : "Option";
  content.push(
    node("text", 16, y + 8, 120, 22, { text: sizeLabel }),
    node("textbutton", f.W - 130, y, 114, 36, {
      id: "link_size_guide",
      text: "Size guide",
    }),
  );
  y += 38;
  const selectedSize = variant?.startsWith("size")
    ? Number(variant.slice("size".length))
    : -1;
  content.push(...chipsRow(y, p.sizes, "chip_size", selectedSize));
  y += 52;
  content.push(node("divider", 16, y, f.W - 32, 1));
  y += 12;
  content.push(
    node("row", 0, y, f.W, 48, {
      id: "tab_description",
      text: "Description",
      kids: [
        node("text", 16, y + 14, f.W / 2 - 16, 20, { text: "Description" }),
      ],
    }),
    node("row", f.W / 2, y, f.W / 2, 48, {
      id: "tab_reviews",
      text: "Reviews",
      kids: [
        node("muted", f.W / 2 + 16, y + 14, f.W / 2 - 32, 20, {
          text: `Reviews (${p.rating.replace(/^.*\((.*)\)$/, "$1")})`,
        }),
      ],
    }),
  );
  y += 56;
  const lines = DESCRIPTIONS[p.glyph];
  lines.forEach((text, i) => {
    content.push(node("muted", 16, y + i * 22, f.W - 32, 20, { text }));
  });
  y += lines.length * 22 + 12;
  content.push(
    node("row", 0, y, f.W, 56, {
      id: "row_shipping",
      text: "Free shipping over $50",
      kids: [
        node("icon", 16, y + 16, 24, 24),
        node("text", 56, y + 8, f.W - 100, 20, {
          text: "Free shipping over $50",
        }),
        node("muted", 56, y + 30, f.W - 100, 18, {
          text: shop.date
            ? `Arrives ${deliveryDate(shop.date, false)}`
            : "Arrives in 4 business days",
        }),
      ],
    }),
    node("row", 0, y + 56, f.W, 56, {
      id: "row_returns",
      text: "Free 30-day returns",
      kids: [
        node("icon", 16, y + 72, 24, 24),
        node("text", 56, y + 64, f.W - 100, 20, {
          text: "Free 30-day returns",
        }),
        node("muted", 56, y + 86, f.W - 100, 18, {
          text: "No questions asked",
        }),
      ],
    }),
  );
  y += 118;
  content.push(...sectionTitle(f, y, "Reviews", "Write one"));
  y += 40;
  const reviews: [string, string, string][] = [
    ["Sam K.", "★★★★★", "Matches the photos, arrived quickly."],
    ["Dana R.", "★★★★☆", "Great quality, a little pricey."],
    ["Chris M.", "★★★★★", "Bought a second one as a gift."],
  ];
  reviews.forEach(([who, stars, body], i) => {
    const top = y + i * 96;
    content.push(
      node("card", 16, top, f.W - 32, 84, {
        kids: [
          node("avatar", 28, top + 12, 32, 32, { text: who[0], hue: 200 }),
          node("text", 72, top + 12, 140, 20, { text: who }),
          node("muted", f.W - 120, top + 12, 92, 20, { text: stars }),
          node("muted", 28, top + 48, f.W - 56, 20, { text: body }),
        ],
      }),
    );
  });
  y += reviews.length * 96 - 6;
  content.push(...sectionTitle(f, y, "You may also like"));
  y += 40;
  const also = productGrid(
    f,
    y,
    RELATED_OFFSETS.map((offset) => (product + offset) % PRODUCTS.length),
    "card_related",
  );
  content.push(...also.kids);
  y = also.bottom;
  const pinned = [
    node("group", 0, f.contentBottom - 80, f.W, 80, {
      kids: [
        primaryButton(
          f,
          f.contentBottom - 64,
          "btn_add_to_cart",
          "Add to cart",
        ),
      ],
    }),
  ];
  return {
    bar: appBar(f, "", {
      back: true,
      actions: [
        { id: "btn_share", text: "Share" },
        { id: "btn_cart_icon", text: "Cart" },
      ],
    }),
    content,
    contentHeight: y + 96,
    scrollId: "product_detail_scroll",
    listLike: false,
    tabs: null,
    scrollBy: galleryH + 88 + 38 + 52 + 12,
    pinned,
  };
}

function optionLabel(line: CartLine): string {
  const option = PRODUCTS[line.product].sizes[line.option];
  return /^\d+$/.test(option) ? `Size ${option}` : option;
}

function itemsLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}

function totalsRows(
  totals: Totals,
  coupon: string | null,
  labels: { tax: string; shipping?: boolean },
): [string, string][] {
  const rows: [string, string][] = [
    [itemsLabel(totals.count), money(totals.subtotal)],
  ];
  if (totals.discount > 0) {
    rows.push([`Discount (${coupon})`, `−${money(totals.discount)}`]);
  }
  if (labels.shipping !== false) {
    rows.push([
      "Shipping",
      totals.shipping === 0 ? "Free" : money(totals.shipping),
    ]);
  }
  rows.push([labels.tax, money(totals.tax)], ["Total", money(totals.total)]);
  return rows;
}

function cartScreen(
  f: Frame,
  variant: string | null,
  shop: ShopData,
): ScreenBuild {
  const content: N[] = [];
  const loadFailed = variant === "load_error";
  const items = loadFailed ? [] : shop.cart;
  const totals = orderTotals(items, shop.coupon, false);
  let y = 8;
  if (loadFailed) {
    content.push(
      node("title", 16, y + 40, f.W - 32, 28, {
        text: "Couldn't load your cart",
      }),
      node("muted", 16, y + 76, f.W - 32, 20, {
        text: "Check your connection and try again.",
      }),
      primaryButton(f, y + 116, "btn_retry", "Try again"),
    );
    y += 190;
  } else if (items.length === 0) {
    content.push(
      node("title", 16, y + 40, f.W - 32, 28, { text: "Your cart is empty" }),
    );
    y += 100;
  }
  items.forEach((item, i) => {
    const p = PRODUCTS[item.product];
    content.push(
      node("card", 16, y, f.W - 32, 128, {
        id: `row_cart_${i}`,
        text: p.name,
        kids: [
          node("image", 28, y + 18, 92, 92, { hue: p.hue, glyph: p.glyph }),
          node("text", 132, y + 14, f.W - 200, 22, { text: p.name }),
          node("muted", 132, y + 38, f.W - 200, 18, {
            text: optionLabel(item),
          }),
          node("text", 132, y + 60, 100, 22, { text: p.price }),
          node("icon", 132, y + 86, 28, 28, {
            id: `btn_qty_minus_${i}`,
            text: "Decrease",
          }),
          node("text", 160, y + 88, 36, 22, {
            text: String(item.qty),
            center: true,
          }),
          node("icon", 196, y + 86, 28, 28, {
            id: `btn_qty_plus_${i}`,
            text: "Increase",
          }),
          node("icon", f.W - 68, y + 12, 36, 36, {
            id: `btn_remove_${i}`,
            text: "Remove",
          }),
        ],
      }),
    );
    y += 140;
  });
  if (items.length > 0) {
    y += 4;
    content.push(
      node("input", 16, y, f.W - 140, 52, {
        id: "field_coupon",
        text: shop.coupon ?? (shop.couponInput || "Coupon code"),
        selected: shop.coupon !== null || shop.couponInput !== "",
      }),
      node("textbutton", f.W - 116, y + 2, 100, 48, {
        id: "btn_apply_coupon",
        text: shop.coupon ? "Applied" : "Apply",
      }),
    );
    y += 60;
    if (variant === "coupon_error") {
      content.push(
        node("muted", 16, y, f.W - 32, 18, {
          text: "Couldn't check this code right now. Try again later.",
        }),
      );
      y += 26;
    }
    y += 12;
    const rows = summaryRows(
      f,
      y,
      totalsRows(totals, shop.coupon, { tax: "Estimated tax" }),
    );
    content.push(...rows.kids);
    y = rows.bottom + 16;
    content.push(primaryButton(f, y, "btn_checkout", "Proceed to checkout"));
    y += 58;
  }
  content.push(...sectionTitle(f, y, "Saved for later"));
  y += 40;
  const saved = productGrid(f, y, SAVED_ITEMS, "card_saved");
  content.push(...saved.kids);
  y = saved.bottom;
  return {
    bar: appBar(f, loadFailed ? "Cart" : `Cart (${totals.count})`, {
      back: true,
    }),
    content,
    contentHeight: y + 16,
    scrollId: "cart_scroll",
    listLike: true,
    tabs: "nav_cart",
    scrollBy: 256,
  };
}

function checkoutScreen(f: Frame, shop: ShopData): ScreenBuild {
  const content: N[] = [];
  let y = 12;
  content.push(
    node("muted", 16, y, f.W - 32, 18, {
      text: "Step 1 of 3 · Address · Payment · Review",
    }),
  );
  y += 28;
  content.push(...sectionTitle(f, y, "Delivery address"));
  y += 40;
  const who = PEOPLE[shop.user];
  const addresses = [
    ["Home", addressLine(who.home)],
    ["Work", addressLine(who.work)],
  ];
  addresses.forEach(([name, line], i) => {
    content.push(
      node("radio", 16, y, f.W - 32, 68, {
        id: `radio_address_${i}`,
        text: name,
        selected: i === shop.address,
        kids: [
          node("text", 60, y + 12, f.W - 100, 20, { text: name }),
          node("muted", 60, y + 36, f.W - 100, 18, { text: line }),
        ],
      }),
    );
    y += 76;
  });
  content.push(
    node("textbutton", 16, y, 180, 40, {
      id: "btn_add_address",
      text: "+ Add new address",
    }),
  );
  y += 50;
  content.push(...sectionTitle(f, y, "Delivery option"));
  y += 40;
  const standard = orderTotals(shop.cart, shop.coupon, false);
  const arrives = (express: boolean) =>
    shop.date
      ? `Arrives ${deliveryDate(shop.date, express)}`
      : express
        ? "Next business day"
        : "4 business days";
  const options = [
    [
      "Standard",
      `${arrives(false)} · ${standard.shipping === 0 ? "Free" : money(standard.shipping)}`,
    ],
    ["Express", `${arrives(true)} · $9.00`],
  ];
  options.forEach(([name, line], i) => {
    content.push(
      node("radio", 16, y, f.W - 32, 60, {
        id: `radio_shipping_${i}`,
        text: name,
        selected: i === (shop.express ? 1 : 0),
        kids: [
          node("text", 60, y + 10, f.W - 100, 20, { text: name }),
          node("muted", 60, y + 32, f.W - 100, 18, { text: line }),
        ],
      }),
    );
    y += 68;
  });
  y += 2;
  content.push(...sectionTitle(f, y, "Order summary"));
  y += 40;
  const rows = summaryRows(
    f,
    y,
    totalsRows(orderTotals(shop.cart, shop.coupon, shop.express), shop.coupon, {
      tax: "Estimated tax",
    }),
  );
  content.push(...rows.kids);
  y = rows.bottom + 20;
  content.push(
    primaryButton(f, y, "btn_continue_payment", "Continue to payment"),
  );
  y += 64;
  return {
    bar: appBar(f, "Checkout", { back: true }),
    content,
    contentHeight: y + 16,
    scrollId: "checkout_scroll",
    listLike: false,
    tabs: null,
    scrollBy: 300,
  };
}

function paymentScreen(
  f: Frame,
  variant: string | null,
  shop: ShopData,
): ScreenBuild {
  const apple = f.style === "ios" || f.style === "rn_ios";
  const content: N[] = [];
  let y = 12;
  content.push(
    node("muted", 16, y, f.W - 32, 18, {
      text: "Step 2 of 3 · Address · Payment · Review",
    }),
  );
  y += 28;
  content.push(...sectionTitle(f, y, "Payment method"));
  y += 40;
  const methods = [
    variant === "methods_error"
      ? ["radio_card", "Saved card", "Couldn't load your saved cards"]
      : ["radio_card", "Visa •••• 4242", "Expires 08/28"],
    [
      apple ? "radio_apple_pay" : "radio_google_pay",
      apple ? "Apple Pay" : "Google Pay",
      "Pay with your saved wallet",
    ],
    ["radio_paypal", "PayPal", PEOPLE[shop.user].email],
  ];
  const selected =
    shop.method === "wallet"
      ? 1
      : shop.method === "paypal"
        ? 2
        : variant === "methods_error"
          ? -1
          : 0;
  methods.forEach(([id, name, line], i) => {
    content.push(
      node("radio", 16, y, f.W - 32, 64, {
        id,
        text: name,
        selected: i === selected,
        kids: [
          node("text", 60, y + 12, f.W - 100, 20, { text: name }),
          node("muted", 60, y + 34, f.W - 100, 18, { text: line }),
        ],
      }),
    );
    y += 72;
  });
  content.push(
    node("textbutton", 16, y, 160, 40, {
      id: "btn_add_card",
      text: "+ Add a card",
    }),
  );
  y += 56;
  content.push(
    node("switch", 16, y, f.W - 32, 48, {
      id: "switch_save_payment",
      text: "Save for next time",
      selected: true,
      kids: [
        node("text", 16, y + 14, f.W - 120, 20, { text: "Save for next time" }),
      ],
    }),
  );
  y += 58;
  content.push(...sectionTitle(f, y, "Order summary"));
  y += 40;
  const totals = orderTotals(shop.cart, shop.coupon, shop.express);
  const rows = summaryRows(
    f,
    y,
    totalsRows(totals, shop.coupon, { tax: "Tax" }),
  );
  content.push(...rows.kids);
  y = rows.bottom + 20;
  if (variant === "order_failed") {
    content.push(
      node("muted", 16, y, f.W - 32, 18, {
        text: "Something went wrong placing your order. Please try again.",
      }),
    );
    y += 28;
  }
  content.push(
    primaryButton(
      f,
      y,
      "btn_place_order",
      selected === 1
        ? apple
          ? "Pay with Apple Pay"
          : "Pay with Google Pay"
        : `Place order · ${money(totals.total)}`,
    ),
  );
  y += 64;
  content.push(
    node("muted", 16, y, f.W - 32, 18, {
      text: "By placing your order you agree to the terms of sale.",
    }),
  );
  y += 30;
  return {
    bar: appBar(f, "Payment", { back: true }),
    content,
    contentHeight: y + 16,
    scrollId: "payment_scroll",
    listLike: false,
    tabs: null,
    scrollBy: 260,
  };
}

// The "early_date" variant shows the arrival one day before the date the
// checkout screen promised, and "home_address" names the home address after
// the user picked work, the defects two of the sandbox bug reports describe.
function orderConfirmationScreen(
  f: Frame,
  variant: string | null,
  shop: ShopData,
): ScreenBuild {
  const apple = f.style === "ios" || f.style === "rn_ios";
  const content: N[] = [];
  let y = 40;
  const arrives = shop.date
    ? ` · Arrives ${deliveryDate(shop.date, shop.express, variant === "early_date" ? -1 : 0)}`
    : "";
  content.push(
    node("check", f.W / 2 - 40, y, 80, 80),
    node("title", 24, y + 100, f.W - 48, 32, { text: "Order placed" }),
    node("muted", 24, y + 136, f.W - 48, 20, {
      text: `Order #ACM-${shop.order ?? ""}${arrives}`,
    }),
  );
  y += 180;
  shop.cart.forEach((item, i) => {
    const p = PRODUCTS[item.product];
    content.push(
      node("row", 0, y, f.W, 76, {
        id: `row_order_item_${i}`,
        text: p.name,
        kids: [
          node("image", 16, y + 10, 56, 56, { hue: p.hue, glyph: p.glyph }),
          node("text", 88, y + 16, f.W - 200, 20, { text: p.name }),
          node("muted", 88, y + 40, f.W - 200, 18, {
            text: `${optionLabel(item)} · Qty ${item.qty}`,
          }),
          node("text", f.W - 100, y + 16, 84, 20, {
            text: money(PRICE_CENTS[item.product] * item.qty),
          }),
        ],
      }),
    );
    y += 76;
  });
  y += 8;
  const paidWith =
    shop.method === "wallet"
      ? apple
        ? "Apple Pay"
        : "Google Pay"
      : shop.method === "paypal"
        ? "PayPal"
        : "Visa •••• 4242";
  const rows = summaryRows(f, y, [
    [
      `Paid with ${paidWith}`,
      money(orderTotals(shop.cart, shop.coupon, shop.express).total),
    ],
    [
      "Delivering to",
      shop.address === 1 && variant !== "home_address" ? "Work" : "Home",
    ],
  ]);
  content.push(...rows.kids);
  y = rows.bottom + 24;
  content.push(primaryButton(f, y, "btn_track_order", "Track order"));
  y += 60;
  content.push(
    node("textbutton", 16, y, f.W - 32, 48, {
      id: "btn_continue_shopping",
      text: "Continue shopping",
    }),
  );
  y += 64;
  return {
    bar: appBar(f, "Order confirmation", {
      actions: [{ id: "btn_close", text: "Close" }],
    }),
    content,
    contentHeight: y + 16,
    scrollId: "order_scroll",
    listLike: false,
    tabs: null,
    scrollBy: 0,
  };
}

function profileScreen(
  f: Frame,
  variant: string | null,
  shop: ShopData,
): ScreenBuild {
  const who = PEOPLE[shop.user];
  const content: N[] = [];
  let y = 16;
  content.push(
    node("avatar", 16, y, 72, 72, { text: who.first[0], hue: 168 }),
    node("title", 104, y + 10, f.W - 120, 28, { text: fullName(who) }),
    node("muted", 104, y + 40, f.W - 120, 18, { text: who.email }),
  );
  y += 92;
  content.push(
    node("textbutton", 16, y, 140, 40, {
      id: "btn_edit_profile",
      text: "Edit profile",
    }),
  );
  y += 60;
  const rows: [string, string, string][] = [
    ["row_orders", "Orders", "Track, return or buy again"],
    ["row_addresses", "Addresses", "Home, Work"],
    ["row_payments", "Payment methods", "Visa •••• 4242"],
    ["row_wishlist", "Wishlist", "6 items"],
  ];
  rows.forEach(([id, name, line]) => {
    content.push(
      node("row", 0, y, f.W, 64, {
        id,
        text: name,
        kids: [
          node("icon", 16, y + 20, 24, 24),
          node("text", 56, y + 12, f.W - 140, 20, { text: name }),
          node("muted", 56, y + 34, f.W - 140, 18, { text: line }),
          node("icon", f.W - 40, y + 20, 24, 24),
        ],
      }),
      node("divider", 56, y + 64, f.W - 56, 1),
    );
    y += 65;
  });
  y += 6;
  content.push(...sectionTitle(f, y, "Preferences"));
  y += 40;
  const toggles: [string, string, boolean][] = [
    ["switch_notifications", "Order updates", true],
    ["switch_promos", "Offers and promotions", variant === "promos_on"],
    ["switch_dark_mode", "Dark mode", false],
  ];
  toggles.forEach(([id, name, on]) => {
    content.push(
      node("switch", 0, y, f.W, 52, {
        id,
        text: name,
        selected: on,
        kids: [node("text", 16, y + 16, f.W - 120, 20, { text: name })],
      }),
    );
    y += 52;
  });
  y += 12;
  const links: [string, string][] = [
    ["row_help", "Help and support"],
    ["row_about", "About Acme Shop"],
  ];
  links.forEach(([id, name]) => {
    content.push(
      node("row", 0, y, f.W, 48, {
        id,
        text: name,
        kids: [node("text", 16, y + 14, f.W - 80, 20, { text: name })],
      }),
    );
    y += 48;
  });
  y += 16;
  content.push(
    node("textbutton", 16, y, f.W - 32, 44, {
      id: "btn_log_out",
      text: "Log out",
    }),
  );
  y += 60;
  return {
    bar: appBar(f, "Profile", {
      actions: [{ id: "btn_settings", text: "Settings" }],
    }),
    content,
    contentHeight: y + 16,
    scrollId: "profile_scroll",
    listLike: false,
    tabs: "nav_profile",
    scrollBy: 250,
  };
}

type OrderRow = {
  number: string;
  date: string;
  total: string;
  status: string;
  product: number;
};

function orderRows(shop: ShopData): OrderRow[] {
  const placed: OrderRow[] =
    shop.order && shop.cart.length > 0
      ? [
          {
            number: shop.order,
            date: "Today",
            total: money(
              orderTotals(shop.cart, shop.coupon, shop.express).total,
            ),
            status: "Processing",
            product: shop.cart[0].product,
          },
        ]
      : [];
  const past = PAST_ORDERS.map((order) => ({
    number: order.number,
    date: shop.date ? shortDate(dayOf(shop.date, -order.daysAgo)) : "",
    total: money(
      orderTotals([{ product: order.product, option: 0, qty: 1 }], null, false)
        .total,
    ),
    status: order.status,
    product: order.product,
  }));
  return [...placed, ...past];
}

function ordersScreen(f: Frame, shop: ShopData): ScreenBuild {
  const content: N[] = [];
  let y = 8;
  orderRows(shop).forEach((order, i) => {
    const p = PRODUCTS[order.product];
    const title = `Order ACM-${order.number}`;
    content.push(
      node("card", 16, y, f.W - 32, 92, {
        id: `row_order_${i}`,
        text: title,
        kids: [
          node("image", 28, y + 14, 64, 64, { hue: p.hue, glyph: p.glyph }),
          node("text", 104, y + 14, f.W - 220, 20, { text: title }),
          node("muted", 104, y + 36, f.W - 220, 18, {
            text: order.date ? `${order.date} · ${order.total}` : order.total,
          }),
          node("muted", 104, y + 58, f.W - 220, 18, { text: order.status }),
          node("icon", f.W - 56, y + 34, 24, 24),
        ],
      }),
    );
    y += 104;
  });
  return {
    bar: appBar(f, "Orders", { back: true }),
    content,
    contentHeight: y + 16,
    scrollId: "orders_scroll",
    listLike: true,
    tabs: null,
    scrollBy: 200,
  };
}

function measure(
  vp: Viewport,
  state: ScreenState,
): { screen: ScreenBuild; frame: Frame; maxOffset: number } {
  const probe = buildScreen(frameFor(vp, false), state);
  const frame = frameFor(vp, probe.tabs !== null);
  const screen = probe.tabs !== null ? buildScreen(frame, state) : probe;
  const maxOffset = Math.max(
    0,
    screen.contentHeight - (frame.contentBottom - frame.contentTop),
  );
  return { screen, frame, maxOffset };
}

function assemble(vp: Viewport, state: ScreenState): N {
  const s = parseState(state);
  const { screen, frame: f, maxOffset } = measure(vp, state);
  const offset = Math.min(s.offset, maxOffset);
  const shiftY = f.contentTop - offset;
  const visible = (n: N): N | null => {
    const moved: N = { ...n, y: n.y + shiftY };
    if (
      moved.y + moved.h <= f.contentTop ||
      moved.y >= f.contentBottom ||
      moved.x + moved.w <= 0 ||
      moved.x >= f.W
    ) {
      return null;
    }
    if (n.kids) {
      moved.kids = n.kids.map(visible).filter((k): k is N => k !== null);
    }
    return moved;
  };
  const contentKids = screen.content
    .map(visible)
    .filter((k): k is N => k !== null);
  const kids: N[] = [];
  if (screen.bar) {
    kids.push(screen.bar);
  }
  kids.push(
    node(
      screen.listLike ? "list" : "scroll",
      0,
      f.contentTop,
      f.W,
      f.contentBottom - f.contentTop,
      {
        id: screen.scrollId,
        scrollable: true,
        kids: contentKids,
      },
    ),
  );
  if (screen.pinned) {
    kids.push(...screen.pinned);
  }
  if (screen.tabs) {
    kids.push(tabBar(f, screen.tabs));
  }
  return node("root", 0, 0, f.W, f.H, { kids });
}

function findNode(root: N, id: string): N | null {
  if (root.id === id) {
    return root;
  }
  for (const kid of root.kids ?? []) {
    const hit = findNode(kid, id);
    if (hit) {
      return hit;
    }
  }
  return null;
}

function describe(
  style: UiStyle,
  n: N,
): {
  label: string;
  type: string;
  id: string | null;
  target: string;
  targetId: string;
} {
  const text = n.text ?? "";
  const camel = (id: string) =>
    id.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  switch (style) {
    case "android": {
      const cls: Record<Role, string> = {
        root: "DecorView",
        bar: "MaterialToolbar",
        title: "MaterialTextView",
        icon: "AppCompatImageButton",
        text: "MaterialTextView",
        muted: "MaterialTextView",
        button: "MaterialButton",
        textbutton: "MaterialButton",
        card: "MaterialCardView",
        image: "ShapeableImageView",
        input: "TextInputEditText",
        list: "RecyclerView",
        scroll: "NestedScrollView",
        chip: "Chip",
        tabbar: "BottomNavigationView",
        tab: "BottomNavigationItemView",
        radio: "MaterialRadioButton",
        switch: "MaterialSwitch",
        divider: "MaterialDivider",
        group: "ConstraintLayout",
        row: "ConstraintLayout",
        avatar: "ShapeableImageView",
        check: "AppCompatImageView",
        dots: "TabLayout",
      };
      const textual = new Set<Role>([
        "title",
        "text",
        "muted",
        "button",
        "textbutton",
        "input",
        "chip",
        "radio",
        "switch",
      ]);
      return {
        label: cls[n.role],
        type: textual.has(n.role) ? "text" : "container",
        id: n.id ?? null,
        target: cls[n.role],
        targetId: n.id ?? "",
      };
    }
    case "rn_android": {
      const cls: Partial<Record<Role, string>> = {
        root: "ReactRootView",
        title: "ReactTextView",
        text: "ReactTextView",
        muted: "ReactTextView",
        image: "ReactImageView",
        avatar: "ReactImageView",
        input: "ReactEditText",
        list: "ReactScrollView",
        scroll: "ReactScrollView",
        switch: "ReactSwitch",
      };
      const label = cls[n.role] ?? "ReactViewGroup";
      return {
        label,
        type:
          label === "ReactTextView" || label === "ReactEditText"
            ? "text"
            : "container",
        id: null,
        target: label,
        targetId: "",
      };
    }
    case "ios": {
      const cls: Record<Role, [string, string]> = {
        root: ["UIWindow", "container"],
        bar: ["UINavigationBar", "container"],
        title: ["UILabel", "text"],
        icon: ["UIButton", "button"],
        text: ["UILabel", "text"],
        muted: ["UILabel", "text"],
        button: ["UIButton", "button"],
        textbutton: ["UIButton", "button"],
        card: ["UICollectionViewCell", "container"],
        image: ["UIImageView", "image"],
        input: ["UITextField", "input"],
        list: ["UICollectionView", "list"],
        scroll: ["UIScrollView", "container"],
        chip: ["UIButton", "button"],
        tabbar: ["UITabBar", "container"],
        tab: ["UITabBarButton", "container"],
        radio: ["UITableViewCell", "container"],
        switch: ["UISwitch", "checkbox"],
        divider: ["UIView", "container"],
        group: ["UIView", "container"],
        row: ["UITableViewCell", "container"],
        avatar: ["UIImageView", "image"],
        check: ["UIImageView", "image"],
        dots: ["UIPageControl", "container"],
      };
      const [target, type] = cls[n.role];
      const labelled = new Set<Role>([
        "title",
        "text",
        "muted",
        "button",
        "textbutton",
        "chip",
        "tab",
        "icon",
        "switch",
        "radio",
      ]);
      return {
        label: labelled.has(n.role) && text !== "" ? text : target,
        type,
        id: null,
        target,
        targetId: n.id ? camel(n.id) : "",
      };
    }
    case "rn_ios": {
      const cls: Partial<Record<Role, [string, string]>> = {
        root: ["RCTRootContentView", "container"],
        title: ["RCTParagraphTextView", "container"],
        text: ["RCTParagraphTextView", "container"],
        muted: ["RCTParagraphTextView", "container"],
        image: ["RCTImageComponentView", "container"],
        avatar: ["RCTImageComponentView", "container"],
        input: ["RCTTextInputComponentView", "container"],
        list: ["RCTEnhancedScrollView", "container"],
        scroll: ["RCTEnhancedScrollView", "container"],
        switch: ["RCTSwitch", "checkbox"],
      };
      const [target, type] = cls[n.role] ?? [
        "RCTViewComponentView",
        "container",
      ];
      return {
        label: text !== "" ? text : target,
        type,
        id: null,
        target,
        targetId: "",
      };
    }
    case "flutter": {
      const cls: Record<Role, [string, string]> = {
        root: ["Scaffold", "container"],
        bar: ["Container", "container"],
        title: ["Text", "text"],
        icon: ["IconButton", "button"],
        text: ["Text", "text"],
        muted: ["Text", "text"],
        button: ["FilledButton", "button"],
        textbutton: ["TextButton", "button"],
        card: ["Card", "container"],
        image: ["Container", "container"],
        input: ["TextField", "input"],
        list: ["ListView", "list"],
        scroll: ["SingleChildScrollView", "container"],
        chip: ["ChoiceChip", "button"],
        tabbar: ["Row", "container"],
        tab: ["InkResponse", "button"],
        radio: ["RadioListTile", "radio"],
        switch: ["SwitchListTile", "checkbox"],
        divider: ["Container", "container"],
        group: ["Column", "container"],
        row: ["ListTile", "list"],
        avatar: ["Container", "container"],
        check: ["Container", "container"],
        dots: ["Row", "container"],
      };
      const [target, type] = cls[n.role];
      return { label: target, type, id: null, target, targetId: "" };
    }
  }
}

function toSnapshot(
  vp: Viewport,
  n: N,
  highlight: string | null,
): SnapshotNode {
  const d = describe(vp.style, n);
  const { kx, ky } = dpSize(vp);
  const round =
    vp.unitScale === 1
      ? (v: number) => Math.round(v * 2) / 2
      : (v: number) => Math.round(v);
  const out: SnapshotNode = {
    label: d.label,
    type: d.type,
    x: round(n.x * kx),
    y: round(n.y * ky),
    width: round(n.w * kx),
    height: round(n.h * ky),
    scrollable: n.scrollable === true,
    highlighted: highlight !== null && n.id === highlight,
    children: (n.kids ?? []).map((kid) => toSnapshot(vp, kid, highlight)),
  };
  if (vp.style === "android") {
    return { id: d.id, ...out };
  }
  return out;
}

export function layoutTree(
  vp: Viewport,
  state: ScreenState,
  highlight: string | null,
): SnapshotNode {
  return toSnapshot(vp, assemble(vp, state), highlight);
}

export function gestureBox(
  vp: Viewport,
  state: ScreenState,
  id: string,
  jitter: (min: number, max: number) => number,
): GestureBox | null {
  const n = findNode(assemble(vp, state), id);
  if (!n) {
    return null;
  }
  const d = describe(vp.style, n);
  const { kx, ky } = dpSize(vp);
  const x = n.x + n.w / 2 + jitter(-Math.floor(n.w / 3), Math.floor(n.w / 3));
  const y = n.y + n.h / 2 + jitter(-Math.floor(n.h / 4), Math.floor(n.h / 4));
  return {
    target: d.target,
    targetId: d.targetId,
    label: n.text ?? "",
    x: Math.round(x * kx),
    y: Math.round(y * ky),
    width: Math.round(n.w * kx),
    height: Math.round(n.h * ky),
  };
}

export function scrollBox(
  vp: Viewport,
  state: ScreenState,
): { target: string; targetId: string } {
  const root = assemble(vp, state);
  const scroller = (root.kids ?? []).find((kid) => kid.scrollable);
  const d = describe(vp.style, scroller ?? root);
  return { target: d.target, targetId: d.targetId };
}

export function openedProductFor(
  state: ScreenState,
  id: string,
): number | null {
  const s = parseState(state);
  const indexed = id.match(
    /^(card_product|card_related|card_saved|row_result|row_cart|row_order|row_order_item)_(\d+)$/,
  );
  if (!indexed) {
    return null;
  }
  const index = Number(indexed[2]);
  switch (indexed[1]) {
    case "card_product":
      return index % PRODUCTS.length;
    case "card_related":
      return (
        (s.product + RELATED_OFFSETS[index % RELATED_OFFSETS.length]) %
        PRODUCTS.length
      );
    case "card_saved":
      return SAVED_ITEMS[index % SAVED_ITEMS.length];
    case "row_result":
      return searchResults(s.shop.results)[index] ?? null;
    case "row_cart":
    case "row_order_item":
      return s.shop.cart[index]?.product ?? null;
    case "row_order":
      return s.screen === "orders"
        ? (orderRows(s.shop)[index]?.product ?? null)
        : null;
  }
  return null;
}

export function stateAfterTap(state: ScreenState, id: string): ScreenState {
  const s = parseState(state);
  if (s.screen === "product_detail" && /^chip_size_\d+$/.test(id)) {
    return withVariant(state, `size${id.slice("chip_size_".length)}`);
  }
  if (s.screen === "products" && /^chip_category_/.test(id)) {
    const index = Number(id.slice("chip_category_".length));
    return withVariant(state, index > 0 ? CATEGORIES[index] : null);
  }
  if (s.screen === "products" && id === "btn_sort") {
    return withVariant(state, "price_asc");
  }
  if (s.screen === "profile" && id === "switch_promos") {
    return withVariant(state, s.variant === "promos_on" ? null : "promos_on");
  }
  return state;
}

export function shopAfterTap(
  shop: ShopData,
  state: ScreenState,
  id: string,
): ShopData {
  const screen = parseState(state).screen;
  if (screen === "checkout" && /^radio_address_\d+$/.test(id)) {
    return { ...shop, address: Number(id.slice("radio_address_".length)) };
  }
  if (screen === "checkout" && /^radio_shipping_\d+$/.test(id)) {
    return { ...shop, express: id === "radio_shipping_1" };
  }
  if (screen === "payment") {
    if (id === "radio_apple_pay" || id === "radio_google_pay") {
      return { ...shop, method: "wallet" };
    }
    if (id === "radio_paypal") {
      return { ...shop, method: "paypal" };
    }
    if (id === "radio_card") {
      return { ...shop, method: "card" };
    }
  }
  return shop;
}

const GLYPHS: Record<Glyph, string> = {
  shoe: "M8 38 C8 30 14 27 20 26 L34 14 C38 12 42 14 44 18 L50 20 C58 22 62 26 62 30 L62 36 C62 38 60 40 58 40 L10 40 C9 40 8 39 8 38 Z M20 26 L34 30",
  audio:
    "M14 22 C14 12 22 6 32 6 C42 6 50 12 50 22 L50 30 M10 30 L18 30 L18 44 L10 44 Z M46 30 L54 30 L54 44 L46 44 Z",
  apparel:
    "M22 8 L32 12 L42 8 L56 16 L50 26 L44 22 L44 54 L20 54 L20 22 L14 26 L8 16 Z",
  bag: "M14 22 L50 22 L54 54 L10 54 Z M22 22 C22 12 26 8 32 8 C38 8 42 12 42 22",
  bottle:
    "M26 6 L38 6 L38 14 C44 18 44 22 44 26 L44 52 C44 56 41 58 38 58 L26 58 C23 58 20 56 20 52 L20 26 C20 22 20 18 26 14 Z M22 30 L42 30 M22 44 L42 44",
  watch:
    "M22 8 L42 8 L42 18 L22 18 Z M22 46 L42 46 L42 56 L22 56 Z M32 18 C40 18 46 24 46 32 C46 40 40 46 32 46 C24 46 18 40 18 32 C18 24 24 18 32 18 Z M32 24 L32 32 L37 35",
};

const ICONS: Record<string, string> = {
  Back: "M15 5 L8 12 L15 19",
  Search: "M10 4 a6 6 0 1 0 0 12 a6 6 0 1 0 0 -12 Z M14.5 14.5 L20 20",
  Cart: "M3 4 H6 L8.5 15 H18 L20 8 H7 M9 19 a1 1 0 1 0 0.01 0 M17 19 a1 1 0 1 0 0.01 0",
  Home: "M4 11 L12 4 L20 11 V20 H14 V14 H10 V20 H4 Z",
  Profile:
    "M12 4 a4 4 0 1 0 0 8 a4 4 0 1 0 0 -8 Z M4 20 C4 16 8 14 12 14 C16 14 20 16 20 20",
  Remove: "M6 6 L18 18 M18 6 L6 18",
  Close: "M6 6 L18 18 M18 6 L6 18",
  Share: "M12 15 V3 M8 7 L12 3 L16 7 M5 12 V20 H19 V12",
  "Add to wishlist":
    "M12 20 C6 15 3 12 3 8.5 C3 6 5 4 7.5 4 C9.5 4 11 5 12 6.5 C13 5 14.5 4 16.5 4 C19 4 21 6 21 8.5 C21 12 18 15 12 20 Z",
  Filter: "M4 6 H20 M7 12 H17 M10 18 H14",
  Settings:
    "M12 8 a4 4 0 1 0 0 8 a4 4 0 1 0 0 -8 Z M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M5 5 L7 7 M17 17 L19 19 M5 19 L7 17 M17 7 L19 5",
  Chevron: "M9 6 L15 12 L9 18",
  Dot: "M12 7 a5 5 0 1 0 0 10 a5 5 0 1 0 0 -10 Z",
};

type Theme = {
  bg: string;
  surface: string;
  primary: string;
  onPrimary: string;
  text: string;
  muted: string;
  outline: string;
  radius: number;
  barBg: string;
  font: string;
};

function themeFor(style: UiStyle): Theme {
  const common = {
    onPrimary: "#ffffff",
    text: "#1b1c1e",
    muted: "#6b6f76",
  };
  switch (style) {
    case "android":
    case "flutter":
      return {
        ...common,
        bg: "#fbf9f7",
        surface: "#ffffff",
        primary: style === "android" ? "#0f6b5c" : "#1d5f9c",
        outline: "#d9d5cf",
        radius: 12,
        barBg: "#f4f1ec",
        font: "Roboto, 'Helvetica Neue', Arial, sans-serif",
      };
    case "ios":
    case "rn_ios":
      return {
        ...common,
        bg: "#f2f2f7",
        surface: "#ffffff",
        primary: style === "ios" ? "#0a7c6e" : "#2c5fd8",
        outline: "#d1d1d6",
        radius: 12,
        barBg: "#f9f9f9",
        font: "-apple-system, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
      };
    case "rn_android":
      return {
        ...common,
        bg: "#f7f7f8",
        surface: "#ffffff",
        primary: "#2c5fd8",
        outline: "#dcdde1",
        radius: 8,
        barBg: "#ffffff",
        font: "Roboto, 'Helvetica Neue', Arial, sans-serif",
      };
  }
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fit(text: string, w: number, size: number): string {
  const max = Math.max(3, Math.floor(w / (size * 0.52)));
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function screenshotSvg(vp: Viewport, state: ScreenState): string {
  const t = themeFor(vp.style);
  const apple = vp.style === "ios" || vp.style === "rn_ios";
  const pill = vp.style === "android" || vp.style === "flutter";
  const root = assemble(vp, state);
  const f = frameFor(vp, false);
  const parts: string[] = [];
  const text = (
    s: string,
    x: number,
    y: number,
    size: number,
    fill: string,
    opts: {
      weight?: number;
      anchor?: "start" | "middle" | "end";
      w?: number;
    } = {},
  ) => {
    const shown = fit(s, opts.w ?? 10_000, size);
    parts.push(
      `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}"${opts.weight ? ` font-weight="${opts.weight}"` : ""}${opts.anchor ? ` text-anchor="${opts.anchor}"` : ""}>${esc(shown)}</text>`,
    );
  };
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    r = 0,
    stroke?: string,
  ) => {
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}"` : ""}/>`,
    );
  };
  const clipId = "c";
  const paint = (n: N, clipped: boolean) => {
    const cx = n.x + n.w / 2;
    const baseline = (size: number) => n.y + n.h / 2 + size * 0.36;
    switch (n.role) {
      case "root":
        rect(0, 0, n.w, n.h, t.bg);
        break;
      case "bar":
        rect(0, 0, n.w, n.y + n.h, t.barBg);
        if (apple) {
          rect(0, n.y + n.h - 0.5, n.w, 0.5, t.outline);
        }
        break;
      case "title":
        text(
          n.text ?? "",
          apple ? cx : n.x,
          baseline(apple ? 17 : 22),
          apple ? 17 : 22,
          t.text,
          {
            weight: 600,
            anchor: apple ? "middle" : "start",
            w: n.w,
          },
        );
        break;
      case "text":
        text(n.text ?? "", n.center ? cx : n.x, baseline(15), 15, t.text, {
          weight: 500,
          anchor: n.center ? "middle" : undefined,
          w: n.w,
        });
        break;
      case "muted":
        text(n.text ?? "", n.x, baseline(13), 13, t.muted, { w: n.w });
        break;
      case "button":
        rect(n.x, n.y, n.w, n.h, t.primary, pill ? n.h / 2 : t.radius);
        text(n.text ?? "", cx, baseline(15), 15, t.onPrimary, {
          weight: 600,
          anchor: "middle",
          w: n.w,
        });
        break;
      case "textbutton":
        if (n.w > 200) {
          rect(
            n.x,
            n.y,
            n.w,
            n.h,
            "none",
            pill ? n.h / 2 : t.radius,
            t.outline,
          );
        }
        text(n.text ?? "", cx, baseline(15), 15, t.primary, {
          weight: 600,
          anchor: "middle",
          w: n.w,
        });
        break;
      case "card":
        rect(n.x, n.y, n.w, n.h, t.surface, t.radius, t.outline);
        break;
      case "image": {
        const hue = n.hue ?? 200;
        const id = `g${hue}`;
        parts.push(
          `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,88%)"/><stop offset="1" stop-color="hsl(${hue},40%,72%)"/></linearGradient></defs>`,
        );
        rect(n.x, n.y, n.w, n.h, `url(#${id})`, n.w >= f.W ? 0 : t.radius);
        if (n.glyph) {
          const size = Math.min(n.w, n.h) * 0.5;
          const k = size / 64;
          const hero = n.w >= f.W - 40 && n.h < n.w * 0.7;
          const top = hero
            ? n.y + n.h * 0.32 - size / 2
            : n.y + n.h / 2 - size / 2;
          parts.push(
            `<path d="${GLYPHS[n.glyph]}" transform="translate(${cx - size / 2} ${top}) scale(${k.toFixed(3)})" fill="none" stroke="hsl(${hue},35%,30%)" stroke-width="${(3 / k).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`,
          );
        }
        break;
      }
      case "input":
        rect(
          n.x,
          n.y,
          n.w,
          n.h,
          t.surface,
          apple ? 10 : 4,
          n.selected ? t.primary : t.outline,
        );
        text(
          n.text ?? "",
          n.x + 16,
          baseline(15),
          15,
          n.selected ? t.text : t.muted,
          { w: n.w - 32 },
        );
        break;
      case "chip":
        rect(
          n.x,
          n.y,
          n.w,
          n.h,
          n.selected ? t.primary : t.surface,
          apple ? n.h / 2 : 8,
          n.selected ? t.primary : t.outline,
        );
        text(
          n.text ?? "",
          cx,
          baseline(13),
          13,
          n.selected ? t.onPrimary : t.text,
          { weight: 500, anchor: "middle", w: n.w },
        );
        break;
      case "tabbar":
        rect(0, n.y, n.w, f.H - n.y, t.barBg);
        rect(0, n.y, n.w, 0.5, t.outline);
        break;
      case "tab": {
        const color = n.selected ? t.primary : t.muted;
        if (n.selected && !apple) {
          rect(cx - 32, n.y + 12, 64, 32, `${t.primary}22`, 16);
        }
        parts.push(
          `<path d="${ICONS[n.text ?? ""] ?? ICONS.Dot}" transform="translate(${cx - 12} ${n.y + 16})" fill="${n.selected && apple ? color : "none"}" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
        );
        text(
          n.text ?? "",
          cx,
          n.y + (apple ? 46 : 58),
          apple ? 10 : 12,
          color,
          { anchor: "middle", weight: n.selected ? 600 : 400 },
        );
        break;
      }
      case "radio": {
        rect(
          n.x,
          n.y,
          n.w,
          n.h,
          t.surface,
          t.radius,
          n.selected ? t.primary : t.outline,
        );
        parts.push(
          `<circle cx="${n.x + 24}" cy="${n.y + n.h / 2}" r="9" fill="none" stroke="${n.selected ? t.primary : t.outline}" stroke-width="2"/>`,
        );
        if (n.selected) {
          parts.push(
            `<circle cx="${n.x + 24}" cy="${n.y + n.h / 2}" r="5" fill="${t.primary}"/>`,
          );
        }
        break;
      }
      case "switch": {
        const sx = f.W - 16 - 52;
        const sy = n.y + n.h / 2 - 16;
        rect(sx, sy, 52, 32, n.selected ? t.primary : t.outline, 16);
        parts.push(
          `<circle cx="${n.selected ? sx + 36 : sx + 16}" cy="${sy + 16}" r="12" fill="#fff"/>`,
        );
        break;
      }
      case "divider":
        rect(n.x, n.y, n.w, 1, t.outline);
        break;
      case "avatar":
        parts.push(
          `<circle cx="${cx}" cy="${n.y + n.h / 2}" r="${n.w / 2}" fill="hsl(${n.hue ?? 200},45%,80%)"/>`,
        );
        text(
          n.text ?? "",
          cx,
          baseline(n.w * 0.42),
          n.w * 0.42,
          `hsl(${n.hue ?? 200},40%,30%)`,
          { weight: 600, anchor: "middle" },
        );
        break;
      case "check":
        parts.push(
          `<circle cx="${cx}" cy="${n.y + n.h / 2}" r="${n.w / 2}" fill="${t.primary}"/><path d="M${cx - 18} ${n.y + n.h / 2} l12 12 l24 -26" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
        );
        break;
      case "dots":
        for (let i = 0; i < 4; i += 1) {
          parts.push(
            `<circle cx="${n.x + 6 + i * 12}" cy="${n.y + 4}" r="3" fill="${i === 0 ? "#fff" : "#ffffff88"}"/>`,
          );
        }
        break;
      case "icon": {
        const cy = n.y + n.h / 2;
        const stroke = apple ? t.primary : t.text;
        if (n.text === "Increase" || n.text === "Decrease") {
          rect(n.x, n.y, n.w, n.h, "none", n.w / 2, t.outline);
          text(
            n.text === "Increase" ? "+" : "−",
            cx,
            baseline(16),
            16,
            t.text,
            { anchor: "middle" },
          );
          break;
        }
        const glyph =
          ICONS[n.text ?? ""] ?? (n.text ? ICONS.Chevron : ICONS.Dot);
        parts.push(
          `<path d="${glyph}" transform="translate(${cx - 12} ${cy - 12})" fill="none" stroke="${n.text ? stroke : t.muted}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
        );
        break;
      }
      case "row":
      case "group":
      case "list":
      case "scroll":
        break;
    }
    if (n.role === "scroll" || n.role === "list") {
      if (!clipped) {
        parts.push(`<g clip-path="url(#${clipId})">`);
        (n.kids ?? []).forEach((kid) => paint(kid, true));
        parts.push("</g>");
        return;
      }
    }
    (n.kids ?? []).forEach((kid) => paint(kid, clipped));
  };
  paint(root, false);
  const statusH = f.barTop;
  const tall = statusH > 40;
  const size = tall ? 15 : 13;
  const baseline = tall ? statusH - 14 : statusH - 5;
  const iconH = tall ? 12 : 9;
  const iconTop = baseline - iconH + 1;
  const ink = t.text;
  const signal = [3, 6, 9, 12]
    .map(
      (h, i) =>
        `<rect x="${f.W - 88 + i * 4}" y="${iconTop + iconH - h * (iconH / 12)}" width="3" height="${h * (iconH / 12)}" rx="0.5" fill="${ink}"/>`,
    )
    .join("");
  const wifi = `<path d="M${f.W - 66} ${iconTop + 4} q7 -6 14 0 M${f.W - 63} ${iconTop + 7} q4 -3.5 8 0 M${f.W - 59} ${iconTop + 10} l0 0" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`;
  const battery = `<rect x="${f.W - 44}" y="${iconTop}" width="26" height="${iconH}" rx="3" fill="none" stroke="${ink}"/><rect x="${f.W - 42}" y="${iconTop + 2}" width="19" height="${iconH - 4}" rx="1.5" fill="${ink}"/><rect x="${f.W - 17}" y="${iconTop + iconH / 2 - 2}" width="1.5" height="4" fill="${ink}"/>`;
  const status = apple
    ? `<text x="${tall ? 44 : 16}" y="${baseline}" font-size="${size}" font-weight="600" fill="${ink}">9:41</text>${signal}${wifi}${battery}`
    : `<text x="16" y="${baseline}" font-size="${size}" font-weight="500" fill="${ink}">10:24</text>${wifi}${battery}`;
  const homeBar =
    apple && f.bottomInset === 0
      ? ""
      : apple
        ? `<rect x="${f.W / 2 - 67}" y="${f.H - 10}" width="134" height="5" rx="2.5" fill="${ink}"/>`
        : `<rect x="${f.W / 2 - 54}" y="${f.H - 9}" width="108" height="3" rx="1.5" fill="${ink}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vp.width}" height="${vp.height}" viewBox="0 0 ${f.W} ${f.H}" font-family="${t.font}"><defs><clipPath id="${clipId}"><rect x="0" y="${f.contentTop}" width="${f.W}" height="${f.H - f.contentTop}"/></clipPath></defs>${parts.join("")}${status}${homeBar}</svg>`;
}

// Sandbox screenshots and layout snapshots are drawn by the server on request.
//
// The sandbox's sessions, errors and bug reports come from the catalog, which
// catalog.ts generates in the browser from the platform specs. The dashboard
// loads attachments the same way it does for real apps, by fetching a URL, and
// the server answering that URL never sees the catalog. So each attachment URL
// carries a token that describes the screen to draw: the viewport, the screen
// state and the highlighted element. The sandbox-attachments route decodes the
// token and renders the image with screenshotSvg or layoutTree.
//
// A replay page loads dozens of attachments, so the route marks every response
// immutable for a year, and browsers and CDNs keep each image after the first
// request. That is only correct while a token always draws the same image.
//
// Any change to how screenshotSvg or layoutTree draws a screen must set
// ATTACHMENTS_CHANGED_AT to the current Unix time. The new value changes every
// token, so browsers fetch the new images, and decodeToken rejects tokens that
// carry an older value.
export type SnapshotToken = {
  vp: Viewport;
  state: ScreenState;
  highlight: string | null;
};

const ATTACHMENTS_CHANGED_AT = "1790166773";

export function encodeToken(token: SnapshotToken): string {
  const raw = [
    ATTACHMENTS_CHANGED_AT,
    token.vp.style,
    token.vp.width,
    token.vp.height,
    token.vp.unitScale,
    token.state,
    token.highlight ?? "",
  ].join("|");
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeToken(encoded: string): SnapshotToken | null {
  try {
    const raw = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const [changedAt, style, width, height, unitScale, state, highlight] =
      raw.split("|");
    const styles: UiStyle[] = [
      "android",
      "ios",
      "flutter",
      "rn_android",
      "rn_ios",
    ];
    if (
      changedAt !== ATTACHMENTS_CHANGED_AT ||
      !styles.includes(style as UiStyle) ||
      !state ||
      !isScreenKey(parseState(state).screen)
    ) {
      return null;
    }
    const vp: Viewport = {
      style: style as UiStyle,
      width: Number(width),
      height: Number(height),
      unitScale: Number(unitScale),
    };
    if (
      ![vp.width, vp.height, vp.unitScale].every(Number.isFinite) ||
      vp.width <= 0 ||
      vp.height <= 0
    ) {
      return null;
    }
    return { vp, state, highlight: highlight === "" ? null : highlight };
  } catch {
    return null;
  }
}
