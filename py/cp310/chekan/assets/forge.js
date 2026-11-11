/* Кузница — построчный перенос ForgeAnimation.swift из CehoIsland.

   Все координаты в долях 0..1: контекст масштабируется в единичный квадрат
   (ctx.scale(side, side)), как context.scaleBy(x: side, y: side) в оригинале.
   Константы, цвета и порядок слоёв не пересчитывались, палитра фиксированная —
   она принадлежит мотиву, а не теме страницы.

   Состояние читается из document.body.dataset.forge каждый кадр: forging —
   30 к/с, спокойное — 12 к/с, как minimumInterval у TimelineView в каноне.
   При prefers-reduced-motion рисуется один статичный кадр. */
(function () {
  "use strict";

  var canvas = document.querySelector("canvas.forge");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var CYCLE = 0.82;
  var IX = 0.505;
  var IY = 0.455;

  // MARK: - Палитра

  var ACCENT = [46, 140, 102];
  var ACCENT_BRIGHT = [95, 214, 166];
  var DARK = [20, 25, 22];
  var WHITE = [255, 255, 255];
  var BLACK = [0, 0, 0];
  /* SwiftUI Color.orange — это systemOrange, а не чистый #FF8000. */
  var ORANGE = [255, 149, 0];

  var WOOD_DARK = rgb(0.27, 0.16, 0.09);
  var WOOD_LIT = rgb(0.56, 0.33, 0.16);
  var WOOD_MID = rgb(0.34, 0.19, 0.1);

  var STEEL_1 = rgb(0.74, 0.77, 0.79);
  var STEEL_2 = rgb(0.5, 0.54, 0.56);
  var STEEL_3 = rgb(0.26, 0.29, 0.31);
  var STEEL_4 = rgb(0.11, 0.13, 0.14);
  var BAND_1 = rgb(0.62, 0.65, 0.67);
  var BAND_2 = rgb(0.34, 0.37, 0.39);
  var BAND_3 = rgb(0.16, 0.18, 0.19);
  var RIVET = rgb(0.4, 0.42, 0.44);

  var FLASH_GOLD = rgb(1, 0.86, 0.34);
  var FLASH_FIRE = rgb(1, 0.32, 0.04);
  var EMBER_FILL = rgb(1, 0.48, 0.08);

  /* Остывание уголька: бело-раскалённый → золото → оранж → багрово. */
  var SPARK_HOT = rgb(1.0, 0.98, 0.82);
  var SPARK_GOLD = rgb(1.0, 0.69, 0.14);
  var SPARK_ORANGE = rgb(1.0, 0.25, 0.035);
  var SPARK_EMBER = rgb(0.47, 0.035, 0.018);

  // MARK: - Состояние кадра

  var mode = "idle";
  var phase = 0;
  var side = 0;

  /* Статичный кадр при prefers-reduced-motion: forging — сразу после удара
     (вспышка и разлетевшийся сноп), спокойное — на всплывающем угольке. */
  var STILL = { forging: CYCLE * 0.63, idle: 3.95 };

  /* Радиус blur() под масштабированной матрицей одни браузеры считают в
     пикселях устройства, другие — в текущей системе координат. Разница здесь
     в 40 раз, поэтому меряем один раз, а не гадаем. */
  var BLUR_IN_USER_SPACE = detectBlurSpace();

  // MARK: - Кадр

  function frame(state, seconds) {
    sync();

    var w = canvas.width;
    var h = canvas.height;
    side = Math.min(w, h);
    if (side <= 0) return;

    mode = state;
    phase = seconds;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.shadowBlur = 0;
    ctx.translate((w - side) * 0.5, (h - side) * 0.5);
    ctx.scale(side, side);

    scene();
  }

  function scene() {
    drawAmbientGlow();
    drawHeatHaze();
    drawGroundShadow();

    var impact = impactEnvelope();
    var squash = mode === "forging" ? impact * 0.045 : 0;

    drawAnvil(squash);

    if (mode === "forging") {
      drawImpactEffects();
      drawSparks();
      drawHammer(forgingHammerPose());
    } else {
      drawIdleEmber(1);
      drawHammer(restingHammerPose());
    }
  }

  // MARK: - Время удара

  function cycleIndex() {
    return Math.floor(phase / CYCLE);
  }

  function cycleTime() {
    return positiveModulo(phase, CYCLE) / CYCLE;
  }

  function impactEnvelope() {
    if (mode !== "forging") return 0;

    var distance = Math.abs(cycleTime() - 0.565);
    return Math.exp(-Math.pow(distance / 0.026, 2));
  }

  function flashEnvelope() {
    if (mode !== "forging") return 0;

    var age = cycleTime() - 0.565;
    if (age < 0 || age >= 0.18) return 0;
    return Math.pow(1 - age / 0.18, 2.5);
  }

  // MARK: - Поза молота

  function forgingHammerPose() {
    var t = cycleTime();
    var pose = { angle: 0, cx: 0, cy: 0, streak: 0, opacity: 1 };

    if (t < 0.24) {
      // Медленная антиципация назад.
      var p = smoothstep(t / 0.24);
      pose.angle = lerp(-0.5, -0.78, p);
      pose.cx = lerp(0.38, 0.29, p);
      pose.cy = lerp(0.235, 0.145, p);

    } else if (t < 0.565) {
      // Ускоряющийся тяжёлый ход вниз.
      var raw = (t - 0.24) / 0.325;
      var q = Math.pow(raw, 2.75);
      pose.angle = lerp(-0.78, 0.055, q);
      pose.cx = cubic(q, 0.29, 0.41, 0.53, 0.505);
      pose.cy = cubic(q, 0.145, 0.11, 0.26, 0.405);
      pose.streak = smoothstep(remap(raw, 0.45, 1.0));

    } else if (t < 0.66) {
      // Резкий отскок после контакта.
      var back = (t - 0.565) / 0.095;
      var b = easeOutBack(back);
      pose.angle = lerp(0.055, -0.31, b);
      pose.cx = lerp(0.505, 0.445, b);
      pose.cy = lerp(0.405, 0.285, b);
      pose.streak = (1 - back) * 0.36;

    } else {
      // Плавный возврат в исходную позицию.
      var home = smootherstep((t - 0.66) / 0.34);
      pose.angle = lerp(-0.31, -0.5, home);
      pose.cx = lerp(0.445, 0.38, home);
      pose.cy = lerp(0.285, 0.235, home);
    }

    return pose;
  }

  function restingHammerPose() {
    var breathe = Math.sin(phase * 1.35) * 0.003;

    return { angle: -0.48, cx: 0.255, cy: 0.22 + breathe, streak: 0, opacity: 0.9 };
  }

  // MARK: - Фон и атмосфера

  function drawAmbientGlow() {
    var pulse = 0.5 + 0.5 * Math.sin(phase * 1.7);

    var glow = mode === "forging" ? ACCENT_BRIGHT : ACCENT;
    var base = mode === "forging"
      ? 0.16 + impactEnvelope() * 0.24
      : 0.075 + pulse * 0.028;

    var cx = 0.25 + 0.52 * 0.5;
    var cy = 0.29 + 0.43 * 0.5;

    ctx.save();
    blur(0.075);
    ctx.fillStyle = radial(cx, cy, 0.26, [
      [0, glow, base],
      [0.5, glow, base * 0.3],
      [1, glow, 0]
    ]);
    ellipse(cx, cy, 0.26, 0.215);
    ctx.fill();
    ctx.restore();
  }

  function drawGroundShadow() {
    ctx.save();
    blur(0.024);
    ctx.fillStyle = rgba(DARK, 0.78);
    ellipse(0.23 + 0.285, 0.775 + 0.045, 0.285, 0.045);
    ctx.fill();
    ctx.restore();
  }

  /* В каноне дымка есть у forging и idle — то есть у обоих состояний панели. */
  function drawHeatHaze() {
    var strength = mode === "forging" ? 1 : 0.25;

    ctx.save();
    ctx.globalAlpha = 0.14 * strength;
    blur(0.008);
    ctx.lineWidth = 0.007;
    ctx.lineCap = "round";
    ctx.strokeStyle = linear(0.5, 0.44, 0.5, 0.24, [
      [0, ACCENT_BRIGHT, 0.04],
      [0.5, ACCENT_BRIGHT, 0.34],
      [1, ACCENT_BRIGHT, 0]
    ]);

    for (var index = 0; index < 3; index++) {
      var seed = noise(index, 11);
      var drift = Math.sin(phase * (0.72 + seed * 0.22) + seed * 8);

      ctx.beginPath();
      ctx.moveTo(0.45 + index * 0.055, 0.42);
      ctx.bezierCurveTo(
        0.42 + index * 0.065 + drift * 0.012, 0.37,
        0.49 + index * 0.045 - drift * 0.012, 0.31,
        0.44 + index * 0.06 + drift * 0.018, 0.255
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  // MARK: - Наковальня

  function drawAnvil(squash) {
    var verticalScale = 1 - squash;

    ctx.save();
    ctx.translate(0, IY * (1 - verticalScale));
    ctx.scale(1 + squash * 0.16, verticalScale);

    ctx.fillStyle = linear(0.43, 0.38, 0.62, 0.81, [
      [0, ACCENT_BRIGHT, 0.93],
      [0.18, ACCENT, 1],
      [0.58, ACCENT, 0.96],
      [1, ACCENT, 0.66]
    ]);
    ctx.fill(ANVIL);

    ctx.lineJoin = "round";
    ctx.lineWidth = 0.009;
    ctx.strokeStyle = rgba(ACCENT_BRIGHT, 0.28);
    ctx.stroke(ANVIL);

    drawAnvilHighlights();
    ctx.restore();
  }

  function drawAnvilHighlights() {
    ctx.lineCap = "round";
    ctx.lineWidth = 0.012;
    ctx.strokeStyle = linear(0.2, 0.455, 0.68, 0.455, [
      [0, ACCENT_BRIGHT, 0.2],
      [0.5, ACCENT_BRIGHT, 0.92],
      [1, ACCENT_BRIGHT, 0.34]
    ]);
    ctx.stroke(ANVIL_TOP);

    ctx.lineWidth = 0.01;
    ctx.strokeStyle = rgba(ACCENT_BRIGHT, 0.22);
    ctx.stroke(ANVIL_WAIST);
  }

  // MARK: - Молот

  function drawHammer(pose) {
    if (pose.streak > 0.01) drawHammerStreak(pose);

    ctx.save();
    ctx.globalAlpha *= pose.opacity;
    ctx.translate(pose.cx, pose.cy);
    ctx.rotate(pose.angle);

    drawHammerHandle();
    drawHammerHead();
    ctx.restore();
  }

  function drawHammerHandle() {
    ctx.fillStyle = linear(0, -0.02, 0, 0.035, [
      [0, WOOD_DARK, 1],
      [0.45, WOOD_LIT, 1],
      [1, WOOD_MID, 1]
    ]);
    ctx.fill(HANDLE);

    ctx.lineCap = "round";
    ctx.lineWidth = 0.006;
    ctx.strokeStyle = rgba(WHITE, 0.16);
    ctx.stroke(HANDLE_GRAIN);
  }

  function drawHammerHead() {
    var hw = 0.115;
    var hh = 0.165;

    ctx.fillStyle = linear(-hw, -hh, hw, hh, [
      [0, STEEL_1, 1],
      [0.32, STEEL_2, 1],
      [0.72, STEEL_3, 1],
      [1, STEEL_4, 1]
    ]);
    ctx.fill(HEAD);

    ctx.lineJoin = "round";
    ctx.lineCap = "butt";
    ctx.lineWidth = 0.006;
    ctx.strokeStyle = rgba(ACCENT_BRIGHT, 0.55);
    ctx.stroke(HEAD);

    // Поперечная стальная обвязка в центре — куда крепится рукоять.
    ctx.fillStyle = linear(0, -0.05, 0, 0.05, [
      [0, BAND_1, 1],
      [0.5, BAND_2, 1],
      [1, BAND_3, 1]
    ]);
    ctx.fill(BAND);

    ctx.lineWidth = 0.005;
    ctx.strokeStyle = rgba(BLACK, 0.3);
    ctx.stroke(BAND);

    // Заклёпки на обвязке.
    for (var i = 0; i < 2; i++) {
      var ry = i === 0 ? -0.028 : 0.028;

      ctx.fillStyle = radial(-0.006, ry - 0.003, 0.012, [
        [0, WHITE, 0.85],
        [1, RIVET, 1]
      ]);
      ellipse(-0.003, ry, 0.009, 0.009);
      ctx.fill();
    }

    ctx.lineCap = "round";

    // Верхняя ударная плоскость — яркий стальной блик.
    ctx.lineWidth = 0.01;
    ctx.strokeStyle = linear(-hw, 0, hw, 0, [
      [0, WHITE, 0.2],
      [0.5, WHITE, 0.8],
      [1, WHITE, 0.2]
    ]);
    ctx.stroke(HEAD_TOP_FACE);

    // Нижняя ударная плоскость — холодный отблеск накала.
    ctx.lineWidth = 0.008;
    ctx.strokeStyle = linear(-hw, 0, hw, 0, [
      [0, ACCENT_BRIGHT, 0.15],
      [0.5, ACCENT_BRIGHT, 0.55],
      [1, ACCENT_BRIGHT, 0.15]
    ]);
    ctx.stroke(HEAD_BOT_FACE);

    // Вертикальный блик на левой грани.
    ctx.lineWidth = 0.006;
    ctx.strokeStyle = rgba(WHITE, 0.3);
    ctx.stroke(HEAD_LEFT_EDGE);
  }

  function drawHammerStreak(pose) {
    ctx.save();
    ctx.globalAlpha *= pose.streak * 0.38;
    blur(0.013);

    for (var index = 0; index < 3; index++) {
      var offset = (index + 1) * 0.038;

      ctx.save();
      ctx.globalAlpha *= 1 - index * 0.27;
      ctx.translate(pose.cx - offset * 0.25, pose.cy - offset);
      ctx.rotate(pose.angle - offset * 0.55);

      ctx.fillStyle = linear(-0.1, 0, 0.16, 0, [
        [0, ACCENT_BRIGHT, 0.02],
        [0.5, ACCENT_BRIGHT, 0.5],
        [1, ACCENT_BRIGHT, 0]
      ]);
      ctx.fill(STREAK);
      ctx.restore();
    }

    ctx.restore();
  }

  // MARK: - Контакт и ударная волна

  function drawImpactEffects() {
    var flash = flashEnvelope();
    if (flash <= 0.001) return;

    var radius = 0.018 + flash * 0.055;

    ctx.save();
    blur(0.02);
    ctx.fillStyle = radial(IX, IY, radius, [
      [0, WHITE, flash],
      [0.24, FLASH_GOLD, flash * 0.92],
      [0.58, FLASH_FIRE, flash * 0.5],
      [1, FLASH_FIRE, 0]
    ]);
    ellipse(IX, IY, radius, radius * 0.55);
    ctx.fill();
    ctx.restore();

    var age = Math.max(0, cycleTime() - 0.565);
    var waveLife = 0.17;
    if (age >= waveLife) return;

    var p = age / waveLife;
    var ring = 0.045 + p * 0.145;
    var opacity = Math.pow(1 - p, 2);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 0.009 * (1 - p * 0.6);
    ctx.strokeStyle = linear(IX - ring, IY, IX + ring, IY, [
      [0, WHITE, 0],
      [1 / 3, WHITE, opacity * 0.8],
      [2 / 3, ACCENT_BRIGHT, opacity * 0.5],
      [1, ACCENT_BRIGHT, 0]
    ]);
    ellipse(IX, IY, ring, ring * 0.36);
    ctx.stroke();
    ctx.restore();
  }

  // MARK: - Искры

  function drawSparks() {
    var currentCycle = cycleIndex();

    for (var offset = 0; offset <= 1; offset++) {
      var sourceCycle = currentCycle - offset;
      var localAge = phase - sourceCycle * CYCLE - CYCLE * 0.565;

      if (localAge < 0 || localAge >= 1.12) continue;

      drawSparkBurst(localAge, sourceCycle);
    }
  }

  function drawSparkBurst(age, burstSeed) {
    var particleCount = 30;

    for (var index = 0; index < particleCount; index++) {
      var seedA = noise(index, burstSeed * 7 + 3);
      var seedB = noise(index, burstSeed * 11 + 17);
      var seedC = noise(index, burstSeed * 13 + 29);
      var seedD = noise(index, burstSeed * 19 + 41);

      var longEmber = index === 3 || index === 17;
      var life = longEmber ? 0.92 + seedC * 0.18 : 0.32 + seedC * 0.38;
      if (age >= life) continue;

      var normalizedAge = age / life;

      var directionSign = seedA < 0.48 ? -1 : 1;
      var horizontalSpeed =
        directionSign * (0.18 + seedB * 0.47) * (longEmber ? 0.58 : 1);
      var verticalSpeed = -(0.37 + seedA * 0.58) * (longEmber ? 0.72 : 1);

      var drag = longEmber ? 1.05 : 1.65;
      var gravity = longEmber ? 0.57 : 0.93;
      var dragFactor = (1 - Math.exp(-drag * age)) / drag;

      var drift = longEmber
        ? Math.sin(age * (3.2 + seedD * 2.4) + seedB * 9) * 0.026 * normalizedAge
        : 0;

      var x = IX + horizontalSpeed * dragFactor + drift;
      var y = IY + verticalSpeed * dragFactor + gravity * age * age * 0.5;

      var previousAge = Math.max(0, age - (longEmber ? 0.07 : 0.045));
      var previousDrag = (1 - Math.exp(-drag * previousAge)) / drag;

      var previousDrift = longEmber
        ? Math.sin(previousAge * (3.2 + seedD * 2.4) + seedB * 9)
            * 0.026 * (previousAge / life)
        : 0;

      var px = IX + horizontalSpeed * previousDrag + previousDrift;
      var py = IY + verticalSpeed * previousDrag
        + gravity * previousAge * previousAge * 0.5;

      var flicker = 0.74 + 0.26 * Math.sin(phase * (18 + seedB * 24) + seedD * 20);
      var fade = Math.pow(1 - normalizedAge, longEmber ? 1.2 : 1.5);
      var opacity = Math.max(0, fade * flicker);
      var radius = (longEmber ? 0.02 : 0.013) + seedD * (longEmber ? 0.016 : 0.012);

      var color = sparkColor(normalizedAge);

      /* Цвет искры уже несёт альфу opacity, а .opacity(_:) в SwiftUI её
         домножает — отсюда квадраты по альфе, а не описка. */
      ctx.save();
      shadow(color, opacity * opacity * 0.78, radius * 2.6);

      ctx.lineCap = "round";
      ctx.lineWidth = radius * 0.72;
      ctx.strokeStyle = linear(px, py, x, y, [
        [0, color, opacity * 0.02],
        [0.5, color, opacity * opacity * 0.72],
        [1, WHITE, opacity]
      ]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.fillStyle = radial(x, y, radius, [
        [0, WHITE, opacity],
        [0.5, color, opacity * opacity],
        [1, color, 0]
      ]);
      ellipse(x, y, radius, radius);
      ctx.fill();
      ctx.restore();
    }
  }

  function sparkColor(temperature) {
    var a;
    var b;
    var t;

    if (temperature < 0.18) {
      a = SPARK_HOT; b = SPARK_GOLD; t = temperature / 0.18;
    } else if (temperature < 0.58) {
      a = SPARK_GOLD; b = SPARK_ORANGE; t = (temperature - 0.18) / 0.4;
    } else {
      a = SPARK_ORANGE; b = SPARK_EMBER; t = (temperature - 0.58) / 0.42;
    }

    var u = clamp01(t);
    return [
      Math.round(a[0] + (b[0] - a[0]) * u),
      Math.round(a[1] + (b[1] - a[1]) * u),
      Math.round(a[2] + (b[2] - a[2]) * u)
    ];
  }

  // MARK: - Спокойное состояние

  function drawIdleEmber(strength) {
    var emberCycle = positiveModulo(phase, 4.7);
    if (emberCycle <= 3.72) return;

    var age = emberCycle - 3.72;
    var life = 0.82;
    if (age >= life) return;

    var p = age / life;
    var seed = noise(Math.floor(phase / 4.7), 91);

    var x = IX + (seed - 0.5) * 0.14 + Math.sin(age * 4.2 + seed * 7) * 0.014;
    var y = IY - age * (0.16 + seed * 0.08) + age * age * 0.08;

    var radius = 0.005 + seed * 0.004;
    var opacity = Math.pow(1 - p, 1.7) * strength;

    ctx.save();
    shadow(ORANGE, opacity, 0.018);
    ctx.fillStyle = rgba(EMBER_FILL, opacity);
    ellipse(x, y, radius, radius);
    ctx.fill();
    ctx.restore();
  }

  // MARK: - Статичная геометрия

  var ANVIL = new Path2D();
  // Плоская верхняя грань: пятка, рабочая плита и основание рога.
  ANVIL.moveTo(0.185, 0.455);
  ANVIL.quadraticCurveTo(0.185, 0.442, 0.198, 0.442);
  ANVIL.lineTo(0.655, 0.442);
  // Классический заострённый рог.
  ANVIL.bezierCurveTo(0.735, 0.442, 0.815, 0.451, 0.865, 0.468);
  ANVIL.bezierCurveTo(0.815, 0.48, 0.735, 0.498, 0.675, 0.505);
  // Резкая ступень под рогом к шейке.
  ANVIL.lineTo(0.62, 0.532);
  ANVIL.lineTo(0.603, 0.585);
  // Узкая правая сторона талии.
  ANVIL.bezierCurveTo(0.596, 0.617, 0.601, 0.645, 0.615, 0.665);
  // Расширение к широкому основанию.
  ANVIL.bezierCurveTo(0.64, 0.692, 0.675, 0.718, 0.705, 0.733);
  ANVIL.lineTo(0.748, 0.772);
  ANVIL.quadraticCurveTo(0.752, 0.795, 0.73, 0.802);
  // Плоский низ основания.
  ANVIL.lineTo(0.275, 0.802);
  ANVIL.quadraticCurveTo(0.253, 0.795, 0.257, 0.772);
  ANVIL.lineTo(0.3, 0.733);
  // Левое расширение основания к талии.
  ANVIL.bezierCurveTo(0.33, 0.718, 0.365, 0.692, 0.39, 0.665);
  // Узкая левая сторона талии.
  ANVIL.bezierCurveTo(0.404, 0.645, 0.409, 0.617, 0.402, 0.585);
  // Резкая ступень под рабочей плитой.
  ANVIL.lineTo(0.382, 0.532);
  ANVIL.lineTo(0.325, 0.505);
  // Небольшая прямоугольная пятка слева.
  ANVIL.lineTo(0.198, 0.505);
  ANVIL.quadraticCurveTo(0.185, 0.505, 0.185, 0.492);
  ANVIL.closePath();

  var ANVIL_TOP = new Path2D();
  ANVIL_TOP.moveTo(0.205, 0.455);
  ANVIL_TOP.lineTo(0.672, 0.455);

  var ANVIL_WAIST = new Path2D();
  ANVIL_WAIST.moveTo(0.398, 0.575);
  ANVIL_WAIST.bezierCurveTo(0.401, 0.628, 0.38, 0.683, 0.35, 0.719);

  // Короче и толще — пропорция кузнечной рукояти под тяжёлую головку.
  var HANDLE = new Path2D();
  HANDLE.moveTo(-0.28, -0.028);
  HANDLE.lineTo(0.012, -0.02);
  HANDLE.bezierCurveTo(0.036, -0.018, 0.05, -0.004, 0.055, 0.011);
  HANDLE.bezierCurveTo(0.05, 0.026, 0.036, 0.04, 0.012, 0.042);
  HANDLE.lineTo(-0.28, 0.035);
  HANDLE.closePath();

  var HANDLE_GRAIN = new Path2D();
  HANDLE_GRAIN.moveTo(-0.34, 0.001);
  HANDLE_GRAIN.bezierCurveTo(-0.24, -0.008, -0.13, 0.014, -0.03, 0.005);

  /* Молот Тора (Мьёльнир): массивный прямоугольный стальной блок с фасками по
     углам. Рукоять входит в центр левой грани, ударные плоскости — верхняя и
     нижняя. */
  var HEAD = new Path2D();
  var BAND = new Path2D();
  var HEAD_TOP_FACE = new Path2D();
  var HEAD_BOT_FACE = new Path2D();
  var HEAD_LEFT_EDGE = new Path2D();

  (function () {
    var hw = 0.115;   // половина ширины (по оси рукояти)
    var hh = 0.165;   // половина высоты (блок выше — читается как молот)
    var ch = 0.036;   // фаска

    HEAD.moveTo(-hw, -hh + ch);
    HEAD.lineTo(-hw + ch, -hh);
    HEAD.lineTo(hw - ch, -hh);
    HEAD.lineTo(hw, -hh + ch);
    HEAD.lineTo(hw, hh - ch);
    HEAD.lineTo(hw - ch, hh);
    HEAD.lineTo(-hw + ch, hh);
    HEAD.lineTo(-hw, hh - ch);
    HEAD.closePath();

    HEAD_TOP_FACE.moveTo(-hw + ch, -hh + 0.006);
    HEAD_TOP_FACE.lineTo(hw - ch, -hh + 0.006);

    HEAD_BOT_FACE.moveTo(-hw + ch, hh - 0.006);
    HEAD_BOT_FACE.lineTo(hw - ch, hh - 0.006);

    HEAD_LEFT_EDGE.moveTo(-hw + 0.006, -hh + ch);
    HEAD_LEFT_EDGE.lineTo(-hw + 0.006, hh - ch);

    roundRect(BAND, -hw - 0.006, -0.05, hw * 2 + 0.012, 0.1, 0.014);
  })();

  var STREAK = new Path2D();
  roundRect(STREAK, -0.095, -0.085, 0.245, 0.155, 0.025);

  // MARK: - Кисти и цвет

  function ellipse(cx, cy, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  }

  function linear(x0, y0, x1, y1, stops) {
    return fillStops(ctx.createLinearGradient(x0, y0, x1, y1), stops);
  }

  function radial(cx, cy, r, stops) {
    return fillStops(ctx.createRadialGradient(cx, cy, 0, cx, cy, r), stops);
  }

  /* Прозрачный край всегда задаётся тем же цветом с нулевой альфой: canvas
     интерполирует градиент по неумноженной альфе, и честный transparent дал бы
     грязный тёмный ореол вместо чистого затухания. */
  function fillStops(gradient, stops) {
    for (var i = 0; i < stops.length; i++) {
      gradient.addColorStop(stops[i][0], rgba(stops[i][1], stops[i][2]));
    }
    return gradient;
  }

  function blur(radius) {
    ctx.filter = "blur(" + (BLUR_IN_USER_SPACE ? radius : radius * side) + "px)";
  }

  /* shadowBlur матрица не масштабирует — считаем в пикселях устройства.
     Множитель 2: в canvas это удвоенное σ, а в CSS/SwiftUI — само σ. */
  function shadow(color, alpha, radius) {
    ctx.shadowColor = rgba(color, alpha);
    ctx.shadowBlur = 2 * radius * side;
  }

  function rgb(r, g, b) {
    return [channel(r), channel(g), channel(b)];
  }

  function rgba(color, alpha) {
    return "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + clamp01(alpha) + ")";
  }

  function channel(value) {
    return Math.max(0, Math.min(255, Math.round(value * 255)));
  }

  function roundRect(path, x, y, w, h, r) {
    if (path.roundRect) path.roundRect(x, y, w, h, r);
    else path.rect(x, y, w, h);
  }

  // MARK: - Математика

  function positiveModulo(value, modulus) {
    var result = value % modulus;
    return result >= 0 ? result : result + modulus;
  }

  function noise(x, y) {
    var value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp01(value) {
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  function smoothstep(value) {
    var t = clamp01(value);
    return t * t * (3 - 2 * t);
  }

  function smootherstep(value) {
    var t = clamp01(value);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function remap(value, minimum, maximum) {
    if (maximum === minimum) return 0;
    return clamp01((value - minimum) / (maximum - minimum));
  }

  function easeOutBack(value) {
    var t = clamp01(value);
    var c1 = 1.70158;
    var c3 = c1 + 1;

    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function cubic(t, p0, p1, p2, p3) {
    var u = 1 - t;
    var tt = t * t;
    var uu = u * u;

    return uu * u * p0 + 3 * uu * t * p1 + 3 * u * tt * p2 + tt * t * p3;
  }

  // MARK: - Размер холста

  var box = { w: 0, h: 0 };

  function measure() {
    box.w = canvas.clientWidth || canvas.width;
    box.h = canvas.clientHeight || canvas.height;
  }

  /* Ретина: холст держим в пикселях устройства, иначе кузница мыльная. */
  function sync() {
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(box.w * dpr));
    var h = Math.max(1, Math.round(box.h * dpr));

    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  function detectBlurSpace() {
    try {
      var probe = document.createElement("canvas");
      probe.width = 32;
      probe.height = 32;

      var p = probe.getContext("2d");
      p.scale(8, 8);
      p.filter = "blur(1px)";
      p.fillStyle = "#000";
      p.fillRect(1.5, 1.5, 1, 1);

      // Пятно 12..20 px; в десяти пикселях от края что-то есть только если
      // радиус уехал вместе с матрицей.
      return p.getImageData(2, 16, 1, 1).data[3] > 4;
    } catch (error) {
      return false;
    }
  }

  // MARK: - Прогон

  var raf = 0;
  var due = 0;
  var watcher = null;
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)");

  function currentState() {
    return document.body.dataset.forge === "forging" ? "forging" : "idle";
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);

    var state = currentState();
    if (now < due) return;

    /* Срок следующего кадра считаем от предыдущего СРОКА, а не от факта
       отрисовки: иначе ранний кадр укорачивает следующий интервал, пара
       «рано-поздно» зацикливается и частота разгоняется. */
    due = Math.max(due + (state === "forging" ? 1000 / 30 : 1000 / 12), now);
    frame(state, now / 1000);
  }

  function still() {
    var state = currentState();
    frame(state, STILL[state]);
  }

  function apply() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (watcher) { watcher.disconnect(); watcher = null; }

    measure();

    if (calm.matches) {
      still();
      // Кадр один, значит смену состояния надо ловить, а не опрашивать.
      watcher = new MutationObserver(still);
      watcher.observe(document.body, { attributes: true, attributeFilter: ["data-forge"] });
    } else {
      due = 0;
      raf = requestAnimationFrame(tick);
    }
  }

  if (calm.addEventListener) calm.addEventListener("change", apply);
  else calm.addListener(apply);

  window.addEventListener("resize", function () {
    measure();
    if (calm.matches) still();
  });

  apply();
})();
