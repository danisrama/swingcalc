"use strict";

const SwingFinance = (() => {
  function parse(raw) {
    const value = raw.trim().replace(/[\s\u00a0\u202f]/g, "");
    if (/^[1-9]\d{0,2}(\.\d{3})+(,\d*)?$/.test(value)) {
      return Number(value.replaceAll(".", "").replace(",", "."));
    }
    if (/^(\d+([.,]\d*)?|[.,]\d+)$/.test(value)) {
      return Number(value.replace(",", "."));
    }
    return NaN;
  }

  function position({ capital, cash, risk, entry, stop, target, fx }) {
    const down = entry - stop;
    const up = target - entry;
    const budget = capital * (risk / 100);
    // Work in scaled decimal integers so a rounding error cannot buy an extra share.
    const parts = [capital, cash, risk, entry, stop, fx].map(value => {
      const [mantissa, exponent = "0"] = String(value).split("e");
      const [whole, fraction = ""] = mantissa.split(".");
      return { digits: BigInt(whole + fraction), places: fraction.length - Number(exponent) };
    });
    const places = Math.max(0, ...parts.map(part => part.places));
    const scale = 10n ** BigInt(places);
    const [capitalInt, cashInt, riskInt, entryInt, stopInt, fxInt] =
      parts.map(part => part.digits * 10n ** BigInt(places - part.places));
    const riskNumerator = capitalInt * riskInt;
    const riskDenominator = 100n * (entryInt - stopInt) * fxInt;
    const cashNumerator = cashInt * scale;
    const cashDenominator = entryInt * fxInt;
    const riskComparison = riskNumerator * cashDenominator - cashNumerator * riskDenominator;
    const shares = Number(riskComparison <= 0n
      ? riskNumerator / riskDenominator : cashNumerator / cashDenominator);
    return {
      shares, budget, cost: shares * (entry * fx), loss: shares * (down * fx),
      profit: shares * (up * fx), stopDistance: 100 * down / entry,
      returnRate: 100 * up / entry, ratio: up / down, breakEven: 100 * down / (down + up),
      constraint: riskComparison === 0n
        ? "Riesgo y liquidez" : riskComparison < 0n ? "Riesgo" : "Liquidez",
    };
  }

  function atrStop({ atrEntry, atrValue, multiplier, support }) {
    const stopPrice = atrEntry - atrValue * multiplier;
    return {
      stopPrice, distance: 100 * (atrEntry - stopPrice) / atrEntry,
      supportMessage: Number.isFinite(support)
        ? stopPrice > support ? "El stop ATR queda por encima del soporte."
          : stopPrice < support ? "El stop ATR queda por debajo del soporte."
            : "El stop ATR coincide con el soporte."
        : "",
    };
  }

  function operationPlan(input, stopChoice) {
    const { entry, planAtr, planMultiplier, planSupport, supportMargin, resistance, minimumRatio } = input;
    // Remove floating-point tails before sizing or transferring generated prices.
    const price = value => Number(value.toPrecision(15));
    const stops = [
      { id: "atr", label: "Por ATR", stop: price(atrStop({
        atrEntry: entry, atrValue: planAtr, multiplier: planMultiplier,
      }).stopPrice) },
      { id: "support", label: "Bajo soporte", stop: price(planSupport * (1 - supportMargin / 100)) },
    ].filter(({ stop }) => stop >= 1e-9 && stop < entry).map(candidate => ({
      ...candidate,
      ...position({ ...input, stop: candidate.stop, target: entry }),
    }));
    const selected = stops.find(candidate => candidate.id === stopChoice) || stops[0];
    if (!selected) return { stops, targets: [] };

    const { stop } = selected;
    const targets = [
      ...[2, 3, 4].map(percent => ({
        id: String(percent), label: "+" + percent + " %", target: price(entry * (1 + percent / 100)),
      })),
      { id: "2r", label: "2R", target: price(entry + 2 * (entry - stop)) },
    ].filter(({ target }) => target > entry && target <= 1e12).map(candidate => {
      const result = position({ ...input, stop, target: candidate.target });
      const resistanceSide = resistance === undefined ? ""
        : candidate.target < resistance ? "Por debajo de la resistencia"
          : candidate.target > resistance ? "Por encima de la resistencia" : "En la resistencia";
      const meetsMinimum = minimumRatio === undefined
        || result.ratio >= minimumRatio - Number.EPSILON * 16 * Math.max(1, minimumRatio);
      return { ...candidate, ...result, resistanceSide, meetsMinimum };
    });
    return { stops, selected, targets };
  }

  function atrScenario(input, atr) {
    const { selected, targets } = operationPlan({
      ...input, planAtr: atr, planSupport: undefined,
    }, "atr");
    if (!selected || !Number.isSafeInteger(selected.shares)) return null;
    return {
      atr, stop: selected.stop, shares: selected.shares,
      ratios: Object.fromEntries([...targets.map(({ id, ratio }) => [id, ratio]), ["loss", -1]]),
      twoRMove: targets.find(({ id }) => id === "2r")?.returnRate,
      outcomes: Object.fromEntries([
        ...targets.map(({ id, profit }) => [id, profit]),
        ["loss", selected.loss ? -selected.loss : 0],
      ]),
    };
  }

  function expectancy({ capital, averageSize, winRate, averageWin, averageLoss, trades, fee }) {
    const win = averageSize * averageWin / 100;
    const loss = averageSize * averageLoss / 100;
    const p = winRate / 100;
    const perTrade = p * win - (1 - p) * loss - fee;
    const monthly = perTrade * trades;
    const yearly = monthly * 12;
    return {
      perTrade, monthly, yearly, annualReturn: 100 * yearly / capital,
      breakEven: 100 * (loss + fee) / (win + loss),
    };
  }

  return { parse, position, atrStop, operationPlan, atrScenario, expectancy };
})();

if (typeof module !== "undefined") module.exports = SwingFinance;
