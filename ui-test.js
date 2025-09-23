document.addEventListener("DOMContentLoaded", () => {
  const hourOptions = [...Array(13).keys()]; // 0-12
  const minuteOptions = [0, 15, 30, 45];

  function fillSelect(id, options) {
    const el = document.getElementById(id);
    options.forEach(val => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val.toString().padStart(2, '0');
      el.appendChild(opt);
    });
  }

  fillSelect("stdHour", hourOptions);
  fillSelect("stdMin", minuteOptions);
  fillSelect("h15Hour", hourOptions);
  fillSelect("h15Min", minuteOptions);
  fillSelect("h2Hour", hourOptions);
  fillSelect("h2Min", minuteOptions);

  const els = {
    stdHour: document.getElementById("stdHour"),
    stdMin: document.getElementById("stdMin"),
    h15Hour: document.getElementById("h15Hour"),
    h15Min: document.getElementById("h15Min"),
    h2Hour: document.getElementById("h2Hour"),
    h2Min: document.getElementById("h2Min"),
    workedOut: document.getElementById("workedHours"),
    totalOut: document.getElementById("totalHours"),
  };

 const recalc = () => {
  const h = (hr, min) => parseInt(hr.value || 0) + (parseInt(min.value || 0) / 60);

  const std = h(els.stdHour, els.stdMin);
  const h15 = h(els.h15Hour, els.h15Min);
  const h2 = h(els.h2Hour, els.h2Min);

  const worked = std + h15 + h2;
  const total = std + (h15 * 1.5) + (h2 * 2);

  // Convert decimal hours to "H:MM" string
  const toTimeStr = (val) => {
    const hrs = Math.floor(val);
    const mins = Math.round((val - hrs) * 60);
    return `${hrs}:${mins.toString().padStart(2, "0")}`;
  };

  els.workedOut.textContent = toTimeStr(worked);
  els.totalOut.textContent = toTimeStr(total);
};

  // Attach event listeners
  Object.values(els).forEach(el => {
    if (el.tagName === "SELECT") el.addEventListener("change", recalc);
  });

  recalc();
});
