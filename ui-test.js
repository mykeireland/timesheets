document.addEventListener("DOMContentLoaded", () => {
  const stdInput = document.getElementById("hoursStd");
  const h15Input = document.getElementById("hours15");
  const h2Input = document.getElementById("hours2");

  const workedOut = document.getElementById("workedHours");
  const totalOut = document.getElementById("totalHours");

  const recalc = () => {
    const s = parseFloat(stdInput.value) || 0;
    const h15 = parseFloat(h15Input.value) || 0;
    const h2 = parseFloat(h2Input.value) || 0;

    const worked = s + h15 + h2;
    const total = s + (h15 * 1.5) + (h2 * 2);

    workedOut.textContent = worked.toFixed(2);
    totalOut.textContent = total.toFixed(2);
  };

  stdInput.addEventListener("input", recalc);
  h15Input.addEventListener("input", recalc);
  h2Input.addEventListener("input", recalc);

  recalc(); // initial
});
