import { DateTime } from "luxon";
import {
  bucketsForRange,
  formatBucket,
  randomStream,
  SandboxRange,
  unitInterval,
} from "./query";

const HOURLY_SHAPE = [
  0.55, 0.35, 0.22, 0.15, 0.12, 0.13, 0.2, 0.35, 0.55, 0.75, 0.9, 1.0, 1.05,
  1.0, 0.95, 0.95, 1.0, 1.1, 1.25, 1.45, 1.6, 1.55, 1.25, 0.85,
];
const HOURLY_AVG =
  HOURLY_SHAPE.reduce((a, b) => a + b, 0) / HOURLY_SHAPE.length;

const WEEKLY_SHAPE = [0.97, 0.93, 0.92, 0.95, 1.02, 1.12, 1.09];

function interpolate(table: number[], position: number): number {
  const span = table.length;
  const wrapped = ((position % span) + span) % span;
  const index = Math.floor(wrapped);
  const fraction = wrapped - index;
  const from = table[index];
  const to = table[(index + 1) % span];
  return from + (to - from) * ((1 - Math.cos(fraction * Math.PI)) / 2);
}

export function diurnalWeight(hour: number): number {
  return interpolate(HOURLY_SHAPE, hour) / HOURLY_AVG;
}

function weeklyWeight(at: DateTime): number {
  const hourOfDay = at.hour + at.minute / 60;
  return interpolate(WEEKLY_SHAPE, at.weekday - 1 + (hourOfDay - 12) / 24);
}

export function distributeTotal(total: number, weights: number[]): number[] {
  if (weights.length === 0) {
    return [];
  }
  if (total <= 0) {
    return weights.map(() => 0);
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    return weights.map(() => 0);
  }
  const raw = weights.map((w) => (w / sum) * total);
  const floors = raw.map(Math.floor);
  const remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < remainder && k < order.length; k++) {
    result[order[k].i] += 1;
  }
  return result;
}

type WobbleTerm = { period: number; phase: number; amplitude: number };

const APP_BANDS: [number, number, number][] = [
  [5, 17, 0.06],
  [29, 71, 0.09],
  [150, 330, 0.07],
  [1100, 2100, 0.1],
];

const SERIES_BANDS: [number, number, number][] = [
  [3, 11, 0.05],
  [23, 53, 0.05],
  [70, 220, 0.045],
];

function wobbleTerms(
  seed: string,
  bands: [number, number, number][],
): WobbleTerm[] {
  return bands.map(([low, high, amplitude], i) => ({
    period: low + unitInterval(`${seed}:period:${i}`) * (high - low),
    phase: unitInterval(`${seed}:phase:${i}`) * Math.PI * 2,
    amplitude: amplitude * (0.7 + unitInterval(`${seed}:reach:${i}`) * 0.6),
  }));
}

function spanFactor(period: number, bucketHours: number): number {
  const turns = (bucketHours / period) * Math.PI;
  return turns < 1e-6 ? 1 : Math.sin(turns) / turns;
}

function wobbleAt(
  terms: WobbleTerm[],
  hours: number,
  bucketHours: number,
): number {
  let value = 1;
  for (const term of terms) {
    value +=
      term.amplitude *
      spanFactor(term.period, bucketHours) *
      Math.sin((hours / term.period) * Math.PI * 2 + term.phase);
  }
  return value;
}

type Incident = {
  period: number;
  offset: number;
  width: number;
  depth: number;
};

function incidentsOf(seed: string): Incident[] {
  return [
    {
      period: 170 + unitInterval(`${seed}:dip:period`) * 160,
      offset: unitInterval(`${seed}:dip:offset`),
      width: 1 + unitInterval(`${seed}:dip:width`) * 1.5,
      depth: -0.5,
    },
    {
      period: 210 + unitInterval(`${seed}:bump:period`) * 190,
      offset: unitInterval(`${seed}:bump:offset`),
      width: 1.2 + unitInterval(`${seed}:bump:width`) * 1.3,
      depth: 0.9,
    },
  ];
}

function incidentFactor(
  incidents: Incident[],
  hours: number,
  bucketHours: number,
): number {
  let factor = 1;
  for (const incident of incidents) {
    const width = Math.max(incident.width, bucketHours / 2);
    const depth = incident.depth * (incident.width / width);
    const cycles = hours / incident.period - incident.offset;
    const distance = Math.abs(cycles - Math.round(cycles)) * incident.period;
    if (distance < width) {
      const fade = (1 + Math.cos((distance / width) * Math.PI)) / 2;
      factor *= 1 + depth * fade;
    }
  }
  return factor;
}

type Shape = {
  app: WobbleTerm[];
  incidents: Incident[];
  series: WobbleTerm[];
};

