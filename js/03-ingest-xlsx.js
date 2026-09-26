(function () {
  "use strict";

  var APP = window.APP;
  APP.ingest = {};

  APP.ingest.aliases = {
    date: ["date", "transaction date", "posted date", "trans date"],
    description: ["description", "merchant", "payee", "name", "transaction description"],
    category: ["category", "transaction category"],
    type: ["type", "transaction type", "income expense", "debit credit"],
    amount: ["amount", "transaction amount", "value"],
    notes: ["notes", "note", "memo", "comments", "comment"]
  };

  APP.ingest.parseCsv = function (text) {
    var rows = [], row = [], cell = "", quoted = false, i;

    for (i = 0; i < text.length; i += 1) {
      var character = text[i];
      var next = text[i + 1];

      if (character === "\"") {
        if (quoted && next === "\"") {
          cell += "\"";
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && next === "\n") {
          i += 1;
        }
        row.push(cell);
        if (row.some(function (item) { return APP.utils.text(item); })) {
          rows.push(row);
        }
        row = [];
        cell = "";
      } else {
        cell += character;
      }
    }

    row.push(cell);
    if (row.some(function (item) { return APP.utils.text(item); })) {
      rows.push(row);
    }

    return rows;
  };

  APP.ingest.headerMap = function (rows) {
    var best = null;

    rows.slice(0, 30).forEach(function (row, rowIndex) {
      var headers = row.map(APP.utils.header);
      var map = {};
      var score = 0;

      Object.keys(APP.ingest.aliases).forEach(function (field) {
        headers.forEach(function (header, columnIndex) {
          if (map[field] === undefined &&
              APP.ingest.aliases[field].indexOf(header) !== -1) {
            map[field] = columnIndex;
            if (["date", "description", "amount"].indexOf(field) !== -1) {
              score += 1;
            }
          }
        });
      });

      if (!best || score > best.score) {
        best = { rowIndex: rowIndex, map: map, score: score };
      }
    });

    return best && best.score >= 2 ? best : null;
  };

  APP.ingest.toRecords = function (rows) {
    var detected = APP.ingest.headerMap(rows);

    if (!detected) {
      return {
        records: [],
        warnings: ["No usable header row found. Include Date, Description, and Amount columns."]
      };
    }

    if (detected.map.date === undefined || detected.map.amount === undefined) {
      return {
        records: [],
        warnings: ["Date and Amount columns are required for transaction import."]
      };
    }

    return {
      warnings: [],
      records: rows.slice(detected.rowIndex + 1).map(function (row, index) {
        function value(name) {
          return detected.map[name] === undefined ? "" : row[detected.map[name]];
        }

        return {
          sourceRow: detected.rowIndex + index + 2,
          date: value("date"),
          description: value("description"),
          category: value("category"),
          type: value("type"),
          amount: value("amount"),
          notes: value("notes")
        };
      }).filter(function (record) {
        return Object.keys(record).some(function (key) {
          return key !== "sourceRow" && APP.utils.text(record[key]);
        });
      })
    };
  };

  APP.ingest.read = function (file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("Select a CSV or XLSX file first."));
        return;
      }

      var reader = new FileReader();
      var isCsv = /\.csv$/i.test(file.name);

      reader.onerror = function () {
        reject(new Error("The selected file could not be read."));
      };

      reader.onload = function (event) {
        try {
          if (isCsv) {
            resolve(APP.ingest.toRecords(APP.ingest.parseCsv(String(event.target.result || ""))));
            return;
          }

          if (!window.XLSX) {
            reject(new Error("XLSX import is unavailable because the optional SheetJS library did not load."));
            return;
          }

          var workbook = window.XLSX.read(event.target.result, { type: "array", cellDates: true });
          var sheet = workbook.Sheets[workbook.SheetNames[0]];
          var rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

          resolve(APP.ingest.toRecords(rows));
        } catch (error) {
          reject(new Error("The selected file could not be parsed as CSV or XLSX."));
        }
      };

      if (isCsv) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };
}());