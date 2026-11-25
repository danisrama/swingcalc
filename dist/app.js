"use strict";

const defaults = {
  planEntry: "25", planAtr: "0,30", planMultiplier: "2", planSupport: "", supportMargin: "0,5",
  resistance: "", minimumRatio: "", planStop: "atr", planTarget: "3",
  capital: "10.000", cash: "10.000", risk: "0,75", entry: "25", stop: "24,35", target: "25,75",
  currency: "EUR", fx: "", atrEntry: "25", atrValue: "0,45", multiplier: "2", support: "",
  averageSize: "2.500", winRate: "75", averageWin: "2,5", averageLoss: "3", trades: "8", fee: "0",
};
const storageKey = "swingcalc-v1";
let values = { ...defaults };
let active = "position";
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  for (const key of Object.keys(defaults)) {
    if (typeof saved?.values?.[key] === "string") values[key] = saved.values[key];
  }
  if (["position", "plan", "atr", "expectancy"].includes(saved?.active)) active = saved.active;
} catch {
  document.querySelector("#storage").textContent = "Guardado local no disponible";
}

const currencies = ["EUR", "USD", "GBP", "CHF", "CAD", "JPY", "SEK", "NOK", "AUD", "Otra"];
if (!currencies.includes(values.currency)) values.currency = "EUR";
const euro = new Intl.NumberFormat("es-ES", {style:"currency",currency:"EUR"});
const decimal = new Intl.NumberFormat("es-ES", {minimumFractionDigits:2,maximumFractionDigits:2});
const precise = new Intl.NumberFormat("es-ES", {minimumFractionDigits:2,maximumFractionDigits:8});
const count = new Intl.NumberFormat("es-ES", {maximumFractionDigits:0});
const percent = n => decimal.format(n) + " %";
const ratio = n => decimal.format(n) + " : 1";
const accountFields = [["capital","Capital operativo","€"],["cash","Liquidez disponible","€"],["risk","Riesgo máximo","%"]];
const currencyFields = [["currency","Divisa"],["fx","Euros por unidad","€"]];
const modules = {
  plan: {
    title:"Plan de operación", subtitle:"Calcula un stop candidato y compara objetivos para una compra.",
    groups:[
      ["Operación", [["planEntry","Precio de entrada","quote"],["planAtr","ATR diario","quote"],["planMultiplier","Multiplicador ATR","×"], ...currencyFields]],
      ["Niveles opcionales", [["planSupport","Soporte","quote"],["supportMargin","Margen bajo soporte","%"],["resistance","Resistencia","quote"],["minimumRatio","Beneficio/riesgo mínimo","R"]]],
      ["Cuenta compartida con Posición", accountFields],
    ],
    resultTitle:"Stop y objetivos",
    hero:["shares","Acciones máximas",count.format],
    metrics:[["cost","Capital necesario",euro.format],["loss","Pérdida potencial",n => euro.format(-n),"loss"],["profit","Beneficio potencial",euro.format,"gain"]],
    note:"Importes antes de costes. El stop puede ejecutarse a otro precio.",
  },
  position: {
    title:"Calculadora de posiciones", subtitle:"Dimensiona una compra con un stop y un objetivo.",
    groups:[
      ["Cuenta", accountFields],
      ["Operación", [["entry","Precio de entrada","quote"],["stop","Stop loss","quote"],["target","Precio objetivo","quote"], ...currencyFields]],
    ],
    resultTitle:"Tamaño de la posición", hero:["shares","Acciones máximas",count.format],
    metrics:[["cost","Capital necesario",euro.format],["loss","Pérdida potencial",n => euro.format(-n),"loss"],["profit","Beneficio potencial",euro.format,"gain"],["ratio","Beneficio / riesgo",ratio],["stopDistance","Distancia al stop",percent],["returnRate","Rentabilidad objetivo",percent],["breakEven","Aciertos de equilibrio",percent]],
    note:"Escenario de compra. Importes antes de costes. El stop puede ejecutarse a otro precio.",
  },
  atr: {
    title:"Calculadora ATR", subtitle:"Estima un stop según la volatilidad.",
    groups:[["Parámetros", [["atrEntry","Precio de entrada"],["atrValue","ATR"],["multiplier","Multiplicador ATR","×"],["support","Soporte técnico (opcional)"]]]],
    resultTitle:"Stop por volatilidad", hero:["stopPrice","Precio de stop orientativo",precise.format],
    metrics:[["distance","Distancia al stop",percent]],
    note:"Contrasta el ATR con la estructura técnica del precio. Usa la misma divisa para entrada, ATR y soporte.",
  },
  expectancy: {
    title:"Esperanza matemática", subtitle:"Simula el resultado de una serie de operaciones.",
    groups:[
      ["Cuenta y frecuencia", [["capital","Capital operativo","€"],["averageSize","Importe medio por operación","€"],["trades","Operaciones mensuales"],["fee","Coste total por operación","€"]]],
      ["Estadísticas", [["winRate","Aciertos","%"],["averageWin","Beneficio medio","%"],["averageLoss","Pérdida media","%"]]],
    ],
    resultTitle:"Simulación estadística", hero:["perTrade","Esperanza neta por operación",euro.format],
    metrics:[["monthly","Beneficio mensual esperado",euro.format],["yearly","Beneficio anual esperado",euro.format],["annualReturn","Rentabilidad anual sobre capital",percent],["breakEven","Aciertos de equilibrio",n => n > 100 ? percent(n) + " · inalcanzable" : percent(n)]],
    note:"Simulación estadística, sin valor predictivo. Proyección lineal con los mismos parámetros durante 12 meses y sin reinversión.",
  },
};

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ values, active }));
  } catch {
    document.querySelector("#storage").textContent = "Guardado local no disponible";
  }
}

