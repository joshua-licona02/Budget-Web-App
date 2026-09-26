(function () {
  "use strict";

  var APP = window.APP;

  APP.charts = {
    instances: {}
  };

  APP.charts.destroy = function (key) {
    if (APP.charts.instances[key]) {
      APP.charts.instances[key].destroy();
      delete APP.charts.instances[key];
    }
  };

  APP.charts.message = function (root, message) {
    APP.dom.clear(root);
    root.appendChild(APP.dom.el("p", "muted", message));
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

    var canvas = APP.dom.el("canvas");
    root.appendChild(canvas);
    APP.charts.instances[key] = new window.Chart(canvas, config);
  };

  APP.charts.moneyOptions = function (stacked, area) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#dbeafe" }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.dataset.label + ": " + APP.utils.currency(context.raw);
            }
          }
        }
      },
      scales: {
        x: {
          stacked: Boolean(stacked),
          ticks: { color: "#9aadc3" },
          grid: { color: "rgba(154,173,195,.12)" }
        },
        y: {
          stacked: Boolean(stacked),
          ticks: {
            color: "#9aadc3",
            callback: function (value) {
              return APP.utils.currency(value);
            }
          },
          grid: { color: "rgba(154,173,195,.12)" }
        }
      },
      elements: {
        line: {
          fill: Boolean(area),
          tension: 0.28
        }
      }
    };
  };

  APP.charts.heatmap = function (root, cells) {
    APP.dom.clear(root);

    if (!cells.length) {
      APP.charts.message(root, "No spending data is available for this heatmap.");
      return;
    }

    var maximum = Math.max.apply(null, cells.map(function (cell) {
      return cell.value;
    })) || 1;

    var grid = APP.dom.el("div", "heatmap-grid");

    cells.forEach(function (cell) {
      var intensity = Math.max(.08, cell.value / maximum);
      var tile = APP.dom.el("div", "heatmap-cell");

      tile.style.background = "rgba(96,165,250," + intensity + ")";
      tile.title = cell.label + ": " + APP.utils.currency(cell.value);
      tile.appendChild(APP.dom.el("span", "", cell.shortLabel));
      grid.appendChild(tile);
    });

    root.appendChild(grid);
  };

  APP.charts.calendar = function (root, days) {
    APP.dom.clear(root);

    if (!days.length) {
      APP.charts.message(root, "No daily spending data is available for this month.");
      return;
    }

    var maximum = Math.max.apply(null, days.map(function (day) {
      return day.value;
    })) || 1;

    var grid = APP.dom.el("div", "calendar-heatmap");

    days.forEach(function (day) {
      var cell = APP.dom.el("div", "calendar-day", String(day.day));
      var intensity = Math.max(.07, day.value / maximum);

      cell.style.background = "rgba(74,222,128," + intensity + ")";
      cell.title = day.date + ": " + APP.utils.currency(day.value);
      grid.appendChild(cell);
    });

    root.appendChild(grid);
  };

  APP.charts.progress = function (root, current, target, label) {
    APP.dom.clear(root);

    root.appendChild(APP.dom.el(
      "p",
      "muted",
      label + ": " + APP.utils.currency(current) +
      " of " + APP.utils.currency(target)
    ));

    root.appendChild(APP.ui.progress(current, target));
  };

  APP.charts.gauge = function (root, key, current, target, color) {
    APP.charts.destroy(key);
    APP.dom.clear(root);

    var percentage = target > 0 ?
      Math.min(100, Math.max(0, current / target * 100)) : 0;

    if (!window.Chart) {
      APP.charts.progress(root, current, target, "Completion");
      return;
    }

    var canvas = APP.dom.el("canvas");
    root.appendChild(canvas);

    APP.charts.instances[key] = new window.Chart(canvas, {
      type: "doughnut",
      data: {
        datasets: [{
          data: [percentage, 100 - percentage],
          backgroundColor: [color || "#4ade80", "#223147"],
          borderWidth: 0,
          cutout: "76%"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });

    root.appendChild(APP.dom.el(
      "p",
      "gauge-label",
      percentage.toFixed(1) + "% complete"
    ));
  };

     APP.charts.sankey = function (
    root,
    flows,
    sourceLabel,
    displayMode
  ) {
    APP.dom.clear(root);

    flows = flows.filter(function (flow) {
      return APP.utils.money(flow.value) > 0;
    });

    if (!flows.length) {
      APP.charts.message(
        root,
        "No positive cash-flow allocations are available for this period."
      );
      return;
    }

    var total = flows.reduce(function (sum, flow) {
      return sum + APP.utils.money(flow.value);
    }, 0) || 1;

    var width = 980;
    var padding = 28;
    var rowGap = 12;
    var rowHeight = 48;

    var height = Math.max(
      330,
      padding * 2 +
      flows.length * rowHeight +
      Math.max(0, flows.length - 1) * rowGap
    );

    var sourceX = 42;
    var sourceWidth = 125;
    var destinationX = 700;
    var destinationWidth = 190;
    var sourceY = padding;
    var sourceHeight = height - padding * 2;

    var svgNamespace = "http://www.w3.org/2000/svg";

    var svg = document.createElementNS(svgNamespace, "svg");

    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("class", "sankey-svg");
    svg.setAttribute("role", "img");

    function svgNode(tag, attributes, text) {
      var node = document.createElementNS(svgNamespace, tag);

      Object.keys(attributes || {}).forEach(function (key) {
        node.setAttribute(key, attributes[key]);
      });

      if (text !== undefined) {
        node.textContent = text;
      }

      return node;
    }

    function labelValue(value) {
      return displayMode === "percent" ?
        APP.utils.money(value).toFixed(1) + "%" :
        APP.utils.currency(value);
    }

    svg.appendChild(svgNode("rect", {
      x: sourceX,
      y: sourceY,
      width: sourceWidth,
      height: sourceHeight,
      rx: 12,
      fill: "#2563eb"
    }));

    svg.appendChild(svgNode("text", {
      x: sourceX + sourceWidth / 2,
      y: sourceY + 32,
      "text-anchor": "middle",
      fill: "#ffffff",
      "font-size": "16",
      "font-weight": "700"
    }, sourceLabel || "Income"));

    svg.appendChild(svgNode("text", {
      x: sourceX + sourceWidth / 2,
      y: sourceY + 56,
      "text-anchor": "middle",
      fill: "#dbeafe",
      "font-size": "13"
    }, displayMode === "percent" ? "100.0%" : APP.utils.currency(total)));

    flows.forEach(function (flow, index) {
      var destinationY =
        padding + index * (rowHeight + rowGap);

      var middleY = destinationY + rowHeight / 2;
      var sourceMiddleY =
        sourceY + sourceHeight / 2;

      svg.appendChild(svgNode("path", {
        d:
          "M " + (sourceX + sourceWidth) + " " + sourceMiddleY +
          " C 340 " + sourceMiddleY +
          ", 500 " + middleY +
          ", " + destinationX + " " + middleY,

        fill: "none",
        stroke: flow.color || "#60a5fa",
        "stroke-width": Math.max(
          8,
          Math.min(
            30,
            sourceHeight * (APP.utils.money(flow.value) / total)
          )
        ),
        "stroke-opacity": "0.6"
      }));

      svg.appendChild(svgNode("rect", {
        x: destinationX,
        y: destinationY,
        width: destinationWidth,
        height: rowHeight,
        rx: 8,
        fill: flow.color || "#60a5fa"
      }));

      svg.appendChild(svgNode("text", {
        x: destinationX + 12,
        y: destinationY + 20,
        fill: "#ffffff",
        "font-size": "13",
        "font-weight": "700"
      }, flow.label));

      svg.appendChild(svgNode("text", {
        x: destinationX + 12,
        y: destinationY + 38,
        fill: "#eff6ff",
        "font-size": "12"
      }, labelValue(flow.value)));
    });

    root.appendChild(svg);
  };

    APP.charts.waterfall = function (root, key, steps) {
    var running = 0;
    var labels = [];
    var values = [];

    steps.forEach(function (step) {
      var start = running;
      running += step.value;
      labels.push(step.label);
      values.push([Math.min(start, running), Math.max(start, running)]);
    });

    APP.charts.chart(root, key, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Cash-flow waterfall",
          data: values,
          backgroundColor: steps.map(function (step) {
            return step.value >= 0 ? "#4ade80" : "#fb7185";
          })
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                return steps[context.dataIndex].label + ": " +
                  APP.utils.currency(steps[context.dataIndex].value);
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: "#9aadc3" },
            grid: { display: false }
          },
          y: {
            ticks: {
              color: "#9aadc3",
              callback: function (value) {
                return APP.utils.currency(value);
              }
            },
            grid: { color: "rgba(154,173,195,.12)" }
          }
        }
      }
    });
  };
}());