(function () {
  "use strict";
  var MIN = -5, MAX = 5, NS = "http://www.w3.org/2000/svg", nextGraphId = 0;

  function configFor(value) {
    if (value && value.mode === "scatter" && value.point_count === 3
      && typeof value.x_label === "string" && typeof value.y_label === "string") {
      var scale = [1, 10, 100, 1000].indexOf(value.coordinate_scale) >= 0 ? value.coordinate_scale : 1;
      var xAxis = value.x_axis && Number.isSafeInteger(value.x_axis.min) && Number.isSafeInteger(value.x_axis.max)
        && Number.isSafeInteger(value.x_axis.step) ? value.x_axis : { min: MIN, max: MAX, step: 1 };
      var yAxis = value.y_axis && Number.isSafeInteger(value.y_axis.min) && Number.isSafeInteger(value.y_axis.max)
        && Number.isSafeInteger(value.y_axis.step) ? value.y_axis : { min: MIN, max: MAX, step: 1 };
      return { mode: "scatter", count: 3, xLabel: value.x_label, yLabel: value.y_label, scale: scale,
        xAxis: xAxis, yAxis: yAxis, scaled: value.coordinate_scale !== undefined || value.x_axis !== undefined || value.y_axis !== undefined };
    }
    return { mode: "line", count: 2, xLabel: "x", yLabel: "y", scale: 1, scaled: false,
      xAxis: { min: MIN, max: MAX, step: 1 }, yAxis: { min: MIN, max: MAX, step: 1 } };
  }
  function emptyDraft(count) {
    return Array.from({ length: count }, function () { return { x: null, y: null }; });
  }
  function validPoint(point, config) {
    return point && Number.isSafeInteger(point.x) && point.x >= config.xAxis.min && point.x <= config.xAxis.max
      && Number.isSafeInteger(point.y) && point.y >= config.yAxis.min && point.y <= config.yAxis.max;
  }
  function parseCoordinate(raw, config) {
    var match = /^([+-]?)(\d+)(?:([.,])(\d+))?$/.exec(String(raw).trim());
    var precision = Math.log10(config.scale);
    if (!match || (match[4] || "").length > precision) return null;
    var fraction = (match[4] || "").padEnd(precision, "0");
    var value = (match[1] === "-" ? -1 : 1) * Number(match[2] + fraction);
    return Number.isSafeInteger(value) ? value : null;
  }
  function formatCoordinate(value, config, english) {
    if (!config.scale || config.scale === 1) return String(value);
    var result = (value / config.scale).toFixed(Math.log10(config.scale)).replace(/\.?0+$/, "");
    return english ? result : result.replace(".", ",");
  }
  function formatTick(value, config, english) {
    return formatCoordinate(value, config, english).replace(/^-/, "−");
  }
  function pointText(point, config, english) {
    return "(" + formatCoordinate(point.x, config, english) + ", " + formatCoordinate(point.y, config, english) + ")";
  }
  function read(raw, config) {
    try {
      var v = JSON.parse(raw || "null");
      var expectedType = config.mode === "scatter" ? "scatter" : "line";
      if (!v || v.type !== expectedType || !Array.isArray(v.points) || v.points.length !== config.count) return emptyDraft(config.count);
      return v.points.map(function (point) {
        if (!point || typeof point !== "object") return { x: null, y: null };
        return {
          x: Number.isSafeInteger(point.x) && point.x >= config.xAxis.min && point.x <= config.xAxis.max ? point.x : null,
          y: Number.isSafeInteger(point.y) && point.y >= config.yAxis.min && point.y <= config.yAxis.max ? point.y : null
        };
      });
    } catch (_) { return emptyDraft(config.count); }
  }

  window.ExGenGraphAnswer = function (root, initial, onChange, lang, displayConfig) {
    var english = lang === "en", config = configFor(displayConfig);
    function xToPx(value) { return 12 + ((value - config.xAxis.min) / (config.xAxis.max - config.xAxis.min)) * 240; }
    function yToPx(value) { return 252 - ((value - config.yAxis.min) / (config.yAxis.max - config.yAxis.min)) * 240; }
    function pxToX(value) { return Math.round(config.xAxis.min + ((value - 12) / 240) * (config.xAxis.max - config.xAxis.min)); }
    function pxToY(value) { return Math.round(config.yAxis.min + ((252 - value) / 240) * (config.yAxis.max - config.yAxis.min)); }
    var xMinText = formatCoordinate(config.xAxis.min, config, english), xMaxText = formatCoordinate(config.xAxis.max, config, english);
    var yMinText = formatCoordinate(config.yAxis.min, config, english), yMaxText = formatCoordinate(config.yAxis.max, config, english);
    var axisCaptionId;
    do { axisCaptionId = "graph-axis-captions-" + (++nextGraphId); }
    while (document.getElementById(axisCaptionId));
    var letter = function (i) { return String.fromCharCode(65 + i); };
    var text = english ? {
      lineGraph: "Coordinate grid from minus five to five. Choose point A or B and click the graph.",
      scatterGraph: "Coordinate grid: x " + xMinText + " to " + xMaxText + " and y " + yMinText + " to " + yMaxText + ". Choose point A, B or C and plot each data point.",
      lineHint: "Choose A or B and click the graph. You can also enter coordinates.",
      scatterHint: "Choose a point, then click the graph or enter its coordinates. Plot each table row once.",
      point: "Point ", x: "x-coordinate", y: "y-coordinate", clear: "Clear points",
      coordinateError: "Enter values within the displayed axis ranges, with at most " + Math.log10(config.scale) + " decimal places.",
      keyboard: "Arrow keys move one coordinate step; Shift+arrow jumps one grid interval. Press Enter or Space to plot the selected point.",
      cursor: "cursor", placed: "plotted", selected: "selected"
    } : {
      lineGraph: "Koordinatsystem från minus fem till fem. Välj punkt A eller B och tryck i grafen.",
      scatterGraph: "Koordinatsystem med x-axeln från " + xMinText + " till " + xMaxText + " och y-axeln från " + yMinText + " till " + yMaxText + ". Välj punkt A, B eller C och placera varje datapunkt.",
      lineHint: "Välj A eller B och tryck på grafen. Du kan också skriva koordinaterna.",
      scatterHint: "Välj en punkt och tryck i grafen eller skriv koordinaterna. Placera varje tabellrad en gång.",
      point: "Punkt ", x: "x-koordinat", y: "y-koordinat", clear: "Rensa punkter",
      coordinateError: "Ange värden inom axlarnas intervall med högst " + Math.log10(config.scale) + " decimaler.",
      keyboard: "Piltangenter flyttar ett koordinatsteg; Skift+piltangent hoppar en rutlinje. Placera punkten med Enter eller mellanslag.",
      cursor: "markör", placed: "placerad", selected: "vald"
    };
    var scatter = config.mode === "scatter";
    var description = scatter ? text.scatterGraph : text.lineGraph;
    var draft = read(initial, config);
    var points = draft.map(function (p) { return validPoint(p, config) ? { x: p.x, y: p.y } : null; });
    var active = 0;
    var cursor = { x: Math.max(config.xAxis.min, Math.min(config.xAxis.max, 0)),
      y: Math.max(config.yAxis.min, Math.min(config.yAxis.max, 0)) };
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
    var xTicks = (config.xAxis.max - config.xAxis.min) / config.xAxis.step;
    var yTicks = (config.yAxis.max - config.yAxis.min) / config.yAxis.step;
    for (var n = 0; n <= xTicks; n++) {
      var xValue = config.xAxis.min + n * config.xAxis.step, x = xToPx(xValue);
      var vx = document.createElementNS(NS, "line"); vx.setAttribute("x1", x); vx.setAttribute("x2", x); vx.setAttribute("y1", 12); vx.setAttribute("y2", 252); grid.appendChild(vx);
    }
    for (var yn = 0; yn <= yTicks; yn++) {
      var yValue = config.yAxis.min + yn * config.yAxis.step, y = yToPx(yValue);
      var hy = document.createElementNS(NS, "line"); hy.setAttribute("x1", 12); hy.setAttribute("x2", 252); hy.setAttribute("y1", y); hy.setAttribute("y2", y); grid.appendChild(hy);
    }
    svg.appendChild(grid);
    var labels = document.createElementNS(NS, "g"); labels.setAttribute("class", "graph-tick-labels");
    for (var tick = 0; tick <= xTicks; tick++) {
      var xTickValue = config.xAxis.min + tick * config.xAxis.step;
      var labelX = document.createElementNS(NS, "text");
      labelX.setAttribute("x", xToPx(xTickValue)); labelX.setAttribute("y", 145);
      labelX.setAttribute("text-anchor", tick === 0 ? "start" : tick === xTicks ? "end" : "middle");
      labelX.textContent = formatTick(xTickValue, config, english); labels.appendChild(labelX);
    }
    for (var yTick = 0; yTick <= yTicks; yTick++) {
      var yTickValue = config.yAxis.min + yTick * config.yAxis.step;
      var labelY = document.createElementNS(NS, "text");
      var yLabelY = yToPx(yTickValue);
      yLabelY = yLabelY >= 240 ? yLabelY - 3 : yLabelY <= 24 ? yLabelY + 3 : yLabelY + 2.5;
      labelY.setAttribute("x", 127); labelY.setAttribute("y", yLabelY);
      labelY.setAttribute("text-anchor", "end"); labelY.textContent = formatTick(yTickValue, config, english); labels.appendChild(labelY);
    }
    var xName = document.createElementNS(NS, "text"); xName.setAttribute("x", 256); xName.setAttribute("y", 135); xName.setAttribute("class", "graph-axis-name"); xName.textContent = "x"; labels.appendChild(xName);
    var yName = document.createElementNS(NS, "text"); yName.setAttribute("x", 137); yName.setAttribute("y", 17); yName.setAttribute("class", "graph-axis-name"); yName.textContent = "y"; labels.appendChild(yName);
    svg.appendChild(labels);
    var axes = document.createElementNS(NS, "g"); axes.setAttribute("class", "graph-axes");
    var zeroX = config.xAxis.min <= 0 && config.xAxis.max >= 0 ? xToPx(0)
      : config.xAxis.max < 0 ? 252 : 12;
    var zeroY = config.yAxis.min <= 0 && config.yAxis.max >= 0 ? yToPx(0)
      : config.yAxis.max < 0 ? 12 : 252;
    var xLabelY = zeroY <= 24 ? zeroY + 10 : zeroY >= 240 ? zeroY - 5 : zeroY + 13;
    var yLabelX = zeroX <= 24 ? 32 : zeroX >= 240 ? 232 : zeroX - 5;
    var yLabelAnchor = "end";
    labels.querySelectorAll("text").forEach(function (label) {
      if (label.getAttribute("y") === "145") label.setAttribute("y", xLabelY);
      if (label.getAttribute("x") === "127") {
        label.setAttribute("x", yLabelX);
        label.setAttribute("text-anchor", yLabelAnchor);
      }
    });
    var axisNames = labels.querySelectorAll(".graph-axis-name");
    axisNames[0].setAttribute("y", xLabelY);
    axisNames[1].setAttribute("x", zeroX <= 24 ? 17 : zeroX + 5);
    if (scatter) {
      axisNames[0].setAttribute("visibility", "hidden");
      axisNames[1].setAttribute("visibility", "hidden");
    }
    [[12,zeroY,252,zeroY],[zeroX,12,zeroX,252]].forEach(function (a) {
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
    if (config.scaled) root.classList.add("graph-answer--scaled");
    var hint = document.createElement("p"); hint.className = "graph-answer-hint"; hint.textContent = scatter ? text.scatterHint : text.lineHint;
    root.appendChild(hint);
    var status = document.createElement("span"); status.className = "graph-sr-status";
    status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    root.appendChild(status);
    if (scatter) {
      var captions = document.createElement("div"); captions.className = "graph-axis-captions";
      captions.id = axisCaptionId;
      var xCaption = document.createElement("span"); xCaption.textContent = "x · " + config.xLabel;
      var yCaption = document.createElement("span"); yCaption.textContent = "y · " + config.yLabel;
      captions.appendChild(xCaption); captions.appendChild(yCaption); root.appendChild(captions);
      svg.setAttribute("aria-describedby", captions.id);
    }
    root.appendChild(tabs); root.appendChild(svg);
    var fields = document.createElement("div"); fields.className = "graph-coordinate-fields";
    var inputs = [];
    var invalidInputIndices = new Set();
    draft.forEach(function (_, pointIndex) {
      ["x", "y"].forEach(function (axis, axisIndex) {
        var inputIndex = pointIndex * 2 + axisIndex;
        var label = document.createElement("label"); label.textContent = (axisIndex ? "y" : "x") + (pointIndex + 1);
        var fieldAxis = axisIndex ? config.yAxis : config.xAxis;
        var input = document.createElement("input");
        input.type = config.scale > 1 ? "text" : "number";
        input.min = fieldAxis.min / config.scale; input.max = fieldAxis.max / config.scale;
        input.step = fieldAxis.step / config.scale;
        input.inputMode = config.scale > 1 ? "decimal" : "numeric";
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
      var axisBounds = axis === "x" ? config.xAxis : config.yAxis;
      var value = raw === "" ? null : (config.scale > 1 ? parseCoordinate(raw, config) : Number(raw));
      var validInput = raw === "" || (Number.isSafeInteger(value)
        && value >= axisBounds.min && value <= axisBounds.max);
      if (!validInput) {
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
      points[index] = validPoint(draft[index], config) ? { x: draft[index].x, y: draft[index].y } : null;
      if (index === active && points[index]) cursor = { x: points[index].x, y: points[index].y };
      paint(inputIndex);
    }
    function cursorText() {
      return text.point + letter(active) + ", " + text.cursor + " " + pointText(cursor, config, english) + ".";
    }
    function announce(message) { status.textContent = message; }
    function paintCursor() {
      cursorMark.setAttribute("transform", "translate(" + xToPx(cursor.x) + " " + yToPx(cursor.y) + ")");
    }
    function placePoint(x, y) {
      var placed = active;
      draft[active] = { x: x, y: y }; points[active] = { x: x, y: y };
      cursor = { x: x, y: y };
      active = (active + 1) % config.count;
      paint();
      announce(text.point + letter(placed) + " " + text.placed + " " + pointText({ x: x, y: y }, config, english) + ". " + text.point + letter(active) + " " + text.selected + ".");
    }
    function clippedEndpoints(a, b) {
      var slope = (b.y - a.y) / (b.x - a.x), intercept = a.y - slope * a.x, candidates = [];
      if (slope === 0) return [{ x: config.xAxis.min, y: intercept }, { x: config.xAxis.max, y: intercept }];
      function add(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        if (x < config.xAxis.min - 1e-8 || x > config.xAxis.max + 1e-8
          || y < config.yAxis.min - 1e-8 || y > config.yAxis.max + 1e-8) return;
        if (!candidates.some(function (p) { return Math.abs(p.x - x) < 1e-8 && Math.abs(p.y - y) < 1e-8; })) candidates.push({ x: x, y: y });
      }
      add(config.xAxis.min, slope * config.xAxis.min + intercept); add(config.xAxis.max, slope * config.xAxis.max + intercept);
      add((config.yAxis.min - intercept) / slope, config.yAxis.min); add((config.yAxis.max - intercept) / slope, config.yAxis.max);
      candidates.sort(function (p, q) { return p.x - q.x || p.y - q.y; });
      return candidates.length > 1 ? [candidates[0], candidates[candidates.length - 1]] : [a, b];
    }
    function paint(preserveInputIndex) {
      pointButtons.forEach(function (button, i) {
        var p = points[i];
        button.textContent = text.point + letter(i) + (p ? " · " + pointText(p, config, english) : "");
        button.setAttribute("aria-pressed", String(active === i)); button.classList.toggle("active", active === i);
      });
      points.forEach(function (p, i) {
        if (preserveInputIndex !== i * 2) inputs[i * 2].value = draft[i].x == null ? "" : formatCoordinate(draft[i].x, config, english);
        if (preserveInputIndex !== i * 2 + 1) inputs[i * 2 + 1].value = draft[i].y == null ? "" : formatCoordinate(draft[i].y, config, english);
        marks[i].setAttribute("visibility", p ? "visible" : "hidden");
        if (p) marks[i].setAttribute("transform", "translate(" + xToPx(p.x) + " " + yToPx(p.y) + ")");
      });
      if (!scatter && points[0] && points[1]) {
        var ends = clippedEndpoints(points[0], points[1]);
        segment.setAttribute("visibility", "visible");
        segment.setAttribute("x1", xToPx(ends[0].x)); segment.setAttribute("y1", yToPx(ends[0].y));
        segment.setAttribute("x2", xToPx(ends[1].x)); segment.setAttribute("y2", yToPx(ends[1].y));
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
      var gx = pxToX(px), gy = pxToY(py);
      if (gx < config.xAxis.min || gx > config.xAxis.max || gy < config.yAxis.min || gy > config.yAxis.max) return;
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
        event.stopPropagation();
        var xStep = event.shiftKey ? config.xAxis.step : 1;
        var yStep = event.shiftKey ? config.yAxis.step : 1;
        cursor.x = Math.max(config.xAxis.min, Math.min(config.xAxis.max, cursor.x + move[0] * xStep));
        cursor.y = Math.max(config.yAxis.min, Math.min(config.yAxis.max, cursor.y + move[1] * yStep));
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
    var config = configFor(displayConfig), value;
    try { value = JSON.parse(raw || "null"); } catch (_) { return false; }
    if (!value || !Array.isArray(value.points) || value.points.length !== config.count
      || value.type !== (config.mode === "scatter" ? "scatter" : "line")) return false;
    if (config.mode === "scatter") {
      if (value.points.some(function (point) { return point !== null && !validPoint(point, config); })) return false;
      var placed = value.points.filter(function (point) { return validPoint(point, config); });
      return placed.length > 0
        && new Set(placed.map(function (p) { return p.x + "|" + p.y; })).size === placed.length;
    }
    var points = read(raw, config);
    return points.length === config.count && points.every(function (point) { return validPoint(point, config); }) && points[0].x !== points[1].x;
  };
})();
