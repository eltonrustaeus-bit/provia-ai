(function () {
  "use strict";
  var MIN = -5, MAX = 5, NS = "http://www.w3.org/2000/svg";
  function emptyDraft() { return [{ x: null, y: null }, { x: null, y: null }]; }

  function read(raw) {
    try {
      var v = JSON.parse(raw || "null");
      if (!v || v.type !== "line" || !Array.isArray(v.points) || v.points.length !== 2) return emptyDraft();
      return v.points.map(function (p) {
        if (!p || typeof p !== "object") return { x: null, y: null };
        return {
          x: Number.isInteger(p.x) && p.x >= MIN && p.x <= MAX ? p.x : null,
          y: Number.isInteger(p.y) && p.y >= MIN && p.y <= MAX ? p.y : null
        };
      });
    } catch (_) { return emptyDraft(); }
  }

  window.ExGenGraphAnswer = function (root, initial, onChange, lang) {
    var english = lang === "en";
    var text = english ? {
      graph: "Coordinate grid from minus five to five. Choose point A or B and click the graph.",
      hint: "Choose A or B and click the graph. You can also enter coordinates.",
      point: "Point ", x: "x-coordinate", y: "y-coordinate", clear: "Clear points"
    } : {
      graph: "Koordinatsystem från minus fem till fem. Välj punkt A eller B och tryck i grafen.",
      hint: "Välj A eller B och tryck på grafen. Du kan också skriva koordinaterna.",
      point: "Punkt ", x: "x-koordinat", y: "y-koordinat", clear: "Rensa punkter"
    };
    var draft = read(initial);
    var points = draft.map(function (p) { return p.x == null || p.y == null ? null : { x: p.x, y: p.y }; });
    var active = 0;
    var hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.className = "graphAnswer";
    hidden.value = initial || "";

    var tabs = document.createElement("div"); tabs.className = "graph-point-tabs";
    var pointButtons = [0, 1].map(function (i) {
      var button = document.createElement("button"); button.type = "button";
      button.addEventListener("click", function () { active = i; paint(); });
      tabs.appendChild(button); return button;
    });
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 264 264"); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", text.graph);
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
    var marks = [0, 1].map(function (i) {
      var g = document.createElementNS(NS, "g"); g.setAttribute("class", "graph-mark");
      var circle = document.createElementNS(NS, "circle"); circle.setAttribute("r", "6"); g.appendChild(circle);
      var label = document.createElementNS(NS, "text"); label.textContent = i ? "B" : "A"; g.appendChild(label);
      svg.appendChild(g); return g;
    });
    root.classList.add("graph-answer");
    var hint = document.createElement("p"); hint.className = "graph-answer-hint"; hint.textContent = text.hint;
    root.appendChild(hint); root.appendChild(tabs); root.appendChild(svg);
    var fields = document.createElement("div"); fields.className = "graph-coordinate-fields";
    var inputs = [];
    ["x₁", "y₁", "x₂", "y₂"].forEach(function (labelText, i) {
      var label = document.createElement("label"); label.textContent = labelText;
      var input = document.createElement("input"); input.type = "number"; input.min = MIN; input.max = MAX; input.step = 1; input.inputMode = "numeric";
      input.setAttribute("aria-label", text.point + (i < 2 ? "A" : "B") + ", " + (i % 2 ? text.y : text.x));
      label.appendChild(input); fields.appendChild(label); inputs.push(input);
      input.addEventListener("input", function () { updatePoint(Math.floor(i / 2), i % 2 === 0 ? "x" : "y", input.value, i); });
    });
    root.appendChild(fields);
    var clear = document.createElement("button"); clear.type = "button"; clear.className = "graph-clear"; clear.textContent = text.clear;
    clear.addEventListener("click", function () { points = [null, null]; draft = [{ x: null, y: null }, { x: null, y: null }]; active = 0; paint(); }); root.appendChild(clear); root.appendChild(hidden);

    function emit() {
      var hasDraft = draft.some(function (p) { return p.x != null || p.y != null; });
      hidden.value = hasDraft ? JSON.stringify({
        type: "line",
        points: draft.map(function (p) { return p.x == null && p.y == null ? null : { x: p.x, y: p.y }; })
      }) : "";
      if (onChange) onChange(hidden.value);
    }
    function updatePoint(index, axis, raw, inputIndex) {
      var value = raw === "" ? null : Number(raw);
      draft[index][axis] = value != null && Number.isInteger(value) && value >= MIN && value <= MAX ? value : null;
      points[index] = draft[index].x == null || draft[index].y == null ? null : { x: draft[index].x, y: draft[index].y };
      paint(inputIndex);
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
      [0,1].forEach(function (i) {
        var button = pointButtons[i]; button.textContent = text.point + (i ? "B" : "A") + (points[i] ? " · (" + points[i].x + ", " + points[i].y + ")" : "");
        button.setAttribute("aria-pressed", String(active === i)); if (active === i) button.classList.add("active");
        else button.classList.remove("active");
      });
      points.forEach(function (p, i) {
        if (preserveInputIndex !== i * 2) inputs[i * 2].value = draft[i].x == null ? "" : draft[i].x;
        if (preserveInputIndex !== i * 2 + 1) inputs[i * 2 + 1].value = draft[i].y == null ? "" : draft[i].y;
        marks[i].setAttribute("visibility", p ? "visible" : "hidden");
        if (p) { var cx = 12 + (p.x - MIN) * 24, cy = 12 + (MAX - p.y) * 24; marks[i].setAttribute("transform", "translate(" + cx + " " + cy + ")"); }
      });
      if (points[0] && points[1]) {
        var ends = clippedEndpoints(points[0], points[1]);
        segment.setAttribute("visibility", "visible");
        segment.setAttribute("x1", 12 + (ends[0].x - MIN) * 24); segment.setAttribute("y1", 12 + (MAX - ends[0].y) * 24);
        segment.setAttribute("x2", 12 + (ends[1].x - MIN) * 24); segment.setAttribute("y2", 12 + (MAX - ends[1].y) * 24);
      } else segment.setAttribute("visibility", "hidden");
      emit();
    }
    svg.addEventListener("click", function (event) {
      var rect = svg.getBoundingClientRect();
      var px = (event.clientX - rect.left) * 264 / rect.width;
      var py = (event.clientY - rect.top) * 264 / rect.height;
      if (px < 12 || px > 252 || py < 12 || py > 252) return;
      var gx = Math.round((px - 12) / 24) + MIN, gy = MAX - Math.round((py - 12) / 24);
      if (gx < MIN || gx > MAX || gy < MIN || gy > MAX) return;
      draft[active] = { x: gx, y: gy }; points[active] = { x: gx, y: gy }; if (active === 0) active = 1; paint();
    });
    paint();
    return hidden;
  };
  window.ExGenGraphAnswer.isComplete = function (raw) {
    var points = read(raw);
    return points.length === 2 && points.every(function (p) { return p.x != null && p.y != null; })
      && points[0].x !== points[1].x;
  };
})();