function shapeFor(appSeed: string, seed: string): Shape {
  return {
    app: wobbleTerms(`app:${appSeed}`, APP_BANDS),
    incidents: incidentsOf(appSeed),
    series: wobbleTerms(`series:${seed}`, SERIES_BANDS),
  };
}

function rateAt(shape: Shape, at: DateTime, unit: Unit): number {
  const hours = at.toMillis() / 3_600_000;
  const span = BUCKET_HOURS[unit];
  const daily =
    unit === "minute" || unit === "hour"
      ? diurnalWeight(at.hour + at.minute / 60)
      : 1;
  const weekly = unit === "month" ? 1 : weeklyWeight(at);
  return (
    daily *
    weekly *
    wobbleAt(shape.app, hours, span) *
    wobbleAt(shape.series, hours, span) *
    incidentFactor(shape.incidents, hours, span)
  );
}

function poissonDraw(mean: number, next: () => number): number {
  const limit = Math.exp(-mean);
  let count = 0;
  let product = next();
  while (product > limit && count < 400) {
    product *= next();
    count += 1;
  }
  return count;
}

function gaussianDraw(next: () => number): number {
  const first = Math.max(next(), 1e-9);
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(Math.PI * 2 * next());
}

function pickIndex(cumulative: number[], value: number): number {
  let low = 0;
  let high = cumulative.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (value <= cumulative[mid]) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

function reconcile(
  values: number[],
  expected: number[],
  target: number,
  next: () => number,
): number[] {
  const result = [...values];
  let shortfall = target - result.reduce((a, b) => a + b, 0);
  const cumulative: number[] = [];
  let running = 0;
  for (const value of expected) {
    running += value;
    cumulative.push(running);
  }
  let attempts = Math.abs(shortfall) * 20 + 200;
  while (shortfall !== 0 && attempts > 0) {
    attempts -= 1;
    const index = pickIndex(cumulative, next() * running);
    if (shortfall > 0) {
      result[index] += 1;
      shortfall -= 1;
    } else if (result[index] > 0) {
      result[index] -= 1;
      shortfall += 1;
    }
  }
  const order = expected
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value)
    .map((entry) => entry.index);
  let step = 0;
  while (shortfall !== 0 && step < order.length * (Math.abs(shortfall) + 1)) {
    const index = order[step % order.length];
    if (shortfall > 0) {
      result[index] += 1;
      shortfall -= 1;
    } else if (result[index] > 0) {
      result[index] -= 1;
      shortfall += 1;
    }
    step += 1;
  }
  return result;
}

export function drawCounts(
  weights: number[],
  target: number,
  seed: string,
): number[] {
  if (weights.length === 0) {
    return [];
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  if (target <= 0 || sum <= 0) {
    return weights.map(() => 0);
  }
  const expected = weights.map((weight) => (weight / sum) * target);
  const next = randomStream(seed);
  const drawn = expected.map((mean) =>
    mean <= 0
      ? 0
      : mean < 30
        ? poissonDraw(mean, next)
        : Math.max(0, Math.round(mean + gaussianDraw(next) * Math.sqrt(mean))),
  );
  return reconcile(drawn, expected, target, next);
}

function keepEndsNonZero(values: number[], weights: number[]): void {
  for (const end of [0, values.length - 1]) {
    if (values[end] > 0 || weights[end] <= 0) {
      continue;
    }
    let donor = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i] > 1 && (donor < 0 || values[i] > values[donor])) {
        donor = i;
      }
    }
    if (donor >= 0) {
      values[donor] -= 1;
      values[end] += 1;
    }
  }
}

const REFERENCE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function overlapWith(
  range: SandboxRange,
  dataStart: DateTime,
): { from: DateTime; to: DateTime } {
  const now = DateTime.utc();
  return {
    from: range.from > dataStart ? range.from : dataStart,
    to: range.to < now ? range.to : now,
  };
}

type Unit = "minute" | "hour" | "day" | "month";

// The milliseconds of [from, to] weighted by the share of sessions that ran
// the versions a series stands for, so a version's series starts at its
// release and follows its adoption.
export type Adoption = (from: DateTime, to: DateTime) => number;

function spanWeight(from: DateTime, to: DateTime, adoption?: Adoption) {
  if (to <= from) {
    return 0;
  }
  return adoption ? adoption(from, to) : to.diff(from).as("milliseconds");
}

const BUCKET_HOURS: Record<Unit, number> = {
  minute: 1 / 60,
  hour: 1,
  day: 24,
  month: 730,
};

function unitFor(group: SandboxRange["group"]): Unit {
  return group === "minutes"
    ? "minute"
    : group === "hours"
      ? "hour"
      : group === "months"
        ? "month"
        : "day";
}

