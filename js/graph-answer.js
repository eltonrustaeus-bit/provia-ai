(function () {
  "use strict";
  var MIN = -5, MAX = 5, NS = "http://www.w3.org/2000/svg";

  function configFor(value) {
    if (value && value.mode === "scatter" && value.point_count === 3
      && typeof value.x_label === "string" && typeof value.y_label === "string") {
      return { mode: "scatter", count: 3, xLabel: value.x_label, yLabel: value.y_label };
    }
    return { mode: "line", count: 2, xLabel: "x", yLabel: "y" };
  }
  function emptyDraft(count) {
    return Array.from({ length: count }, function () { return { x: null, y: null }; });
  }
  function validPoint(point) {
    return point && Number.isInteger(point.x) && point.x >= MIN && point.x <= MAX
      && Number.isInteger(point.y) && point.y >= MIN && point.y <= MAX;
  }
  function read(raw, config) {
    try {
      var v = JSON.parse(raw || "null");
      var expectedType = config.mode === "scatter" ? "scatter" : "line";
      if (!v || v.type !== expectedType || !Array.isArray(v.points) || v.points.length !== config.count) return emptyDraft(config.count);
      return v.points.map(function (point) {
        if (!point || typeof point !== "object") return { x: null, y: null };
        return {
          x: Number.isInteger(point.x) && point.x >= MIN && point.x <= MAX ? point.x : null,
          y: Number.isInteger(point.y) && point.y >= MIN && point.y <= MAX ? point.y : null
        };
      });
    } catch (_) { return emptyDraft(config.count); }
  }

  window.ExGenGraphAnswer = function (root, initial, onChange, lang, displayConfig) {
    var english = lang === "en", config = configFor(displayConfig);
    var letter = function (i) { return String.fromCharCode(65 + i); };
    var text = english ? {
      lineGraph: "Coordinate grid from minus five to five. Choose point A or B and click the graph.",
      scatterGraph: "Coordinate grid from minus five to five. Choose point A, B or C and plot each data point.",
      lineHint: "Choose A or B and click the graph. You can also enter coordinates.",
      scatterHint: "Choose a point, then click the graph or enter its coordinates. Plot each table row once.",
      point: "Point ", x: "x-coordinate", y: "y-coordinate", clear: "Clear points",
      coordinateError: "Enter a whole number from -5 to 5 for each coordinate.",
      keyboard: "Use arrow keys to move and Enter or Space to plot the selected point.",
      cursor: "cursor", placed: "plotted", selected: "selected"
    } : {
      lineGraph: "Koordinatsystem från minus fem till fem. Välj punkt A eller B och tryck i grafen.",
      scatterGraph: "Koordinatsystem från minus fem till fem. Välj punkt A, B eller C och placera varje datapunkt.",
      lineHint: "Välj A eller B och tryck på grafen. Du kan också skriva koordinaterna.",
      scatterHint: "Välj en punkt och tryck i grafen eller skriv koordinaterna. Placera varje tabellrad en gång.",
      point: "Punkt ", x: "x-koordinat", y: "y-koordinat", clear: "Rensa punkter",
      coordinateError: "Ange heltal mellan −5 och 5 för varje koordinat.",
      keyboard: "Flytta med piltangenterna och placera vald punkt med Enter eller mellanslag.",
      cursor: "markör", placed: "placerad", selected: "vald"
    };
    var scatter = config.mode === "scatter";
    var description = scatter ? text.scatterGraph : text.lineGraph;
    var draft = read(initial, config);
    var points = draft.map(function (p) { return validPoint(p) ? { x: p.x, y: p.y } : null; });
    var active = 0;
    var cursor = { x: 0, y: 0 };
    var hidden = document.createElement("input");
    hidden.type = "hidden"; hidden.className = "graphAnswer"; hidden.value = initial || "";

    var tabs = document.createElement("div"); tabs.className = "graph-point-tabs";
    var pointButtons = draft.map(function (_, i) {
      var button = document.createElement("button"); button.type = "button";
      button.addEventListener("click", function () {
        active = i;
        if (points[i]) cursor = { x: points[i].x, y: points[i].y };
        paint();
        announce(text.point + letter(i) + " " + text.selected + ". " + cursorText());
      });
      tabs.appendChild(button); return button;
    });
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 264 264"); svg.setAttribute("role", "button");
    svg.setAttribute("tabindex", "0");
    svg.setAttribute("aria-label", description + " " + text.keyboard);
    var grid = document.createElementNS(NS, "g"); grid.setAttribute("class", "graph-grid");
    for (var n = MIN; n <= MAX; n++) {
      var x = 12 + (n - MIN) * 24, y = 12 + (MAX - n) * 24;
      var vx = document.createElementNS(NS, "line"); vx.setAttribute("x1", x); vx.setAttribute("x2", x); vx.setAttribute("y1", 12); vx.setAttribute("y2", 252); grid.appendChild(vx);
      var hy = document.createElementNS(NS, "line"); hy.setAttribute("x1", 12); hy.setAttribute("x2", 252); hy.setAttribute("y1", y); hy.setAttribute("y2", y); grid.appendChild(hy);
    }
    svg.appendChild(grid);
    var labels = document.createElementNS(NS, "g"); labels.setAttribute("class", "graph-tick-labels");
    for (var tick = MIN; tick <= MAX; tick++) {
      var labelX = document.createElementNS(NS, "text");
      labelX.setAttribute("x", 12 + (tick - MIN) * 24); labelX.setAttribute("y", 145);
      labelX.setAttribute("text-anchor", tick === MIN ? "start" : tick === MAX ? "end" : "middle");
      labelX.textContent = tick < 0 ? "−" + Math.abs(tick) : String(tick); labels.appendChild(labelX);
      if (tick !== 0) {
        var labelY = document.createElementNS(NS, "text");
        labelY.setAttribute("x", 127); labelY.setAttribute("y", 12 + (MAX - tick) * 24 + 2.5);
        labelY.setAttribute("text-anchor", "end"); labelY.textContent = tick < 0 ? "−" + Math.abs(tick) : String(tick); labels.appendChild(labelY);
      }
    }
    var xName = document.createElementNS(NS, "text"); xName.setAttribute("x", 256); xName.setAttribute("y", 135); xName.setAttribute("class", "graph-axis-name"); xName.textContent = "x"; labels.appendChild(xName);
    var yName = document.createElementNS(NS, "text"); yName.setAttribute("x", 137); yName.setAttribute("y", 17); yName.setAttribute("class", "graph-axis-name"); yName.textContent = "y"; labels.appendChild(yName);
    svg.appendChild(labels);
    var axes = document.createElementNS(NS, "g"); axes.setAttribute("class", "graph-axes");
    [[12,132,252,132],[132,12,132,252]].forEach(function (a) {
      var line = document.createElementNS(NS, "line");
      line.setAttribute("x1",a[0]);line.setAttribute("y1",a[1]);line.setAttribute("x2",a[2]);line.setAttribute("y2",a[3]);axes.appendChild(line);
    });
    svg.appendChild(axes);
    var segment = document.createElementNS(NS, "line"); segment.setAttribute("class", "graph-student-line"); svg.appendChild(segment);
    var marks = draft.map(function (_, i) {
      var g = document.createElementNS(NS, "g"); g.setAttribute("class", "graph-mark");
      var circle = document.createElementNS(NS, "circle"); circle.setAttribute("r", "6"); g.appendChild(circle);
      var label = document.createElementNS(NS, "text"); label.textContent = letter(i); g.appendChild(label);
      svg.appendChild(g); return g;
    });
    var cursorMark = document.createElementNS(NS, "g"); cursorMark.setAttribute("class", "graph-cursor");
    cursorMark.setAttribute("visibility", "hidden");
    var cursorRing = document.createElementNS(NS, "circle"); cursorRing.setAttribute("r", "8");
    cursorMark.appendChild(cursorRing); svg.appendChild(cursorMark);
    root.classList.add("graph-answer");
    if (scatter) root.classList.add("graph-answer--scatter");
    var hint = document.createElement("p"); hint.className = "graph-answer-hint"; hint.textContent = scatter ? text.scatterHint : text.lineHint;
    root.appendChild(hint);
    var status = document.createElement("span"); status.className = "graph-sr-status";
    status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    root.appendChild(status);
    if (scatter) {
      var captions = document.createElement("div"); captions.className = "graph-axis-captions";
      var xCaption = document.createElement("span"); xCaption.textContent = "x · " + config.xLabel;
      var yCaption = document.createElement("span"); yCaption.textContent = "y · " + config.yLabel;
      captions.appendChild(xCaption); captions.appendChild(yCaption); root.appendChild(captions);
    }
    root.appendChild(tabs); root.appendChild(svg);
    var fields = document.createElement("div"); fields.className = "graph-coordinate-fields";
    var inputs = [];
    var invalidInputIndices = new Set();
    draft.forEach(function (_, pointIndex) {
      ["x", "y"].forEach(function (axis, axisIndex) {
        var inputIndex = pointIndex * 2 + axisIndex;
        var label = document.createElement("label"); label.textContent = (axisIndex ? "y" : "x") + (pointIndex + 1);
        var input = document.createElement("input"); input.type = "number"; input.min = MIN; input.max = MAX; input.step = 1; input.inputMode = "numeric";
        input.setAttribute("aria-label", text.point + letter(pointIndex) + ", " + (axisIndex ? text.y : text.x));
        label.appendChild(input); fields.appendChild(label); inputs.push(input);
        input.addEventListener("input", function () { updatePoint(pointIndex, axis, input.value, inputIndex); });
      });
    });
    root.appendChild(fields);
    var validation = document.createElement("p");
    validation.className = "graph-validation-message";
    validation.setAttribute("role", "alert");
    validation.hidden = true;
    root.appendChild(validation);
    var clear = document.createElement("button"); clear.type = "button"; clear.className = "graph-clear"; clear.textContent = text.clear;
    clear.addEventListener("click", function () {
      points = Array.from({ length: config.count }, function () { return null; });
      draft = emptyDraft(config.count); invalidInputIndices.clear(); active = 0;
      validation.hidden = true; validation.textContent = "";
      inputs.forEach(function (input) { input.removeAttribute("aria-invalid"); });
      paint();
    }); root.appendChild(clear); root.appendChild(hidden);

    function emit() {
      var hasDraft = draft.some(function (p) { return p.x != null || p.y != null; });
      hidden.value = hasDraft ? JSON.stringify({
        type: scatter ? "scatter" : "line",
        points: draft.map(function (p) { return p.x == null && p.y == null ? null : { x: p.x, y: p.y }; })
      }) : "";
      if (onChange) onChange(hidden.value);
    }
    function updatePoint(index, axis, raw, inputIndex) {
      var value = raw === "" ? null : Number(raw);
      var validInput = raw === "" || (Number.isInteger(value) && value >= MIN && value <= MAX);
      if (!validInput) {
        inputs[inputIndex].value = "";
        inputs[inputIndex].setAttribute("aria-invalid", "true");
        invalidInputIndices.add(inputIndex);
        validation.textContent = text.coordinateError;
        validation.hidden = false;
      } else {
        inputs[inputIndex].removeAttribute("aria-invalid");
        invalidInputIndices.delete(inputIndex);
        if (!invalidInputIndices.size) {
          validation.textContent = "";
          validation.hidden = true;
        }
      }
      draft[index][axis] = validInput ? value : null;
      points[index] = validPoint(draft[index]) ? { x: draft[index].x, y: draft[index].y } : null;
      if (index === active && points[index]) cursor = { x: points[index].x, y: points[index].y };
      paint(inputIndex);
    }
    function cursorText() {
      return text.point + letter(active) + ", " + text.cursor + " (" + cursor.x + ", " + cursor.y + ").";
    }
    function announce(message) { status.textContent = message; }
    function paintCursor() {
      cursorMark.setAttribute("transform", "translate(" + (12 + (cursor.x - MIN) * 24) + " " + (12 + (MAX - cursor.y) * 24) + ")");
    }
    function placePoint(x, y) {
      var placed = active;
      draft[active] = { x: x, y: y }; points[active] = { x: x, y: y };
      cursor = { x: x, y: y };
      active = (active + 1) % config.count;
      paint();
      announce(text.point + letter(placed) + " " + text.placed + " (" + x + ", " + y + "). " + text.point + letter(active) + " " + text.selected + ".");
    }
    function clippedEndpoints(a, b) {
      var slope = (b.y - a.y) / (b.x - a.x), intercept = a.y - slope * a.x, candidates = [];
      if (slope === 0) return [{ x: MIN, y: intercept }, { x: MAX, y: intercept }];
      function add(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        if (x < MIN - 1e-8 || x > MAX + 1e-8 || y < MIN - 1e-8 || y > MAX + 1e-8) return;
        if (!candidates.some(function (p) { return Math.abs(p.x - x) < 1e-8 && Math.abs(p.y - y) < 1e-8; })) candidates.push({ x: x, y: y });
      }
      add(MIN, slope * MIN + intercept); add(MAX, slope * MAX + intercept);
      add((MIN - intercept) / slope, MIN); add((MAX - intercept) / slope, MAX);
      candidates.sort(function (p, q) { return p.x - q.x || p.y - q.y; });
      return candidates.length > 1 ? [candidates[0], candidates[candidates.length - 1]] : [a, b];
    }
    function paint(preserveInputIndex) {
      pointButtons.forEach(function (button, i) {
        var p = points[i];
        button.textContent = text.point + letter(i) + (p ? " · (" + p.x + ", " + p.y + ")" : "");
        button.setAttribute("aria-pressed", String(active === i)); button.classList.toggle("active", active === i);
      });
      points.forEach(function (p, i) {
        if (preserveInputIndex !== i * 2) inputs[i * 2].value = draft[i].x == null ? "" : draft[i].x;
        if (preserveInputIndex !== i * 2 + 1) inputs[i * 2 + 1].value = draft[i].y == null ? "" : draft[i].y;
        marks[i].setAttribute("visibility", p ? "visible" : "hidden");
        if (p) { var cx = 12 + (p.x - MIN) * 24, cy = 12 + (MAX - p.y) * 24; marks[i].setAttribute("transform", "translate(" + cx + " " + cy + ")"); }
      });
      if (!scatter && points[0] && points[1]) {
        var ends = clippedEndpoints(points[0], points[1]);
        segment.setAttribute("visibility", "visible");
        segment.setAttribute("x1", 12 + (ends[0].x - MIN) * 24); segment.setAttribute("y1", 12 + (MAX - ends[0].y) * 24);
        segment.setAttribute("x2", 12 + (ends[1].x - MIN) * 24); segment.setAttribute("y2", 12 + (MAX - ends[1].y) * 24);
      } else segment.setAttribute("visibility", "hidden");
      paintCursor();
      emit();
    }
    svg.addEventListener("click", function (event) {
      var matrix = svg.getScreenCTM();
      if (!matrix) return;
      var location = svg.createSVGPoint();
      location.x = event.clientX;
      location.y = event.clientY;
      var local = location.matrixTransform(matrix.inverse());
      var px = local.x, py = local.y;
      if (px < 12 || px > 252 || py < 12 || py > 252) return;
      var gx = Math.round((px - 12) / 24) + MIN, gy = MAX - Math.round((py - 12) / 24);
      if (gx < MIN || gx > MAX || gy < MIN || gy > MAX) return;
      placePoint(gx, gy);
    });
    svg.addEventListener("focus", function () {
      cursorMark.setAttribute("visibility", "visible");
      announce(cursorText());
    });
    svg.addEventListener("blur", function () { cursorMark.setAttribute("visibility", "hidden"); });
    svg.addEventListener("keydown", function (event) {
      var move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
      if (move) {
        event.preventDefault();
        cursor.x = Math.max(MIN, Math.min(MAX, cursor.x + move[0]));
        cursor.y = Math.max(MIN, Math.min(MAX, cursor.y + move[1]));
        paintCursor();
        announce(cursorText());
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        placePoint(cursor.x, cursor.y);
      }
    });
    paint();
    return hidden;
  };
  window.ExGenGraphAnswer.isComplete = function (raw, displayConfig) {
    var config = configFor(displayConfig), points = read(raw, config);
    if (points.length !== config.count || !points.every(validPoint)) return false;
    if (config.mode === "scatter") {
      return new Set(points.map(function (p) { return p.x; })).size === points.length
        && new Set(points.map(function (p) { return p.x + "|" + p.y; })).size === points.length;
    }
    return points[0].x !== points[1].x;
  };
})();
