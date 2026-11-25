const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parse, position, atrStop, operationPlan, expectancy } = require("./public/finance.js");

const close = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-9);
const order = { capital: 10000, cash: 10000, risk: .75, entry: 25, stop: 24.35, target: 25.75, fx: 1 };

test("European numbers, decimal keyboard and malformed input", () => {
  assert.equal(parse("10.000,50"), 10000.5);
  assert.equal(parse("10 000,50"), 10000.5);
  assert.equal(parse("0.123"), .123);
  assert.equal(parse(",75"), .75);
  assert.ok(Number.isNaN(parse("1,2,3")));
});

test("Position sized by risk, liquidity and FX", () => {
  const result = position(order);
  assert.equal(result.shares, 115);
  assert.equal(result.cost, 2875);
  close(result.loss, 74.75);
  close(result.profit, 86.25);
  close(result.stopDistance, 2.6);
  close(result.returnRate, 3);
  close(result.ratio, .75 / .65);
  close(result.breakEven, 100 * .65 / 1.4);
  assert.equal(position({ ...order, cash: 249.99 }).shares, 9);
  assert.equal(position({ ...order, fx: .92 }).shares, 125);
  assert.equal(position({ ...order, cash: 0 }).shares, 0);
});

test("Exact boundaries and fractional shares", () => {
  const exact = { ...order, capital: 10000, risk: .3, cash: 750, stop: 24 };
  assert.equal(position(exact).shares, 30);
  assert.equal(position(exact).constraint, "Riesgo y liquidez");
  assert.equal(position({ ...exact, cash: 749.99999999999 }).shares, 29);
  assert.equal(position({ ...exact, risk: .29999999999999 }).shares, 29);
  assert.equal(position({ ...exact, entry: .00000003, stop: .00000002, fx: .7 }).shares, 4285714285);
});

test("ATR stop and support comparison", () => {
  const result = atrStop({ atrEntry: 25, atrValue: .45, multiplier: 2, support: 24.2 });
  close(result.stopPrice, 24.1);
  close(result.distance, 3.6);
  assert.match(result.supportMessage, /por debajo/);
});

test("Net expectancy and yearly projection including fees", () => {
  const sample = { capital: 10000, averageSize: 2500, winRate: 75, averageWin: 2.5, averageLoss: 3, trades: 8, fee: 0 };
  assert.deepEqual(expectancy(sample), {
    perTrade: 28.125, monthly: 225, yearly: 2700, annualReturn: 27, breakEven: 7500 / 137.5,
  });
  const paid = expectancy({ ...sample, fee: 2 });
  assert.equal(paid.yearly, 2508);
  close(expectancy({ ...sample, fee: 2, winRate: paid.breakEven }).perTrade, 0);
  assert.ok(expectancy({ ...sample, fee: 100 }).breakEven > 100);
});

test("Operation plan compares stops and targets and preserves transferred prices", () => {
  const input = {
    ...order, planAtr: .3, planMultiplier: 2, planSupport: 24.25,
    supportMargin: .5, resistance: 25.8, minimumRatio: 2,
  };
  const plan = operationPlan(input, "atr");
  assert.equal(plan.selected.stop, 24.4);
  assert.equal(plan.selected.shares, 125);
  assert.equal(plan.stops.length, 2);
  assert.deepEqual(plan.targets.map(candidate => candidate.target), [25.5, 25.75, 26, 26.2]);
  assert.deepEqual(plan.targets.map(candidate => candidate.meetsMinimum), [false, false, false, true]);
  assert.deepEqual(plan.targets.map(candidate => candidate.resistanceSide), [
    "Por debajo de la resistencia", "Por debajo de la resistencia",
    "Por encima de la resistencia", "Por encima de la resistencia",
  ]);
  assert.equal(operationPlan({ ...input, planAtr: undefined }, "atr").selected.id, "support");
  assert.equal(operationPlan({ ...input, cash: 100, fx: .8 }, "atr").selected.shares, 5);
  const { format } = new Intl.NumberFormat("es-ES", { useGrouping: false, maximumFractionDigits: 20 });
  for (const candidate of plan.targets) {
    const transferred = position({
      ...input, stop: parse(format(plan.selected.stop)), target: parse(format(candidate.target)),
    });
    assert.equal(transferred.profit, candidate.profit);
    assert.equal(transferred.loss, candidate.loss);
  }
});

test("ATR chart sizes every scenario independently and shows stop losses below zero", () => {
  const { atrScenario } = require("./public/finance.js");
  const input = { ...order, planMultiplier: 2, planSupport: 24.9, supportMargin: 0.5 };
  const narrow = atrScenario(input, 0.3);
  const wide = atrScenario(input, 0.6);
  assert.equal(narrow.stop, 24.4);
  assert.equal(narrow.shares, 125);
  close(narrow.outcomes["2"], 62.5);
  close(narrow.outcomes["3"], 93.75);
  close(narrow.outcomes["4"], 125);
  close(narrow.outcomes["2r"], 150);
  close(narrow.outcomes.loss, -75);
  close(narrow.ratios["3"], 1.25);
  close(wide.ratios["3"], 0.625);
  close(wide.ratios["2r"], 2);
  assert.equal(wide.ratios.loss, -1);
  close(wide.twoRMove, 9.6);
  assert.equal(wide.stop, 23.8);
  assert.equal(wide.shares, 62);
  close(wide.outcomes.loss, -74.4);
  close(wide.outcomes["2r"], -2 * wide.outcomes.loss);
  assert.equal(atrScenario({ ...input, cash: 50 }, 0.3).shares, 2);
  assert.equal(atrScenario(input, 12.5), null);
});