function field([key, label, unit]) {
  const control = key === "currency"
    ? '<select id="currency">' + currencies.map(code => '<option>' + code + '</option>').join("") + '</select>'
    : '<input type="text" id="' + key + '" inputmode="' + (key === "trades" ? "numeric" : "decimal") + '" autocomplete="off" spellcheck="false" maxlength="24">';
  return '<label class="field" data-field="' + key + '"' + (unit === "quote" ? ' data-quote' : '') + '><span>' + label + '</span><span class="control">' + control
    + (unit ? '<span class="unit" aria-hidden="true">' + (unit === "quote" ? "" : unit) + '</span>' : "")
    + '</span></label>';
}

function mount() {
  const model = modules[active];
  document.querySelectorAll("[data-tab]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.tab === active));
  });
  document.querySelector("#workspace").innerHTML =
    '<div class="intro"><h2>' + model.title + '</h2><p>' + model.subtitle + '</p></div>'
    + '<div class="deck"><section class="inputs" aria-label="Datos de entrada">'
    + model.groups.map(([name, keys]) => '<fieldset><legend>' + name + '</legend><div class="fields">' + keys.map(field).join("") + '</div></fieldset>').join("")
    + '</section><section class="results" aria-label="Resultados"><h3>' + model.resultTitle + '</h3>'
    + (active === "plan" ? '<div id="plan-choices"></div>' : "")
    + '<div class="display"><span>' + model.hero[1] + '</span><output data-result="' + model.hero[0] + '">—</output></div>'
    + '<p class="status" role="status"></p><dl>'
    + model.metrics.map(([key, label, , tone]) => '<div><dt>' + label + '</dt><dd class="' + (tone || "") + '" data-result="' + key + '">—</dd></div>').join("")
    + '</dl>' + (active === "plan" ? '<button class="plan-transfer" type="button" disabled>Usar en Posición</button>' : "")
    + '<p class="note">' + model.note + '</p></section></div>';
  document.querySelectorAll("input, select").forEach(control => {
    control.value = values[control.id];
    control.addEventListener("input", () => {
      values[control.id] = control.value;
      save();
      update();
    });
  });
  update();
}

