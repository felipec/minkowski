var canvas = document.getElementById('canvas');

var ctx = canvas.getContext("2d");

fitToContainer(canvas);

function fitToContainer(canvas){
  // Make it visually fill the positioned parent
  canvas.style.width ='100%';
  canvas.style.height='100%';
  // ...then set the internal size to match
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}

var scale = 100;
var size = Math.max(canvas.width / 2, canvas.height / 2) * 10;

ctx.translate(canvas.width / 2, canvas.height / 2);
ctx.scale(1, -1);

function draw_grid() {
  let d = scale;

  ctx.strokeStyle = "#4444";
  ctx.lineWidth = 1;

  ctx.beginPath();

  for (let i = 0; i < 10; i++) {
    ctx.moveTo(-size, i * d);
    ctx.lineTo(size, i * d);
    ctx.moveTo(-size, -i * d);
    ctx.lineTo(size, -i * d);
    ctx.moveTo(i * d, -size);
    ctx.lineTo(i * d, size);
    ctx.moveTo(-i * d, -size);
    ctx.lineTo(-i * d, size);
  }

  ctx.closePath();

  ctx.stroke();

  // light cone

  ctx.strokeStyle = "#bb48";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(-size, -size);
  ctx.lineTo(size, size);
  ctx.moveTo(-size, size);
  ctx.lineTo(size, -size);
  ctx.closePath();

  ctx.stroke();
}

function draw_line(x, y, angle, color) {
  let rx = x * scale;
  let ry = y * scale;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  dx = size * Math.cos(angle);
  dy = size * Math.sin(angle);
  ctx.moveTo(rx - dx, ry - dy);
  ctx.lineTo(rx + dx, ry + dy);
  ctx.closePath();

  ctx.stroke();
}

function draw_circle(x, y, color) {
  let rx = x * scale;
  let ry = y * scale;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(rx, ry, 8, 0, 2 * Math.PI);
  ctx.fill();
  ctx.closePath();

  ctx.stroke();
}

function lorentz_transform(x, y, v) {
  let g = 1 / Math.sqrt(1 - v ** 2);
  let x_ = g * (x - v * y);
  let y_ = g * (y - v * x);
  return [x_, y_];
}

function add_velocity(v, u) {
  return (v + u) / (1 + (v * u));
}

function draw_path(x, y, v, color) {
  let a = Math.atan(v);
  draw_line(x, y, Math.PI / 2 - a, color);
}

function draw_space(x, y, v, color) {
  let a = Math.atan(v);
  draw_line(x, y, a, color);
}

function draw_event(x, y, v, color) {
  draw_circle(x, y, color);
}

function make_relative(f, rx, ry, rv) {
  return function(x, y, v, color) {
    x += rx;
    y += ry;
    [x, y] = lorentz_transform(x, y, -rv);
    v = add_velocity(v, rv);
    f(x, y, v, color);
  }
}

function new_reference_frame(x, y, v) {
  v = add_velocity(v, -global_speed);
  return {
    draw_path: make_relative(draw_path, x, y, v),
    draw_space: make_relative(draw_space, x, y, v),
    draw_event: make_relative(draw_event, x, y, v),
  };
}

function draw_axis(rf, color) {
  rf.draw_path(0, 0, 0.0, color);
  rf.draw_space(0, 0, 0.0, color);
}

function draw_universe(u) {
  for (e of u.reference_frames) {
    rf = new_reference_frame(e.x, e.y, e.v);
    draw_axis(rf, e.color);
    rfs[e.id] = rf;
  }

  for (e of u.objects) {
    rf = rfs[e.rf];
    rf.draw_path(e.x, e.y, e.v, e.color);
  }
}

function draw_all_events(u) {
  for (e of u.events) {
    rf = rfs[e.rf];
    rf.draw_event(e.x, e.y, e.v, e.color);
  }
}

function draw_time(u, rfid, t) {
  let rfa = rfs[rfid];
  let rfa_i = u.reference_frames[rfid];

  for (e of u.objects) {
    let rfb = rfs[e.rf];
    let rfb_i = u.reference_frames[e.rf];
    let v = add_velocity(rfb_i.v, -rfa_i.v);
    let [x, y] = lorentz_transform(e.x, e.y, -v);

    v = add_velocity(v, e.v);
    x += -v * (y - t);

    rfa.draw_event(x, t, 0, e.color);
  }
}

var global_speed = 0.0;
let rfs = [];

var universe = {
  reference_frames: [
    { id: 0, x: 0, y: 0, v: 0, color: '#00ff' },
    { id: 1, x: 0, y: 0, v: 0.5, color: '#f00f' },
  ],
  objects: [
    { rf: 0, x: 1, y: 0, v: 0, color: '#00ff' },
    { rf: 1, x: 1, y: 0, v: 0, color: '#f00f' },
  ],
  events: [
    { rf: 0, x: 1, y: 0, v: 0, color: '#00ff' },
    { rf: 1, x: 1, y: 0, v: 0, color: '#f00f' },
  ],
};

function redraw() {
  ctx.clearRect(-canvas.width, -canvas.height, canvas.width * 2, canvas.height * 2);
  draw_grid();
  draw_universe(universe);
  draw_all_events(universe);
  draw_time(universe, 0, global_time);
}

var steps = 400;
var time_span = 8;
var global_time = -(time_span / 2);

function timed() {
  redraw();
  global_time += (1 / steps);
  if (global_time < (time_span / 2)) {
    setTimeout(timed, 1);
  }
}

timed();
