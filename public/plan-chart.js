"use strict";

const SwingChart = (() => {
  const series = [["2", "+2 %"], ["3", "+3 %"], ["4", "+4 %"], ["2r", "2R"], ["loss", "Pérdida al stop"]];
  const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
  function formatPrice(value) {
    return value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 12 });
  }

  function render(section, input) {
    const title = '<h3 id="atr-chart-title">Beneficio y pérdida con stop por ATR</h3>';
    const current = input.planAtr && SwingFinance.atrScenario(input, input.planAtr);
    if (!current) {
      section.innerHTML = title + '<p class="note">Introduce un ATR y un multiplicador que den un stop válido para ver el gráfico.</p>';
      return;
    }

    const low = input.planAtr / 5;
    const high = Math.max(input.planAtr, Math.min(input.planAtr * 2, 0.999 * input.entry / input.planMultiplier));
    const steps = 1000;
    const atrAt = step => low + (high - low) * step / steps;
    const samples = Array.from({ length: 141 }, (_, i) => {
      const atr = atrAt(i * steps / 140);
      return SwingFinance.atrScenario(input, atr) ?? { atr, outcomes: {} };
    });
    samples.push(current);
    samples.sort((a, b) => a.atr - b.atr);
    const amounts = samples.flatMap(sample => Object.values(sample.outcomes));
    const bottom = Math.min(-0.01, ...amounts) * 1.1;
    const top = Math.max(0.01, ...amounts) * 1.1;
    const x = atr => 61 + (atr - low) * 360 / (high - low);
    const y = amount => 12 + (top - amount) * 172 / (top - bottom);
    const activeSeries = series.filter(([id]) => samples.some(sample => sample.outcomes[id] !== undefined));

    function pathFor(id) {
      let draw = false;
      return samples.map(sample => {
        const amount = sample.outcomes[id];
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

    section.innerHTML = title
      + '<p class="chart-help">Toca o arrastra para explorar. La línea discontinua marca tu ATR.</p>'
      + '<svg class="chart-plot" viewBox="0 0 442 228" aria-hidden="true">'
      + '<text x="12" y="18">€</text>' + grid + ticks
      + '<text x="241" y="224" text-anchor="middle">ATR diario (' + input.currency + ')</text>'
      + '<line class="chart-current" x1="' + x(current.atr) + '" x2="' + x(current.atr) + '" y1="12" y2="184"/>'
      + activeSeries.map(([id]) => '<path data-series="' + id + '" d="' + pathFor(id) + '"/>').join("")
      + '<line class="chart-cursor" y1="12" y2="184"/>'
      + activeSeries.map(([id]) => '<circle data-series="' + id + '" r="4"/>').join("")
      + '</svg><label class="chart-slider">Explorar ATR <input type="range" min="0" max="' + steps + '"></label>'
      + '<p class="chart-details"></p><ul class="chart-readout">'
      + series.map(([id, label]) => '<li data-series="' + id + '"><span>' + label + '</span><output>—</output></li>').join("")
      + '</ul>';

    const plot = section.querySelector("svg");
    const cursor = plot.querySelector(".chart-cursor");
    const slider = section.querySelector("input");
    const details = section.querySelector(".chart-details");
    const items = series.map(([id]) => ({
      id, dot: plot.querySelector('circle[data-series="' + id + '"]'),
      output: section.querySelector('li[data-series="' + id + '"] output'),
    }));

    function select(atr) {
      const point = SwingFinance.atrScenario(input, atr);
      cursor.setAttribute("x1", x(atr));
      cursor.setAttribute("x2", x(atr));
      slider.value = Math.round((atr - low) * steps / (high - low));
      slider.setAttribute("aria-valuetext", formatPrice(atr) + " " + input.currency);
      details.textContent = "ATR " + formatPrice(atr) + " " + input.currency
        + (point ? " · Stop " + formatPrice(point.stop) + " " + input.currency + " · "
          + point.shares.toLocaleString("es-ES") + " acciones" : " · Stop fuera del rango admitido");
      for (const { id, dot, output } of items) {
        const amount = point?.outcomes[id];
        output.textContent = amount === undefined ? "—" : money.format(amount);
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
    select(current.atr);
  }

  return { render };
})();
