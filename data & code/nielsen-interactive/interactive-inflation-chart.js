(function () {
  'use strict';

  var explorer = document.getElementById('fig-explorer');
  if (!explorer) return;

  var measureSelect = document.getElementById('fig-measure');
  var profileSelect = document.getElementById('fig-profile');
  var summarySelect = document.getElementById('fig-summary');
  var stage = document.getElementById('fig-stage');
  var note = document.getElementById('fig-note');
  var dataset;

  var COLORS = ['#1e3a5f', '#2563a8', '#5b8a72', '#b5651d', '#7b5ea7', '#4f7c8a'];
  var BLS_COLOR = '#8c2f39';
  var WIDTH = 900;
  var HEIGHT = 450;
  var MARGIN = { left: 62, right: 20, top: 18, bottom: 54 };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function parseDate(value) {
    var parts = String(value).split('-');
    return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function formatValue(value) {
    if (value == null || !Number.isFinite(Number(value))) return 'Not available';
    return Number(value).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%';
  }

  function formatMonth(value) {
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(parseDate(value)));
  }

  function niceStep(range) {
    if (!Number.isFinite(range) || range <= 0) return 1;
    var power = Math.pow(10, Math.floor(Math.log10(range)));
    var fraction = range / power;
    return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
  }

  function pathFor(points, xScale, yScale, valueKey) {
    var path = '';
    var drawing = false;
    points.forEach(function (point) {
      var value = point[valueKey];
      if (value == null) {
        drawing = false;
        return;
      }
      path += (drawing ? 'L' : 'M') + xScale(parseDate(point.date)).toFixed(2) + ' ' + yScale(value).toFixed(2) + ' ';
      drawing = true;
    });
    return path.trim();
  }

  function render() {
    if (!dataset) return;

    var measureId = measureSelect.value;
    var profileId = profileSelect.value;
    var summary = summarySelect.value;
    var measure = dataset.measures[measureId];
    var profile = measure.profiles[profileId];
    var surveySeries = profile.series.map(function (series, index) {
      return {
        label: series.label,
        color: COLORS[index % COLORS.length],
        points: series.points
      };
    });
    var showBls = profileId === 'full';
    var bls = showBls ? measure.bls : null;
    var allDates = [];
    var values = [];

    surveySeries.forEach(function (series) {
      series.points.forEach(function (point) {
        allDates.push(parseDate(point.date));
        if (point[summary] != null) values.push(Number(point[summary]));
      });
    });
    if (bls) {
      bls.points.forEach(function (point) {
        allDates.push(parseDate(point.date));
        if (point.value != null) values.push(Number(point.value));
      });
    }

    var dataMinDate = Math.min.apply(null, allDates);
    var dataMaxDate = Math.max.apply(null, allDates);
    var minYear = new Date(dataMinDate).getUTCFullYear();
    var maxYear = new Date(dataMaxDate).getUTCFullYear();
    var minDate = Date.UTC(minYear, 0, 1);
    var maxDate = Date.UTC(maxYear, 11, 31);
    var plotWidth = WIDTH - MARGIN.left - MARGIN.right;
    var plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    var rawMax = Math.max.apply(null, values);
    var rawMin = Math.min.apply(null, values);
    var yMin = Math.min(0, rawMin);
    var step = niceStep((rawMax - yMin) / 5);
    var yMax = Math.ceil(rawMax / step) * step;
    yMin = Math.floor(yMin / step) * step;
    if (yMax <= rawMax) yMax += step;
    if (yMax === yMin) yMax = yMin + step;

    function xScale(date) {
      return MARGIN.left + ((date - minDate) / Math.max(1, maxDate - minDate)) * plotWidth;
    }

    function yScale(value) {
      return MARGIN.top + (1 - (Number(value) - yMin) / (yMax - yMin)) * plotHeight;
    }

    var grid = '';
    for (var tick = yMin; tick <= yMax + step / 1000; tick += step) {
      var tickY = yScale(tick);
      grid += '<line x1="' + MARGIN.left + '" x2="' + (WIDTH - MARGIN.right) + '" y1="' + tickY + '" y2="' + tickY + '" stroke="#dde3ea"/>';
      grid += '<text x="' + (MARGIN.left - 9) + '" y="' + (tickY + 4) + '" text-anchor="end">' + escapeHtml(Number(tick.toFixed(4)).toLocaleString('en-US')) + '</text>';
    }

    for (var year = minYear; year <= maxYear; year += 1) {
      var yearDate = Date.UTC(year, 0, 1);
      var yearX = xScale(yearDate);
      grid += '<line x1="' + yearX + '" x2="' + yearX + '" y1="' + (HEIGHT - MARGIN.bottom) + '" y2="' + (HEIGHT - MARGIN.bottom + 5) + '" stroke="#888"/>';
      grid += '<text x="' + yearX + '" y="' + (HEIGHT - MARGIN.bottom + 20) + '" text-anchor="middle">' + year + '</text>';
    }

    var lines = '';
    if (bls) {
      lines += '<path d="' + pathFor(bls.points, xScale, yScale, 'value') + '" fill="none" stroke="' + BLS_COLOR + '" stroke-width="2.2" vector-effect="non-scaling-stroke"/>';
    }
    surveySeries.forEach(function (series) {
      lines += '<path d="' + pathFor(series.points, xScale, yScale, summary) + '" fill="none" stroke="' + series.color + '" stroke-width="2.2" vector-effect="non-scaling-stroke"/>';
      series.points.forEach(function (point) {
        if (point[summary] == null) return;
        lines += '<circle cx="' + xScale(parseDate(point.date)) + '" cy="' + yScale(point[summary]) + '" r="3" fill="' + series.color + '" stroke="#fff" stroke-width="1" vector-effect="non-scaling-stroke"/>';
      });
    });

    var title = measure.label + ' — ' + profile.label + ' — ' + (summary === 'mean' ? 'Mean' : 'Median');
    var legendItems = surveySeries.map(function (series) {
      return '<span><i class="interactive-chart-swatch" style="background:' + series.color + '"></i>' + escapeHtml(series.label) + '</span>';
    });
    if (bls) {
      legendItems.push('<span><i class="interactive-chart-swatch" style="background:' + BLS_COLOR + '"></i>' + escapeHtml(bls.label) + '</span>');
    }

    stage.innerHTML =
      '<div class="interactive-chart-head"><p class="fig-title">' + escapeHtml(title) + '</p><span class="interactive-chart-unit">Percent</span></div>' +
      '<div class="interactive-chart-legend">' + legendItems.join('') + '</div>' +
      '<svg class="interactive-chart-svg" viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" role="img" tabindex="0" aria-label="' + escapeHtml(title + '. Use the pointer or arrow keys to inspect values by survey wave.') + '">' +
        grid +
        '<line x1="' + MARGIN.left + '" x2="' + (WIDTH - MARGIN.right) + '" y1="' + (HEIGHT - MARGIN.bottom) + '" y2="' + (HEIGHT - MARGIN.bottom) + '" stroke="#888"/>' +
        lines +
        '<g data-hover-layer visibility="hidden"><line data-hover-line y1="' + MARGIN.top + '" y2="' + (HEIGHT - MARGIN.bottom) + '" stroke="#2563a8" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/><g data-hover-dots></g></g>' +
      '</svg>' +
      '<div class="interactive-chart-tooltip" data-chart-tooltip hidden></div>';

    note.hidden = false;
    note.textContent = summary === 'mean'
      ? 'Mean values are raw, unweighted arithmetic means. ' + (bls ? bls.label + ' is shown only in the full-sample view.' : 'BLS inflation is shown only in the full-sample view.')
      : 'Median values are unweighted survey medians. ' + (bls ? bls.label + ' is shown only in the full-sample view.' : 'BLS inflation is shown only in the full-sample view.');

    bindInteraction(stage.querySelector('svg'), stage.querySelector('[data-chart-tooltip]'), surveySeries, bls, summary, xScale, yScale);
  }

  function bindInteraction(svg, tooltip, surveySeries, bls, summary, xScale, yScale) {
    var hoverLayer = svg.querySelector('[data-hover-layer]');
    var hoverLine = svg.querySelector('[data-hover-line]');
    var hoverDots = svg.querySelector('[data-hover-dots]');
    var anchorMap = {};
    surveySeries.forEach(function (series) {
      series.points.forEach(function (point) {
        if (!anchorMap[point.date]) anchorMap[point.date] = { date: point.date, wave: point.wave };
      });
    });
    var anchors = Object.keys(anchorMap).sort().map(function (date) { return anchorMap[date]; });
    var blsMap = {};
    if (bls) bls.points.forEach(function (point) { blsMap[point.date] = point.value; });
    var index = 0;

    function pointAt(series, date) {
      for (var i = 0; i < series.points.length; i += 1) {
        if (series.points[i].date === date) return series.points[i];
      }
      return null;
    }

    function show(anchorIndex, clientX) {
      index = Math.max(0, Math.min(anchors.length - 1, anchorIndex));
      var anchor = anchors[index];
      var x = xScale(parseDate(anchor.date));
      var rows = [];
      var dots = '';

      surveySeries.forEach(function (series) {
        var point = pointAt(series, anchor.date);
        var value = point ? point[summary] : null;
        rows.push({ label: series.label, color: series.color, value: value });
        if (value != null) dots += '<circle cx="' + x + '" cy="' + yScale(value) + '" r="4.5" fill="' + series.color + '" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
      });
      if (bls) {
        var blsValue = Object.prototype.hasOwnProperty.call(blsMap, anchor.date) ? blsMap[anchor.date] : null;
        rows.push({ label: bls.label, color: BLS_COLOR, value: blsValue });
        if (blsValue != null) dots += '<circle cx="' + x + '" cy="' + yScale(blsValue) + '" r="4.5" fill="' + BLS_COLOR + '" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
      }

      hoverLine.setAttribute('x1', x);
      hoverLine.setAttribute('x2', x);
      hoverDots.innerHTML = dots;
      hoverLayer.setAttribute('visibility', 'visible');

      tooltip.innerHTML = '<strong>' + escapeHtml(formatMonth(anchor.date) + ' · ' + anchor.wave) + '</strong>' + rows.map(function (row) {
        return '<div class="interactive-tooltip-row"><span class="interactive-tooltip-label"><i class="interactive-chart-swatch" style="background:' + row.color + '"></i>' + escapeHtml(row.label) + '</span><span class="interactive-tooltip-value">' + escapeHtml(formatValue(row.value)) + '</span></div>';
      }).join('');
      tooltip.hidden = false;

      var stageRect = stage.getBoundingClientRect();
      var svgRect = svg.getBoundingClientRect();
      var pixelX = svgRect.left - stageRect.left + (x / WIDTH) * svgRect.width;
      var desiredLeft = clientX == null ? pixelX + 12 : clientX - stageRect.left + 12;
      var maxLeft = stage.clientWidth - tooltip.offsetWidth - 6;
      if (desiredLeft > maxLeft) desiredLeft = pixelX - tooltip.offsetWidth - 12;
      tooltip.style.left = Math.max(6, desiredLeft) + 'px';
      tooltip.style.top = Math.max(48, svgRect.top - stageRect.top + 12) + 'px';
    }

    function hide() {
      hoverLayer.setAttribute('visibility', 'hidden');
      tooltip.hidden = true;
    }

    svg.addEventListener('pointermove', function (event) {
      var rect = svg.getBoundingClientRect();
      var svgX = ((event.clientX - rect.left) / rect.width) * WIDTH;
      var nearest = 0;
      var distance = Infinity;
      anchors.forEach(function (anchor, anchorIndex) {
        var candidate = Math.abs(xScale(parseDate(anchor.date)) - svgX);
        if (candidate < distance) {
          distance = candidate;
          nearest = anchorIndex;
        }
      });
      show(nearest, event.clientX);
    });
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('focus', function () { show(index); });
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      show(index + (event.key === 'ArrowRight' ? 1 : -1));
    });
  }

  function populateControls() {
    measureSelect.innerHTML = Object.keys(dataset.measures).map(function (id) {
      return '<option value="' + escapeHtml(id) + '">' + escapeHtml(dataset.measures[id].label) + '</option>';
    }).join('');
    profileSelect.innerHTML = dataset.profiles.map(function (profile) {
      return '<option value="' + escapeHtml(profile.id) + '">' + escapeHtml(profile.label) + '</option>';
    }).join('');
    measureSelect.disabled = false;
    profileSelect.disabled = false;
    summarySelect.disabled = false;
    measureSelect.value = 'expectations';
    profileSelect.value = 'full';
    summarySelect.value = 'mean';
    [measureSelect, profileSelect, summarySelect].forEach(function (select) {
      select.addEventListener('change', render);
    });
    render();
  }

  dataset = window.NIELSEN_INTERACTIVE_INFLATION_DATA;
  if (dataset) {
    populateControls();
  } else {
    stage.innerHTML = '<div class="interactive-chart-error">The interactive survey figures could not be loaded. Please try again later.</div>';
  }
}());