function sampleTime(bucket: DateTime, unit: Unit): DateTime {
  if (unit === "day") {
    return bucket.plus({ hours: 12 });
  }
  if (unit === "month") {
    return bucket.plus({ days: 15 });
  }
  return bucket;
}

export function windowCoverage(
  range: SandboxRange,
  dataStart: DateTime,
  adoption?: Adoption,
): number {
  const { from, to } = overlapWith(range, dataStart);
  return spanWeight(from, to, adoption) / REFERENCE_WINDOW_MS;
}

function bucketOverlaps(
  range: SandboxRange,
  dataStart: DateTime,
  adoption?: Adoption,
): number[] {
  const window = overlapWith(range, dataStart);
  const unit = unitFor(range.group);
  return bucketsForRange(range).map((bucket) => {
    const next = bucket.plus({ [unit]: 1 });
    const from = bucket > window.from ? bucket : window.from;
    const to = next < window.to ? next : window.to;
    return spanWeight(from, to, adoption) / REFERENCE_WINDOW_MS;
  });
}

function seriesFrom(
  range: SandboxRange,
  weights: number[],
  target: number,
  seed: string,
): { datetime: string; instances: number }[] {
  const buckets = bucketsForRange(range);
  const values = drawCounts(weights, target, `${seed}:counts`);
  if (target >= buckets.length) {
    keepEndsNonZero(values, weights);
  }
  return buckets.map((bucket, i) => ({
    datetime: formatBucket(bucket, range.group),
    instances: values[i],
  }));
}

export function scaledSeries(
  range: SandboxRange,
  total: number,
  dataStart: DateTime,
  seed: string,
  appSeed: string = seed,
  adoption?: Adoption,
): { datetime: string; instances: number }[] {
  const buckets = bucketsForRange(range);
  const unit = unitFor(range.group);
  const overlaps = bucketOverlaps(range, dataStart, adoption);
  const shape = shapeFor(appSeed, seed);
  const weights = buckets.map((bucket, i) =>
    overlaps[i] === 0
      ? 0
      : overlaps[i] * rateAt(shape, sampleTime(bucket, unit), unit),
  );
  const target = Math.round(total * windowCoverage(range, dataStart, adoption));
  return seriesFrom(range, weights, target, seed);
}

// Follows the base series bucket by bucket and sums to the target count.
export function derivedSeries(
  range: SandboxRange,
  target: number,
  dataStart: DateTime,
  seed: string,
  base: { instances: number }[],
): { datetime: string; instances: number }[] {
  const buckets = bucketsForRange(range);
  const unit = unitFor(range.group);
  const wobble = wobbleTerms(`series:${seed}`, SERIES_BANDS);
  const weights = buckets.map((bucket, i) => {
    const instances = base[i]?.instances ?? 0;
    if (instances <= 0) {
      return 0;
    }
    const hours = sampleTime(bucket, unit).toMillis() / 3_600_000;
    return instances * wobbleAt(wobble, hours, BUCKET_HOURS[unit]);
  });
  if (weights.every((weight) => weight <= 0)) {
    return seriesFrom(range, bucketOverlaps(range, dataStart), target, seed);
  }
  return seriesFrom(range, weights, target, seed);
}

const ROUGHNESS = 0.022;
const ROUGHNESS_LIMIT = 0.035;

export function smoothScales(
  seed: string,
  count: number,
  amplitude: number,
): number[] {
  const terms = [
    { period: 3, span: 3, weight: 0.24 },
    { period: 7, span: 9, weight: 0.28 },
    { period: 17, span: 23, weight: 0.28 },
    { period: 45, span: 95, weight: 0.26 },
  ].map((band, i) => ({
    period: band.period + unitInterval(`${seed}:wave:${i}`) * band.span,
    phase: unitInterval(`${seed}:offset:${i}`) * Math.PI * 2,
    weight: band.weight,
  }));
  const next = randomStream(`${seed}:walk`);
  const scales: number[] = [];
  let walk = 0;
  for (let i = 0; i < count; i++) {
    walk = walk * 0.8 + (next() - 0.5) * 0.6;
    let waves = 0;
    for (const term of terms) {
      waves +=
        term.weight * Math.sin((i / term.period) * Math.PI * 2 + term.phase);
    }
    const drift = Math.max(-1, Math.min(1, waves * 0.75 + walk * 0.45));
    const rough = Math.max(
      -ROUGHNESS_LIMIT,
      Math.min(ROUGHNESS_LIMIT, gaussianDraw(next) * ROUGHNESS),
    );
    scales.push(1 + amplitude * drift + rough);
  }
  return scales;
}
