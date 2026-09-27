(function () {
  "use strict";

  var APP = window.APP;

  APP.charts = {
    instances: {}
  };

  // Categorical palette validated for colorblind separation and contrast on the dark
  // chart surface (#111d2d). Assigned in this fixed order, never cycled.
  APP.charts.categoryPalette = [
    "#3987e5",
    "#d95926",
    "#199e70",
    "#c98500",
    "#d55181",
    "#008300",
    "#9085e9",
    "#e66767"
  ];

  APP.charts.otherColor = "#6b7c93";
  APP.charts.totalColor = "#eff6ff";
  APP.charts.surface = "#111d2d";
  APP.charts.track = "#1c2b3f";

  // Fixed colors for the money-flow types, used by every chart that shows them. The three
  // hues are the palette's first three slots (they separate pairwise for colorblind
  // readers); income and leftover cash are neutrals that differ by lightness. Debt payments
  // are blue on purpose: paying debt down is progress, not a warning.
  APP.charts.flow = {
    income: "#c3cfdd",
    spending: "#d95926",
    savings: "#199e70",
    debt: "#3987e5",
    remaining: "#6b7c93",
    shortfall: "#e66767"
  };

  // Reserved status colors. Always paired with a text label, never color alone.
  APP.charts.status = {
    good: "#199e70",
    warning: "#c98500",
    critical: "#e66767"
  };

  APP.charts.compact = function (value) {
    var amount = APP.utils.money(value);
    var sign = amount < 0 ? "-" : "";
    var absolute = Math.abs(amount);

    if (absolute >= 1000) {
      return sign + "$" + (absolute / 1000).toFixed(absolute >= 10000 ? 0 : 1)
        .replace(/\.0$/, "") + "k";
    }

    return sign + "$" + Math.round(absolute).toLocaleString();
  };

  // Keeps series in their given (stable) order and colors them by that order. Past the
  // palette size, the largest series stay and the rest fold into a single "Other" series.
  APP.charts.limitSeries = function (series) {
    var palette = APP.charts.categoryPalette;

    function total(item) {
      return item.values.reduce(function (sum, value) {
        return sum + Math.abs(APP.utils.money(value));
      }, 0);
    }

    var kept = series;
    var folded = [];

    if (series.length > palette.length) {
      var keepIds = series.slice().sort(function (a, b) {
        return total(b) - total(a);
      }).slice(0, palette.length - 1).map(function (item) {
        return item.id;
      });

      kept = series.filter(function (item) {
        return keepIds.indexOf(item.id) !== -1;
      });

      folded = series.filter(function (item) {
        return keepIds.indexOf(item.id) === -1;
      });
    }

    var result = kept.map(function (item, index) {
      return {
        id: item.id,
        label: item.label,
        values: item.values,
        color: palette[index]
      };
    });

    if (folded.length) {
      result.push({
        id: "other",
        label: "Other (" + folded.length + " categories)",
        values: folded[0].values.map(function (value, index) {
          return folded.reduce(function (sum, item) {
            return sum + APP.utils.money(item.values[index]);
          }, 0);
        }),
        color: APP.charts.otherColor
      });
    }

    return result;
  };

  APP.charts.alpha = function (hex, opacity) {
    var value = parseInt(hex.slice(1), 16);

    return "rgba(" + (value >> 16 & 255) + "," + (value >> 8 & 255) + "," +
      (value & 255) + "," + opacity + ")";
  };

  // Mixes a hue over the chart surface: a one-hue sequential ramp for heatmaps.
  APP.charts.ramp = function (hex, amount) {
    var from = parseInt(APP.charts.surface.slice(1), 16);
    var to = parseInt(hex.slice(1), 16);
    var t = Math.max(0, Math.min(1, amount));

    function channel(shift) {
      var a = from >> shift & 255;
      var b = to >> shift & 255;
      return Math.round(a + (b - a) * t);
    }

    return "rgb(" + channel(16) + "," + channel(8) + "," + channel(0) + ")";
  };

  APP.charts.readableOn = function (rgb) {
    var parts = rgb.match(/\d+/g).map(Number);
    var luminance = (parts[0] * 299 + parts[1] * 587 + parts[2] * 114) / 1000;
    return luminance > 140 ? "#0b1522" : "#eff6ff";
  };

  APP.charts.themed = false;

  APP.charts.theme = function () {
    if (APP.charts.themed || !window.Chart) {
      return;
    }

    var defaults = window.Chart.defaults;

    APP.charts.themed = true;
    defaults.font.family = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
    defaults.font.size = 12;
    defaults.color = "#9aadc3";
    defaults.borderColor = "rgba(154,173,195,.10)";
    defaults.animation.duration = 450;

    defaults.plugins.legend.labels.usePointStyle = true;
    defaults.plugins.legend.labels.boxWidth = 8;
    defaults.plugins.legend.labels.boxHeight = 8;
    defaults.plugins.legend.labels.padding = 14;
    defaults.plugins.legend.labels.color = "#c9d6e6";

    // Dashed series (like a total or a pace line) get a short dashed key instead of a dot.
    var baseLabels = defaults.plugins.legend.labels.generateLabels;
    defaults.plugins.legend.labels.generateLabels = function (chart) {
      return baseLabels(chart).map(function (item) {
        var dataset = chart.data.datasets[item.datasetIndex];

        if (dataset && dataset.borderDash && dataset.borderDash.length) {
          item.pointStyle = "line";
          item.lineDash = dataset.borderDash;
          item.lineWidth = 2;
          item.strokeStyle = dataset.borderColor;
        }

        return item;
      });
    };

    defaults.plugins.tooltip.backgroundColor = "#0b1522";
    defaults.plugins.tooltip.borderColor = "#2b405a";
    defaults.plugins.tooltip.borderWidth = 1;
    defaults.plugins.tooltip.titleColor = "#eff6ff";
    defaults.plugins.tooltip.bodyColor = "#c9d6e6";
    defaults.plugins.tooltip.padding = 10;
    defaults.plugins.tooltip.cornerRadius = 8;
    defaults.plugins.tooltip.boxPadding = 5;
    defaults.plugins.tooltip.usePointStyle = true;

    defaults.elements.line.borderWidth = 2;
    defaults.elements.line.borderCapStyle = "round";
    defaults.elements.line.borderJoinStyle = "round";
    defaults.elements.line.cubicInterpolationMode = "monotone";
    defaults.elements.point.radius = 0;
    defaults.elements.point.hoverRadius = 5;
    defaults.elements.point.hitRadius = 12;
    defaults.elements.point.borderWidth = 2;
    defaults.elements.point.hoverBorderWidth = 2;
    defaults.elements.point.borderColor = APP.charts.surface;
    defaults.elements.bar.borderRadius = 4;
    defaults.elements.bar.borderSkipped = "start";
    defaults.elements.arc.borderColor = APP.charts.surface;
    defaults.elements.arc.borderWidth = 2;

    defaults.datasets.bar.maxBarThickness = 24;
    defaults.datasets.line.pointBackgroundColor = function (context) {
      return context.dataset.borderColor;
    };
  };

  APP.charts.destroy = function (key) {
    if (APP.charts.instances[key]) {
      APP.charts.instances[key].destroy();
      delete APP.charts.instances[key];
    }
  };

  APP.charts.message = function (root, message) {
    APP.dom.clear(root);
    root.appendChild(APP.dom.el("p", "muted chart-empty", message));
  };

  APP.charts.chart = function (root, key, config) {
    APP.charts.destroy(key);
    APP.dom.clear(root);

    if (!window.Chart) {
      APP.charts.message(
        root,
        "Chart.js is unavailable. The underlying financial data remains available in the relevant workspace."
      );
      return;
    }

    APP.charts.theme();

    var canvas = APP.dom.el("canvas");
    root.appendChild(canvas);
    APP.charts.instances[key] = new window.Chart(canvas, config);
  };

  APP.charts.moneyOptions = function (stacked, area) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          align: "start",
          labels: {}
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              var value = context.raw && typeof context.raw === "object" ?
                context.parsed.y :
                context.raw;

              return " " + context.dataset.label + ": " + APP.utils.currency(value);
            }
          }
        }
      },
      scales: {
        x: {
          stacked: Boolean(stacked),
          grid: { display: false },
          border: { display: false }
        },
        y: {
          stacked: Boolean(stacked),
          beginAtZero: true,
          border: { display: false },
          ticks: {
            maxTicksLimit: 6,
            callback: function (value) {
              return APP.charts.compact(value);
            }
          }
        }
      },
      elements: {
        line: {
          fill: Boolean(area)
        }
      }
    };
  };

  // Draws the total in the middle of a doughnut.
  APP.charts.centerLabel = function (title, value) {
    return {
      id: "centerLabel",
      afterDraw: function (chart) {
        var meta = chart.getDatasetMeta(0);

        if (!meta || !meta.data.length) {
          return;
        }

        var arc = meta.data[0];
        var context = chart.ctx;

        context.save();
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = "#eff6ff";
        context.font = '800 20px Inter, system-ui, sans-serif';
        context.fillText(value, arc.x, arc.y - 8);
        context.fillStyle = "#9aadc3";
        context.font = '12px Inter, system-ui, sans-serif';
        context.fillText(title, arc.x, arc.y + 14);
        context.restore();
      }
    };
  };

  // Category-by-month matrix with a one-hue sequential ramp and a row total column.
  APP.charts.matrix = function (root, rows, columns, color, formatter) {
    APP.dom.clear(root);

    rows = rows.filter(function (row) {
      return row.values.some(function (value) {
        return value > 0;
      });
    });

    if (!rows.length) {
      APP.charts.message(root, "No activity is available for this heatmap.");
      return;
    }

    var format = formatter || APP.charts.compact;
    var maximum = Math.max.apply(null, rows.map(function (row) {
      return Math.max.apply(null, row.values);
    })) || 1;

    var grid = APP.dom.el("div", "matrix-grid");
    grid.style.gridTemplateColumns =
      "minmax(96px, 1.3fr) repeat(" + columns.length + ", minmax(38px, 1fr)) minmax(56px, .9fr)";

    grid.appendChild(APP.dom.el("span", "matrix-head", ""));
    columns.forEach(function (column) {
      grid.appendChild(APP.dom.el("span", "matrix-head", column));
    });
    grid.appendChild(APP.dom.el("span", "matrix-head matrix-total", "Total"));

    rows.forEach(function (row) {
      var total = 0;

      grid.appendChild(APP.dom.el("span", "matrix-label", row.label));

      row.values.forEach(function (value, index) {
        var cell = APP.dom.el("span", "matrix-cell");
        total += value;

        if (value > 0) {
          var fill = APP.charts.ramp(color, 0.18 + 0.82 * value / maximum);
          cell.style.background = fill;
          cell.style.color = APP.charts.readableOn(fill);
          cell.textContent = format(value);
        } else {
          cell.classList.add("matrix-zero");
        }

        cell.title = row.label + " · " + columns[index] + ": " + APP.utils.currency(value);
        grid.appendChild(cell);
      });

      grid.appendChild(APP.dom.el("span", "matrix-total", format(total)));
    });

    root.appendChild(grid);
  };

  // Month calendar aligned to weekdays, one-hue ramp, today outlined, future days dimmed.
  APP.charts.calendar = function (root, days, color) {
    APP.dom.clear(root);

    if (!days.length) {
      APP.charts.message(root, "No daily data is available for this month.");
      return;
    }

    var hue = color || APP.charts.flow.spending;
    var today = APP.utils.isoDate(new Date());
    var total = 0;
    var busiest = null;

    days.forEach(function (day) {
      total += day.value;
      if (!busiest || day.value > busiest.value) {
        busiest = day;
      }
    });

    var maximum = busiest && busiest.value > 0 ? busiest.value : 1;
    var wrap = APP.dom.el("div", "calendar-visual");
    var summary = APP.dom.el("div", "calendar-summary");

    summary.appendChild(APP.dom.el("strong", "", APP.utils.currency(total)));
    summary.appendChild(APP.dom.el("span", "", busiest && busiest.value > 0 ?
      "Highest day: " + Number(busiest.date.slice(8)) + " (" + APP.utils.currency(busiest.value) + ")" :
      "No activity yet this month"));
    wrap.appendChild(summary);

    var grid = APP.dom.el("div", "calendar-heatmap");

    ["S", "M", "T", "W", "T", "F", "S"].forEach(function (letter) {
      grid.appendChild(APP.dom.el("span", "calendar-weekday", letter));
    });

    var first = new Date(days[0].date + "T00:00:00");

    for (var blank = 0; blank < first.getDay(); blank += 1) {
      grid.appendChild(APP.dom.el("span", "calendar-blank"));
    }

    days.forEach(function (day) {
      var cell = APP.dom.el("div", "calendar-day");
      cell.appendChild(APP.dom.el("span", "calendar-date", String(day.day)));

      if (day.value > 0) {
        var fill = APP.charts.ramp(hue, 0.22 + 0.78 * day.value / maximum);
        cell.style.background = fill;
        cell.style.color = APP.charts.readableOn(fill);
        cell.appendChild(APP.dom.el("span", "calendar-amount", APP.charts.compact(day.value)));
      }

      if (day.date === today) {
        cell.classList.add("calendar-today");
      }

      if (day.date > today) {
        cell.classList.add("calendar-future");
      }

      cell.title = day.date + ": " + APP.utils.currency(day.value);
      grid.appendChild(cell);
    });

    wrap.appendChild(grid);

    var legend = APP.dom.el("div", "calendar-legend");
    legend.appendChild(APP.dom.el("span", "", "Less"));
    [0.22, 0.42, 0.62, 0.82, 1].forEach(function (step) {
      var swatch = APP.dom.el("i");
      swatch.style.background = APP.charts.ramp(hue, step);
      legend.appendChild(swatch);
    });
    legend.appendChild(APP.dom.el("span", "", "More"));
    wrap.appendChild(legend);

    root.appendChild(wrap);
  };

  // A labelled bar with an optional pace marker. options: { color, marker, markerLabel,
  // valueText, detailText }.
  APP.charts.meter = function (current, target, options) {
    var config = options || {};
    var root = APP.dom.el("div", "meter");
    var track = APP.dom.el("div", "meter-track");
    var fill = APP.dom.el("span", "meter-fill");
    var ratio = target > 0 ? current / target : 0;

    fill.style.width = Math.min(100, Math.max(0, ratio * 100)) + "%";
    fill.style.background = config.color || APP.charts.status.good;
    track.appendChild(fill);

    if (config.marker !== undefined && target > 0) {
      var marker = APP.dom.el("span", "meter-marker");
      marker.style.left = Math.min(100, Math.max(0, config.marker / target * 100)) + "%";
      marker.title = config.markerLabel || "";
      track.appendChild(marker);
    }

    root.appendChild(track);
    return root;
  };

  APP.charts.progress = function (root, current, target, label, options) {
    var config = options || {};
    APP.dom.clear(root);

    var wrap = APP.dom.el("div", "progress-visual");
    var head = APP.dom.el("div", "progress-head");
    var percentage = target > 0 ? current / target * 100 : 0;

    head.appendChild(APP.dom.el("strong", "", config.valueText ||
      (target > 0 ? Math.round(percentage) + "%" : "—")));
    head.appendChild(APP.dom.el("span", "", config.detailText ||
      label + ": " + APP.utils.currency(current) + " of " + APP.utils.currency(target)));
    wrap.appendChild(head);
    wrap.appendChild(APP.charts.meter(current, target, config));

    if (config.note) {
      wrap.appendChild(APP.dom.el("p", "progress-note", config.note));
    }

    if (config.extra) {
      wrap.appendChild(config.extra);
    }

    root.appendChild(wrap);
  };

  // Half-circle gauge with the headline number drawn in the middle.
  APP.charts.gauge = function (root, key, current, target, color, options) {
    var config = options || {};
    APP.charts.destroy(key);
    APP.dom.clear(root);

    var percentage = target > 0 ?
      Math.min(100, Math.max(0, current / target * 100)) : 0;

    if (!window.Chart) {
      APP.charts.progress(root, current, target, "Completion", config);
      return;
    }

    APP.charts.theme();

    var wrap = APP.dom.el("div", "gauge-wrap");
    var canvasBox = APP.dom.el("div", "gauge-canvas");
    var canvas = APP.dom.el("canvas");
    var center = APP.dom.el("div", "gauge-center");

    canvasBox.appendChild(canvas);
    center.appendChild(APP.dom.el("strong", "", config.valueText ||
      (target > 0 ? Math.round(current / target * 100) + "%" : "—")));
    center.appendChild(APP.dom.el("span", "", config.detailText ||
      APP.utils.currency(current) + " of " + APP.utils.currency(target)));
    canvasBox.appendChild(center);
    wrap.appendChild(canvasBox);

    if (config.note) {
      wrap.appendChild(APP.dom.el("p", "gauge-note", config.note));
    }

    if (config.extra) {
      wrap.appendChild(config.extra);
    }

    root.appendChild(wrap);

    // Keeps the headline inside the arc's opening at any width: centers it on the arc and
    // shrinks the text until it fits between the arc's ends.
    var fitCenter = {
      id: "gaugeCenter",
      afterDraw: function (chart) {
        var arc = chart.getDatasetMeta(0).data[0];

        if (!arc) {
          return;
        }

        var size = Math.round(arc.innerRadius) + ":" + Math.round(arc.x) + ":" + Math.round(arc.y);

        if (center.dataset.fit === size) {
          return;
        }

        center.dataset.fit = size;

        var room = Math.max(120, arc.innerRadius * 1.7);
        var headline = center.querySelector("strong");
        var font = 26;

        center.style.width = room + "px";
        center.style.left = arc.x - room / 2 + "px";
        center.style.right = "auto";
        center.style.bottom = Math.max(0, chart.height - arc.y) + "px";
        headline.style.fontSize = font + "px";

        while (headline.scrollWidth > room && font > 13) {
          font -= 1;
          headline.style.fontSize = font + "px";
        }
      }
    };

    APP.charts.instances[key] = new window.Chart(canvas, {
      type: "doughnut",
      plugins: [fitCenter],
      data: {
        datasets: [{
          data: [percentage, 100 - percentage],
          backgroundColor: [color || APP.charts.status.good, APP.charts.track],
          borderWidth: 0,
          borderRadius: [6, 0],
          cutout: "80%",
          circumference: 180,
          rotation: -90
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 650 },
        layout: { padding: { top: 6, bottom: 0 } },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });

    // Layout is known as soon as the chart exists; fit now rather than waiting for the
    // first animation frame, which a background tab may delay.
    fitCenter.afterDraw(APP.charts.instances[key]);
  };

  // Spent-versus-budget rows. items: { label, spent, budget, kind: "spending" | "debt" |
  // "savings" }. For savings and debt, going past the target is good news, not a warning.
  APP.charts.budgetRows = function (root, items, emptyMessage) {
    APP.dom.clear(root);

    if (!items.length) {
      APP.charts.message(root, emptyMessage ||
        "Set category budgets in Monthly Plan to compare spending against them.");
      return;
    }

    var list = APP.dom.el("div", "budget-rows");

    items.forEach(function (item) {
      var row = APP.dom.el("div", "budget-row");
      var head = APP.dom.el("div", "budget-row-head");
      var status = "";
      var color = item.kind === "debt" ? APP.charts.flow.debt : APP.charts.status.good;
      var difference = item.budget - item.spent;

      if (item.kind === "savings") {
        color = APP.charts.flow.savings;
        status = !item.budget ? "No monthly goal set" :
          difference > 0 ? APP.utils.currency(difference) + " to go" :
            difference < 0 ? APP.utils.currency(-difference) + " ahead of goal" : "Goal met";
      } else if (!item.budget) {
        status = "No budget set";
        color = APP.charts.otherColor;
      } else if (difference < 0) {
        status = item.kind === "debt" ?
          APP.utils.currency(-difference) + " extra paid" :
          APP.utils.currency(-difference) + " over";
        color = item.kind === "debt" ? APP.charts.flow.debt : APP.charts.status.critical;
      } else if (item.spent / item.budget >= 0.9 && item.kind !== "debt") {
        status = APP.utils.currency(difference) + " left";
        color = APP.charts.status.warning;
      } else {
        status = APP.utils.currency(difference) + " left";
      }

      head.appendChild(APP.dom.el("span", "budget-row-name", item.label));
      head.appendChild(APP.dom.el("span", "budget-row-value",
        APP.utils.currency(item.spent) + (item.budget ? " / " + APP.utils.currency(item.budget) : "")));
      row.appendChild(head);

      var scale = Math.max(item.budget, item.spent) || 1;
      var track = APP.dom.el("div", "budget-track");
      var fill = APP.dom.el("span", "budget-fill");

      fill.style.width = Math.min(100, item.spent / scale * 100) + "%";
      fill.style.background = color;
      track.appendChild(fill);

      if (item.budget && item.spent > item.budget && item.kind !== "savings") {
        var mark = APP.dom.el("span", "budget-mark");
        mark.style.left = item.budget / scale * 100 + "%";
        mark.title = "Budget: " + APP.utils.currency(item.budget);
        track.appendChild(mark);
      }

      row.appendChild(track);

      var foot = APP.dom.el("span", "budget-row-status" +
        (difference < 0 && item.kind === "spending" && item.budget ? " is-over" : ""), status);
      row.appendChild(foot);
      list.appendChild(row);
    });

    root.appendChild(list);
  };

  // A grid of progress rings. items: { label, current, target, detail, color }.
  APP.charts.rings = function (root, items, emptyMessage) {
    APP.dom.clear(root);

    if (!items.length) {
      APP.charts.message(root, emptyMessage || "Nothing to show yet.");
      return;
    }

    var grid = APP.dom.el("div", "ring-grid");

    items.forEach(function (item) {
      var ratio = item.target > 0 ? Math.max(0, item.current / item.target) : 0;
      var card = APP.dom.el("div", "ring-card");
      var ring = APP.dom.el("div", "ring");
      var color = item.color || APP.charts.flow.savings;

      ring.style.background = "conic-gradient(" + color + " " + Math.min(100, ratio * 100) +
        "%, " + APP.charts.track + " 0)";
      ring.appendChild(APP.dom.el("span", "", item.target > 0 ? Math.round(ratio * 100) + "%" : "—"));
      card.appendChild(ring);
      card.appendChild(APP.dom.el("strong", "", item.label));
      card.appendChild(APP.dom.el("small", "", item.target > 0 ?
        APP.utils.currency(item.current) + " of " + APP.utils.currency(item.target) :
        APP.utils.currency(item.current) + " saved · no goal set"));

      if (item.detail) {
        card.appendChild(APP.dom.el("small", "ring-detail", item.detail));
      }

      card.title = item.label + ": " + APP.utils.currency(item.current) +
        (item.target > 0 ? " of " + APP.utils.currency(item.target) : "");
      grid.appendChild(card);
    });

    root.appendChild(grid);
  };

  // One row per debt: a bar whose length is the months left to pay off, relative to the
  // longest. items: { label, balance, apr, payment, months, payoffLabel, interest, never }.
  APP.charts.payoffRows = function (root, items, emptyMessage) {
    APP.dom.clear(root);

    if (!items.length) {
      APP.charts.message(root, emptyMessage || "Add debt accounts to estimate payoff dates.");
      return;
    }

    var longest = Math.max.apply(null, items.map(function (item) {
      return item.never ? 0 : item.months;
    })) || 1;

    var list = APP.dom.el("div", "budget-rows");

    items.forEach(function (item) {
      var row = APP.dom.el("div", "budget-row");
      var head = APP.dom.el("div", "budget-row-head");

      head.appendChild(APP.dom.el("span", "budget-row-name", item.label));
      head.appendChild(APP.dom.el("span", "budget-row-value", item.never ?
        "Not paying down" :
        item.payoffLabel + " · " + item.months + (item.months === 1 ? " month" : " months")));
      row.appendChild(head);

      var track = APP.dom.el("div", "budget-track");
      var fill = APP.dom.el("span", "budget-fill");

      fill.style.width = item.never ? "100%" : Math.max(2, item.months / longest * 100) + "%";
      fill.style.background = item.never ? APP.charts.status.critical : APP.charts.flow.debt;
      track.appendChild(fill);
      row.appendChild(track);

      row.appendChild(APP.dom.el("span", "budget-row-status" + (item.never ? " is-over" : ""), item.never ?
        APP.utils.currency(item.payment) + "/mo doesn't cover the interest on " +
          APP.utils.currency(item.balance) + " at " + item.apr + "% APR" :
        APP.utils.currency(item.balance) + " at " + item.apr + "% APR · " +
          APP.utils.currency(item.payment) + "/mo · " +
          APP.utils.currency(item.interest) + " interest to go"));
      list.appendChild(row);
    });

    root.appendChild(list);
  };

  // Small labelled figures shown above a chart. stats: [[label, value, note?]].
  APP.charts.statRow = function (stats) {
    var row = APP.dom.el("div", "pace-stats");

    stats.forEach(function (item) {
      var stat = APP.dom.el("div", "pace-stat");
      stat.appendChild(APP.dom.el("span", "", item[0]));
      stat.appendChild(APP.dom.el("strong", "", item[1]));

      if (item[2]) {
        stat.appendChild(APP.dom.el("small", "", item[2]));
      }

      row.appendChild(stat);
    });

    return row;
  };

  // Income flowing into spending, savings, debt payments and leftover cash, optionally
  // split into categories. model: { sources: [{ label, value, color }],
  // groups: [{ label, value, color, children: [{ label, value }] }], base }.
  APP.charts.sankey = function (root, model, displayMode) {
    APP.dom.clear(root);

    var sources = model.sources.filter(function (item) {
      return item.value > 0;
    });

    var groups = model.groups.filter(function (item) {
      return item.value > 0;
    });

    if (!sources.length || !groups.length) {
      APP.charts.message(root, "No income or cash-flow activity is available for this period.");
      return;
    }

    var hasChildren = groups.some(function (group) {
      return group.children && group.children.length;
    });

    // Phones don't have room for three labelled columns. There, the diagram shows income
    // into the groups, and each group's categories follow as a list that wraps.
    var available = root.clientWidth || 1000;
    var narrow = available < 560;
    var breakdown = narrow && hasChildren;

    hasChildren = hasChildren && !narrow;

    if (narrow) {
      root.style.height = "auto";
    }

    var total = sources.reduce(function (sum, item) {
      return sum + item.value;
    }, 0);

    var base = model.base || total;
    var childCount = groups.reduce(function (sum, group) {
      return sum + Math.max(1, (group.children || []).length);
    }, 0);

    // Drawn at the container's real pixel size so text stays at its intended size.
    var width = narrow ? Math.max(260, available) : Math.max(480, available);
    var nodeWidth = 14;
    var gap = 12;
    var padding = 16;
    var rightCount = hasChildren ? childCount : groups.length;
    var slot = 38;
    var height = narrow ?
      Math.max(200, rightCount * (slot + 12) + padding * 2) :
      Math.max(root.clientHeight || 300, rightCount * (slot + 4) + padding * 2);
    var columnX = narrow ?
      [4, Math.round(width * 0.42)] :
      (hasChildren ? [0.17, 0.5, 0.77] : [0.2, 0.66]).map(function (fraction) {
        return Math.round(width * fraction);
      });
    var ns = "http://www.w3.org/2000/svg";
    var gradientId = 0;
    var uid = "sk" + Math.random().toString(36).slice(2, 8);

    function node(tag, attributes, text) {
      var element = document.createElementNS(ns, tag);

      Object.keys(attributes || {}).forEach(function (name) {
        element.setAttribute(name, attributes[name]);
      });

      if (text !== undefined) {
        element.textContent = text;
      }

      return element;
    }

    function amount(value) {
      var share = base > 0 ? value / base * 100 : 0;

      return displayMode === "percent" ?
        share.toFixed(1) + "% · " + APP.charts.compact(value) :
        APP.utils.currency(value) + " · " + share.toFixed(0) + "%";
    }

    // Vertical room a node takes: its height plus a gap, never less than one label slot
    // so the two-line labels of small neighbouring nodes cannot overlap.
    function room(item, spacing) {
      var h = Math.max(3, item.value * scale);
      return Math.max(h + spacing, slot);
    }

    // Stacks items top to bottom in a column, scaled to the shared value-to-pixel ratio.
    function layout(items, top, spacing) {
      var y = top;

      return items.map(function (item) {
        var h = Math.max(3, item.value * scale);
        var placed = { item: item, y: y + (room(item, spacing) - spacing - h) / 2, h: h, offset: 0 };
        y += room(item, spacing);
        return placed;
      });
    }

    var flat = [];

    groups.forEach(function (group, index) {
      var children = group.children && group.children.length ?
        group.children :
        [{ label: group.label, value: group.value }];

      children.forEach(function (child) {
        flat.push({
          label: child.label,
          value: child.value,
          color: group.color,
          groupIndex: index
        });
      });
    });

    function columnScale(count, spacing) {
      return (height - padding * 2 - spacing * Math.max(0, count - 1)) / total;
    }

    var scale = Math.min(
      columnScale(sources.length, gap),
      columnScale(groups.length, gap * 2),
      hasChildren ? columnScale(childCount, gap) : Infinity
    );

    function columnHeight(items, spacing) {
      return items.reduce(function (sum, item) {
        return sum + room(item, spacing);
      }, 0) - spacing;
    }

    // Label slots add height the value scale did not account for; shrink until every
    // column fits inside the padding.
    for (var attempt = 0; attempt < 60; attempt += 1) {
      var tallest = Math.max(
        columnHeight(sources, gap),
        columnHeight(groups, gap * 2),
        hasChildren ? columnHeight(flat, gap) : 0
      );

      if (tallest <= height - padding * 2) {
        break;
      }

      scale *= 0.94;
    }

    function centered(items, spacing) {
      var used = columnHeight(items, spacing);

      return layout(items, Math.max(padding, (height - used) / 2), spacing);
    }

    var sourceNodes = centered(sources, gap);
    var groupNodes = centered(groups, gap * 2);
    var childNodes = hasChildren ? centered(flat, gap) : [];

    var svg = node("svg", {
      viewBox: "0 0 " + width + " " + height,
      preserveAspectRatio: "xMidYMin meet",
      width: width,
      height: height,
      "class": "sankey-svg",
      role: "img",
      "aria-label": "Income allocation flow diagram"
    });

    var defs = node("defs");
    svg.appendChild(defs);

    function band(fromX, fromY, toX, toY, h, fromColor, toColor, tip) {
      var id = uid + "g" + (gradientId += 1);
      var gradient = node("linearGradient", { id: id, x1: "0", x2: "1", y1: "0", y2: "0" });

      gradient.appendChild(node("stop", { offset: "0%", "stop-color": fromColor }));
      gradient.appendChild(node("stop", { offset: "100%", "stop-color": toColor }));
      defs.appendChild(gradient);

      var x0 = fromX + nodeWidth;
      var middle = (x0 + toX) / 2;
      var path = node("path", {
        d: "M" + x0 + " " + fromY +
          " C" + middle + " " + fromY + " " + middle + " " + toY + " " + toX + " " + toY +
          " L" + toX + " " + (toY + h) +
          " C" + middle + " " + (toY + h) + " " + middle + " " + (fromY + h) + " " + x0 + " " + (fromY + h) + " Z",
        fill: "url(#" + id + ")",
        "class": "sankey-band"
      });

      path.appendChild(node("title", {}, tip));
      svg.appendChild(path);
    }

    function nodeRect(x, placed, color, tip) {
      var rect = node("rect", {
        x: x,
        y: placed.y,
        width: nodeWidth,
        height: placed.h,
        rx: 3,
        fill: color,
        "class": "sankey-node"
      });

      rect.appendChild(node("title", {}, tip));
      svg.appendChild(rect);
    }

    function fit(text, space) {
      var limit = Math.max(6, Math.floor(space / 7.4));
      return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
    }

    function label(x, y, anchor, title, detail) {
      // Room to the left edge (or the previous column) for end-anchored labels, else the right edge.
      var leftBound = x > columnX[0] ? columnX[0] + nodeWidth : 0;
      var space = anchor === "end" ? x - leftBound : width - x;
      title = fit(title, space - 4);
      var text = node("text", {
        x: x,
        y: y,
        "text-anchor": anchor,
        "class": "sankey-label"
      });

      text.appendChild(node("tspan", { x: x, dy: "-0.2em", "class": "sankey-label-title" }, title));
      text.appendChild(node("tspan", { x: x, dy: "1.25em", "class": "sankey-label-value" }, detail));
      svg.appendChild(text);
    }

    // Bands from each source into each group, apportioned by the source's share.
    sourceNodes.forEach(function (source) {
      groupNodes.forEach(function (group) {
        var share = group.item.value * (source.item.value / total);
        var h = share * scale;

        if (h <= 0) {
          return;
        }

        band(
          columnX[0], source.y + source.offset,
          columnX[1], group.y + group.offset,
          h,
          source.item.color,
          group.item.color,
          source.item.label + " → " + group.item.label + ": " + APP.utils.currency(share)
        );

        source.offset += h;
        group.offset += h;
      });
    });

    if (hasChildren) {
      groupNodes.forEach(function (group) {
        group.offset = 0;
      });

      childNodes.forEach(function (child) {
        var group = groupNodes[child.item.groupIndex];
        var h = child.item.value * scale;

        band(
          columnX[1], group.y + group.offset,
          columnX[2], child.y,
          h,
          group.item.color,
          child.item.color,
          group.item.label + " → " + child.item.label + ": " + APP.utils.currency(child.item.value)
        );

        group.offset += h;
      });
    }

    sourceNodes.forEach(function (source) {
      nodeRect(columnX[0], source, source.item.color, source.item.label + ": " + APP.utils.currency(source.item.value));

      // On phones the sources are named in a line above the diagram instead.
      if (!narrow) {
        label(columnX[0] - 10, source.y + source.h / 2, "end", source.item.label, amount(source.item.value));
      }
    });

    groupNodes.forEach(function (group) {
      nodeRect(columnX[1], group, group.item.color, group.item.label + ": " + APP.utils.currency(group.item.value));

      if (hasChildren) {
        label(columnX[1] - 10, group.y + group.h / 2, "end", group.item.label, amount(group.item.value));
      } else {
        label(columnX[1] + nodeWidth + 10, group.y + group.h / 2, "start", group.item.label, amount(group.item.value));
      }
    });

    childNodes.forEach(function (child) {
      nodeRect(columnX[2], child, child.item.color, child.item.label + ": " + APP.utils.currency(child.item.value));
      label(columnX[2] + nodeWidth + 10, child.y + child.h / 2, "start",
        child.item.label, amount(child.item.value));
    });

    if (narrow) {
      var heading = APP.dom.el("div", "sankey-sources");

      sources.forEach(function (source) {
        var item = APP.dom.el("span", "sankey-key");
        var swatch = APP.dom.el("i");
        swatch.style.background = source.color;
        item.appendChild(swatch);
        item.appendChild(APP.dom.el("strong", "", source.label));
        item.appendChild(document.createTextNode(" " + amount(source.value)));
        heading.appendChild(item);
      });

      root.appendChild(heading);
    }

    root.appendChild(svg);

    if (breakdown) {
      var list = APP.dom.el("div", "sankey-breakdown");

      groups.forEach(function (group) {
        if (!group.children || !group.children.length) {
          return;
        }

        var section = APP.dom.el("div", "sankey-breakdown-group");
        var title = APP.dom.el("div", "sankey-key");
        var swatch = APP.dom.el("i");

        swatch.style.background = group.color;
        title.appendChild(swatch);
        title.appendChild(APP.dom.el("strong", "", group.label));
        section.appendChild(title);

        group.children.forEach(function (child) {
          var row = APP.dom.el("div", "sankey-breakdown-row");
          row.appendChild(APP.dom.el("span", "", child.label));
          row.appendChild(APP.dom.el("span", "sankey-breakdown-value", amount(child.value)));
          section.appendChild(row);
        });

        list.appendChild(section);
      });

      root.appendChild(list);
    }
  };

  // Floating-bar waterfall: steps are { label, value, kind } where kind picks the flow
  // color; the last step is drawn as a total bar from zero. Connector lines join each
  // bar's end to the next bar's start and each bar carries its value above it.
  APP.charts.waterfall = function (root, key, steps) {
    var running = 0;
    var labels = [];
    var ranges = [];
    var colors = [];

    steps.forEach(function (step) {
      if (step.kind === "total") {
        ranges.push([0, step.value]);
        running = step.value;
      } else {
        var start = running;
        running += step.value;
        ranges.push([start, running]);
      }

      labels.push(step.label);
      colors.push(
        step.kind === "total" ?
          (step.value >= 0 ? APP.charts.flow.income : APP.charts.status.critical) :
          APP.charts.flow[step.kind] || APP.charts.flow.spending
      );
    });

    var annotate = {
      id: "waterfallAnnotate",
      afterDatasetsDraw: function (chart) {
        var meta = chart.getDatasetMeta(0);
        var context = chart.ctx;
        var y = chart.scales.y;

        context.save();

        meta.data.forEach(function (bar, index) {
          var range = ranges[index];
          var step = steps[index];
          var endValue = step.kind === "total" ? range[1] : range[1];

          if (index < meta.data.length - 1) {
            var next = meta.data[index + 1];
            var level = y.getPixelForValue(endValue);

            context.strokeStyle = "rgba(154,173,195,.45)";
            context.lineWidth = 1;
            context.setLineDash([3, 3]);
            context.beginPath();
            context.moveTo(bar.x + bar.width / 2, level);
            context.lineTo(next.x - next.width / 2, level);
            context.stroke();
          }

          var top = Math.min(bar.y, bar.base);
          var text = (step.kind === "total" || step.kind === "income" ? "" :
            step.value < 0 ? "−" : "+") + APP.charts.compact(Math.abs(step.value));

          context.setLineDash([]);
          context.fillStyle = "#dbe7f5";
          context.font = '600 11px Inter, system-ui, sans-serif';
          context.textAlign = "center";
          context.textBaseline = "bottom";
          context.fillText(
            step.kind === "total" ? APP.charts.compact(step.value) : text,
            bar.x,
            top - 5
          );
        });

        context.restore();
      }
    };

    APP.charts.chart(root, key, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Cash-flow waterfall",
          data: ranges,
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 56,
          categoryPercentage: 0.7
        }]
      },
      plugins: [annotate],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 20 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                var step = steps[context.dataIndex];
                return " " + (step.kind === "total" ? "Result" : step.value < 0 ? "Out" : "In") +
                  ": " + APP.utils.currency(step.value);
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { autoSkip: false, maxRotation: 40, font: { size: 11 } }
          },
          y: {
            border: { display: false },
            ticks: {
              maxTicksLimit: 6,
              callback: function (value) {
                return APP.charts.compact(value);
              }
            }
          }
        }
      }
    });
  };
}());