function update() {
  const input = {};
  const errors = [];
  const model = modules[active];
  const fxField = document.querySelector('[data-field="fx"]');
  if (fxField) {
    fxField.hidden = values.currency === "EUR";
    document.querySelectorAll('[data-quote] .unit')
      .forEach(unit => { unit.textContent = values.currency; });
  }

  function invalidate(key, message) {
    document.getElementById(key).setAttribute("aria-invalid", "true");
    errors.push(message);
  }

  for (const [, fields] of model.groups) {
    for (const [key, label] of fields) {
      if (key === "currency") continue;
      const control = document.getElementById(key);
      control.removeAttribute("aria-invalid");
      if (key === "fx" && values.currency === "EUR") {
        input.fx = 1;
        continue;
      }
      const optional = ["support", "planAtr", "planSupport", "resistance", "minimumRatio"].includes(key);
      const unused = (key === "planMultiplier" && !values.planAtr.trim())
        || (key === "supportMargin" && !values.planSupport.trim());
      if (unused || (optional && !values[key].trim())) continue;
      const value = SwingFinance.parse(values[key]);
      const zeroAllowed = ["cash", "risk", "winRate", "trades", "fee", "averageWin", "averageLoss"].includes(key);
      const max = ["risk", "winRate", "averageLoss", "supportMargin"].includes(key) ? 100 : 1e12;
      if (!Number.isFinite(value) || value < 0 || (!zeroAllowed && value < 1e-9) || value > max
          || (key === "trades" && !Number.isInteger(value))) {
        const requirement = max === 100 ? "introduce un valor entre 0 y 100."
          : key === "trades" ? "introduce un número entero mayor o igual que cero."
            : zeroAllowed ? "introduce un importe mayor o igual que cero."
              : "introduce un valor positivo válido.";
        invalidate(key, label + " · " + requirement);
      }
      input[key] = value;
    }
  }

  if (active === "plan") {
    renderPlan({}, input);
    document.querySelector('[data-field="planMultiplier"]').hidden = !values.planAtr.trim();
    document.querySelector('[data-field="supportMargin"]').hidden = !values.planSupport.trim();
    if (input.supportMargin === 100) invalidate("supportMargin", "El margen debe ser inferior al 100 %.");
    if (input.planSupport >= input.planEntry) invalidate("planSupport", "El soporte debe quedar por debajo de la entrada.");
    if (input.resistance <= input.planEntry) invalidate("resistance", "La resistencia debe quedar por encima de la entrada.");
  }
  let result;
  let message = "";
  if (!errors.length) {
    if (active === "position") {
      if (input.stop >= input.entry) invalidate("stop", "El stop debe quedar por debajo de la entrada.");
      if (input.target <= input.entry) invalidate("target", "El objetivo debe quedar por encima de la entrada.");
      if (!errors.length) {
        result = SwingFinance.position(input);
        if (!Number.isSafeInteger(result.shares)) {
          result = undefined;
          errors.push("Las cifras superan la precisión disponible para acciones enteras.");
        } else {
          message = (result.shares ? "Límite · " + result.constraint : "Sin margen para una acción")
            + " · Riesgo máximo " + euro.format(result.budget);
        }
      }
    } else if (active === "plan") {
      const plan = SwingFinance.operationPlan({ ...input, entry: input.planEntry }, values.planStop);
      result = renderPlan(plan, input);
      if (!plan.selected) {
        errors.push(input.planAtr || input.planSupport
          ? "Los parámetros no producen un stop válido por debajo de la entrada."
          : "Introduce el ATR diario o un soporte para calcular un stop.");
      } else if (!plan.targets.length) {
        errors.push("La entrada no permite calcular un objetivo en el rango admitido.");
      } else if (!result) {
        errors.push("Las cifras superan la precisión disponible para acciones enteras.");
      }
    } else if (active === "atr") {
      result = SwingFinance.atrStop(input);
      if (result.stopPrice <= 0) {
        result = undefined;
        invalidate("multiplier", "El stop calculado es cero o negativo. Reduce el ATR o el multiplicador.");
      } else if (input.support >= input.atrEntry) {
        result = undefined;
        invalidate("support", "El soporte debe quedar por debajo de la entrada.");
      } else {
        message = result.supportMessage;
      }
    } else if (input.averageWin + input.averageLoss === 0) {
      invalidate("averageWin", "Introduce un beneficio o una pérdida media superior a cero.");
    } else {
      result = SwingFinance.expectancy(input);
    }
  }
  const status = document.querySelector(".status");
  status.textContent = errors[0] || message;
  status.hidden = !status.textContent;
  status.classList.toggle("error", Boolean(errors.length));
  for (const [key, , format] of [model.hero, ...model.metrics]) {
    document.querySelector('[data-result="' + key + '"]').textContent = result ? format(result[key]) : "—";
  }
}

