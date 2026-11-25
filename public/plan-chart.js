"use strict";

const SwingChart = (() => {
  const series = [["2", "+2 %"], ["3", "+3 %"], ["4", "+4 %"], ["2r", "2R"], ["loss", "Pérdida al stop"]];
  const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
  const ratio = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inR = value => ratio.format(value) + " R";

  function formatPrice(value) {
    return value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 12 });
  }

  function renderPriceMap(section, input, plan, targetId) {
    const title = '<h3 id="price-map-title">Mapa de precios</h3>';
    if (!plan?.selected || !input.entry) {
      section.onclick = null;
      section.innerHTML = title + '<p class="note">Configura una entrada y un stop válido para situar los niveles.</p>';
      return;
    }

    const { selected, targets } = plan;
    const levels = [
      { id: "loss", label: "Stop", price: selected.stop, offset: -31 },
      { id: "entry", label: "Entrada", price: input.entry, offset: 0 },
      ...targets.map(({ id, label, target }, i) => ({ id, label, price: target, offset: -(i + 1) * 17 })),
    ];
    if (input.planSupport) levels.push({ id: "support", label: "Soporte", price: input.planSupport, offset: 21 });
    if (input.resistance) levels.push({ id: "resistance", label: "Resistencia", price: input.resistance, offset: 38 });
    levels.sort((a, b) => a.price - b.price);

    const low = levels[0].price;
    const high = levels.at(-1).price;
    const x = price => 24 + (price - low) / (high - low) * 394;
    const baseline = 83;
    section.innerHTML = title + '<p class="chart-help">Toca un nivel para consultar el precio y el resultado desde la entrada.</p>'
      + '<svg class="price-map-plot" viewBox="0 0 442 132" aria-hidden="true">'
      + '<line class="chart-zero" x1="14" x2="428" y1="' + baseline + '" y2="' + baseline + '"/>'
      + levels.map(({ id, price, offset }) => {
        const column = x(price);
        const row = baseline + offset;
        return '<g data-level="' + id + '" data-series="' + id + '">'
          + '<line x1="' + column + '" x2="' + column + '" y1="' + baseline + '" y2="' + row + '"/>'
          + '<circle cx="' + column + '" cy="' + row + '" r="5"/>'
          + '<circle class="map-hit" cx="' + column + '" cy="' + row + '" r="12"/></g>';
      }).join("")
      + '</svg><div class="map-levels">'
      + levels.map(({ id, label, price }) => '<button type="button" data-level="' + id + '" data-series="' + id
        + '"><span>' + label + '</span><strong>' + formatPrice(price) + ' ' + input.currency + '</strong></button>').join("")
      + '</div><p class="chart-details" role="status"></p>';

    const details = section.querySelector(".chart-details");
    function inspect(id) {
      const level = levels.find(candidate => candidate.id === id);
      const change = level.price - input.entry;
      const sizeAvailable = Number.isSafeInteger(selected.shares);
      const amount = sizeAvailable ? money.format(change * input.fx * selected.shares) : "importe fuera de rango";
      const move = ratio.format(100 * change / input.entry) + " %";
      details.textContent = level.label + " · " + formatPrice(level.price) + " " + input.currency
        + " · " + move + " · " + amount + " · " + inR(change / (input.entry - selected.stop));
      section.querySelectorAll("[data-level]").forEach(marker => {
        const selectedLevel = marker.dataset.level === id;
        marker.classList.toggle("is-active", selectedLevel);
        if (marker.tagName === "BUTTON") marker.setAttribute("aria-pressed", String(selectedLevel));
      });
    }

    section.onclick = event => {
      const level = event.target.closest("[data-level]");
      if (level) inspect(level.dataset.level);
    };
    inspect(targetId || "entry");
  }

  function render(section, input, settings, exploredAtr) {
    const title = '<h3 id="atr-chart-title">Beneficio y pérdida con stop por ATR</h3>';
    const current = input.planAtr && SwingFinance.atrScenario(input, input.planAtr);
    if (!current) {
      section.innerHTML = title + '<p class="note">Introduce un ATR y un multiplicador que den un stop válido para ver el gráfico.</p>';
      return;
    }

    const inRiskUnits = settings.unit === "r";
    const outcomeKey = inRiskUnits ? "ratios" : "outcomes";
    const formatOutcome = inRiskUnits ? inR : money.format;
    const threshold = inRiskUnits ? input.minimumRatio : undefined;
    const low = input.planAtr / 5;
    const high = Math.max(input.planAtr, Math.min(input.planAtr * 2, 0.999 * input.entry / input.planMultiplier));
    const steps = 1000;
    const atrAt = step => low + (high - low) * step / steps;
    const samples = Array.from({ length: 141 }, (_, i) => {
      const atr = atrAt(i * steps / 140);
      return SwingFinance.atrScenario(input, atr) ?? { atr, outcomes: {}, ratios: {} };
    });
    samples.push(current);
    samples.sort((a, b) => a.atr - b.atr);
    const amounts = samples.flatMap(sample => Object.values(sample[outcomeKey]));
    const bottom = Math.min(-0.01, ...amounts) * 1.1;
    const maxOutcome = Math.max(0.01, ...amounts);
    const thresholdInView = threshold !== undefined && threshold <= maxOutcome * 2;
    const top = Math.max(maxOutcome, thresholdInView ? threshold : 0) * 1.1;
    const x = atr => 61 + (atr - low) * 360 / (high - low);
    const y = amount => 12 + (top - amount) * 172 / (top - bottom);
    const activeSeries = series.filter(([id]) => samples.some(sample => sample[outcomeKey][id] !== undefined));

    function pathFor(id) {
      let draw = false;
      return samples.map(sample => {
        const amount = sample[outcomeKey][id];
        if (amount === undefined) {
          draw = false;
          return "";
        }
        const command = draw ? "L" : "M";
        draw = true;
        return command + x(sample.atr).toFixed(2) + " " + y(amount).toFixed(2);
      }).join(" ");
    }

    const grid = [bottom / 1.1, 0, top / 2.2, top / 1.1].map(amount => {
      const row = y(amount);
      const label = amount.toLocaleString("es-ES", { notation: "compact", maximumFractionDigits: 2 });
      return '<line class="' + (amount ? "chart-grid" : "chart-zero") + '" x1="61" x2="421" y1="' + row + '" y2="' + row
        + '"/><text x="55" y="' + (row + 4) + '" text-anchor="end">' + label + '</text>';
    }).join("");
    const ticks = [low, (low + high) / 2, high].map(atr => {
      const label = atr.toLocaleString("es-ES", { maximumSignificantDigits: 4 });
      return '<text x="' + x(atr) + '" y="203" text-anchor="middle">' + label + '</text>';
    }).join("");

    let thresholdNote = "";
    if (inRiskUnits) {
      thresholdNote = threshold === undefined ? "Define el beneficio/riesgo mínimo en Plan para marcar el umbral."
        : "Beneficio/riesgo mínimo " + inR(threshold) + (thresholdInView ? "" : " · Por encima de la escala");
      const objective = current.ratios[settings.targetId];
      if (threshold && objective !== undefined) {
        if (settings.targetId === "2r") {
          thresholdNote += threshold <= 2 ? " · 2R cumple el mínimo." : " · 2R queda por debajo del mínimo.";
        } else {
          const atrLimit = objective * (input.entry - current.stop) / (threshold * input.planMultiplier);
          const label = series.find(([id]) => id === settings.targetId)[1];
          thresholdNote += " · ATR máximo para " + label + " ≈ " + formatPrice(atrLimit) + " " + input.currency + ".";
        }
      }
    }

    section.innerHTML = '<header class="chart-heading">' + title
      + '<div class="chart-units" role="group" aria-label="Unidad del resultado">'
      + '<button type="button" data-unit="eur" aria-pressed="' + !inRiskUnits + '">Euros</button>'
      + '<button type="button" data-unit="r" aria-pressed="' + inRiskUnits + '">R</button></div></header>'
      + '<p class="chart-help">Toca o arrastra para explorar. La línea discontinua marca tu ATR.</p>'
      + '<svg class="chart-plot" viewBox="0 0 442 228" aria-hidden="true">'
      + '<text x="12" y="18">' + (inRiskUnits ? "R" : "€") + '</text>' + grid + ticks
      + (thresholdInView ? '<line class="chart-threshold" x1="61" x2="421" y1="' + y(threshold)
        + '" y2="' + y(threshold) + '"/>' : "")
      + '<text x="241" y="224" text-anchor="middle">ATR diario (' + input.currency + ')</text>'
      + '<line class="chart-current" x1="' + x(current.atr) + '" x2="' + x(current.atr) + '" y1="12" y2="184"/>'
      + activeSeries.map(([id]) => '<path data-series="' + id + '" d="' + pathFor(id) + '"/>').join("")
      + '<line class="chart-cursor" y1="12" y2="184"/>'
      + activeSeries.map(([id]) => '<circle data-series="' + id + '" r="4"/>').join("")
      + '</svg><label class="chart-slider">Explorar ATR <input type="range" min="0" max="' + steps + '"></label>'
      + '<p class="chart-details"></p><ul class="chart-readout">'
      + series.map(([id, label]) => '<li data-series="' + id + '"><span>' + label + '</span><output>—</output></li>').join("")
      + '</ul>' + (thresholdNote ? '<p class="chart-threshold-note">' + thresholdNote + '</p>' : "");

    const plot = section.querySelector("svg");
    const cursor = plot.querySelector(".chart-cursor");
    const slider = section.querySelector("input");
    const details = section.querySelector(".chart-details");
    const items = series.map(([id]) => ({
      id, dot: plot.querySelector('circle[data-series="' + id + '"]'),
      output: section.querySelector('li[data-series="' + id + '"] output'),
    }));

    let selectedAtr = current.atr;
    function select(atr) {
      selectedAtr = atr;
      const point = SwingFinance.atrScenario(input, atr);
      cursor.setAttribute("x1", x(atr));
      cursor.setAttribute("x2", x(atr));
      slider.value = Math.round((atr - low) * steps / (high - low));
      slider.setAttribute("aria-valuetext", formatPrice(atr) + " " + input.currency);
      details.textContent = "ATR " + formatPrice(atr) + " " + input.currency
        + (point ? " · Stop " + formatPrice(point.stop) + " " + input.currency + " · "
          + point.shares.toLocaleString("es-ES") + " acciones"
          + (point.twoRMove !== undefined ? " · 2R exige +" + ratio.format(point.twoRMove) + " %" : "")
          : " · Stop fuera del rango admitido");
      for (const { id, dot, output } of items) {
        const amount = point?.[outcomeKey][id];
        output.textContent = amount === undefined ? "—" : formatOutcome(amount);
        if (!dot) continue;
        dot.style.visibility = amount === undefined ? "hidden" : "";
        if (amount === undefined) continue;
        dot.setAttribute("cx", x(atr));
        dot.setAttribute("cy", y(amount));
      }
    }

    function selectAtPointer(event) {
      const transform = plot.getScreenCTM();
      if (!transform) return;
      const coordinate = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse()).x;
      const position = Math.max(0, Math.min(1, (coordinate - 61) / 360));
      select(Math.abs(coordinate - x(current.atr)) < 4 ? current.atr : atrAt(position * steps));
    }

    slider.addEventListener("input", () => select(atrAt(Number(slider.value))));
    plot.addEventListener("pointerdown", event => {
      plot.setPointerCapture(event.pointerId);
      selectAtPointer(event);
    });
    plot.addEventListener("pointermove", event => {
      if (event.pointerType === "mouse" || plot.hasPointerCapture(event.pointerId)) selectAtPointer(event);
    });
    section.querySelectorAll("[data-unit]").forEach(button => {
      button.addEventListener("click", () => {
        const unit = button.dataset.unit;
        if (unit === settings.unit) return;
        settings.saveUnit(unit);
        render(section, input, { ...settings, unit }, selectedAtr);
        section.querySelector('[data-unit="' + unit + '"]').focus();
      });
    });
    select(exploredAtr ?? current.atr);
  }

  return { render, renderPriceMap };
})();