const transferPrice = new Intl.NumberFormat("es-ES", { useGrouping:false, maximumFractionDigits:20 });
const planPrice = value => transferPrice.format(value) + " " + values.currency;

function renderPlan({ stops = [], selected, targets = [] }, input) {
  const choices = document.querySelector("#plan-choices");
  const transfer = document.querySelector(".plan-transfer");
  const objective = targets.find(candidate => candidate.id === values.planTarget) || targets[0];
  const result = Number.isSafeInteger(objective?.shares) ? objective : undefined;
  transfer.disabled = !result;
  transfer.onclick = result ? () => {
    values.entry = values.planEntry;
    values.stop = transferPrice.format(selected.stop);
    values.target = transferPrice.format(result.target);
    active = "position";
    save();
    mount();
    document.querySelector('[data-tab="position"]').focus();
  } : null;
  if (!selected) {
    choices.replaceChildren();
    return;
  }

  function group(label, options, selectedId, key, describe) {
    return '<fieldset class="plan-options"><legend>' + label + '</legend>'
      + options.map(option => '<button type="button" data-choice="' + key + '" data-id="' + option.id
        + '" aria-pressed="' + (option.id === selectedId) + '">' + describe(option) + '</button>').join("")
      + '</fieldset>';
  }

  choices.innerHTML = group("Stops candidatos", stops, selected.id, "planStop", option =>
    '<strong>' + option.label + ' · ' + planPrice(option.stop) + '</strong><span>'
    + percent(option.stopDistance) + ' de distancia · '
    + (Number.isSafeInteger(option.shares) ? count.format(option.shares) + ' acciones' : 'Tamaño fuera de rango')
    + '</span>' + (option.id === "atr" && option.stop > input.planSupport
      ? '<span class="plan-warning">Por encima del soporte</span>' : ''))
    + group("Objetivos candidatos", targets, objective?.id, "planTarget", option =>
      '<strong>' + option.label + ' · ' + planPrice(option.target) + '</strong><span>'
      + ratio(option.ratio) + (option.resistanceSide ? ' · ' + option.resistanceSide : '') + '</span>'
      + (option.meetsMinimum ? '' : '<span class="plan-warning">Por debajo del beneficio/riesgo mínimo</span>'));

  if (input.resistance && input.minimumRatio && targets.length && !targets.some(option =>
    option.target <= input.resistance && option.meetsMinimum)) {
    choices.insertAdjacentHTML("beforeend", '<p class="plan-warning">Ningún objetivo hasta la resistencia alcanza el beneficio/riesgo mínimo.</p>');
  }
  choices.querySelectorAll("[data-choice]").forEach(button => {
    button.addEventListener("click", () => {
      const { choice, id } = button.dataset;
      values[choice] = id;
      save();
      update();
      choices.querySelector('[data-choice="' + choice + '"][data-id="' + id + '"]')?.focus();
    });
  });
  return result;
}

document.querySelectorAll("[data-tab]").forEach(button => {
  button.addEventListener("click", () => {
    if (active === button.dataset.tab) return;
    active = button.dataset.tab;
    save();
    mount();
  });
});
const dialog = document.querySelector("#reset-dialog");
document.querySelector("#reset").addEventListener("click", () => {
  dialog.returnValue = "";
  dialog.showModal();
});
dialog.addEventListener("close", () => {
  if (dialog.returnValue !== "confirm") return;
  values = { ...defaults };
  save();
  mount();
});
mount();

if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./sw.js").then(() => navigator.serviceWorker.ready).then(() => {
    document.querySelector("#offline").textContent = "Disponible sin conexión";
  }).catch(() => {});
}
