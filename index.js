/*
 * Copyright (C) 2019 Felipe Contreras
 *
 * This file may be used under the terms of the GNU Lesser General Public
 * License version 2.1.
 *
 */

var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');

var universe;
var size;
var scale = 100;

function resize_canvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(1, -1);
  size = Math.max(canvas.width / 2, canvas.height / 2) * 10;
  redraw();
}

window.addEventListener('resize', resize_canvas, false);

function draw_grid() {
  let d = scale;

  // grid

  ctx.strokeStyle = 'hsl(0, 0%, 50%, 25%)';
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

  ctx.stroke();

  // light cone

  ctx.strokeStyle = 'hsl(60, 50%, 50%, 25%)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(-size, -size);
  ctx.lineTo(size, size);
  ctx.moveTo(-size, size);
  ctx.lineTo(size, -size);

  ctx.stroke();
}

function draw_line(x, y, angle, color, segments) {
  let rx = x * scale;
  let ry = y * scale;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.setLineDash(segments);
  dx = size * Math.cos(angle);
  dy = size * Math.sin(angle);
  ctx.moveTo(rx - dx, ry - dy);
  ctx.lineTo(rx + dx, ry + dy);

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

function draw_path(x, y, v, color, segments = []) {
  let a = Math.atan(v);
  draw_line(x, y, Math.PI / 2 - a, color, segments);
}

function draw_space(x, y, v, color, segments = []) {
  let a = Math.atan(v);
  draw_line(x, y, a, color, segments);
}

function draw_event(x, y, _, color) {
  draw_circle(x, y, color);
}

var universe_info = {
  objects: [
    { rf: 0, x: 0, y: 0, v: 0.0, color: 'hsl(240, 50%, 50%, 100%)' },
    { rf: 0, x: 0, y: 0, v: 0.5, color: 'hsl(0, 50%, 50%, 100%)' },
  ],
};

function redraw() {
  ctx.clearRect(-canvas.width, -canvas.height, canvas.width * 2, canvas.height * 2);
  draw_grid();
  universe.draw();
}

function upload(f) {
  let reader = new FileReader();

  reader.onload = (e) => {
    let info = JSON.parse(e.target.result);
    universe = new Universe(info);
    redraw();
  };

  reader.readAsText(f);
}

class ReferenceFrame {

  constructor(parent_rf, x, y, v, color) {
    this.parent_rf = parent_rf;

    this.x = x;
    this.y = y;
    this.v = v;
    this.color = color;

    function make_relative(f) {
      return function(x, y, v, ...args) {
        [x, y, v] = this.transform(x, y, v);
        f(x, y, v, ...args);
      }
    }

    this.draw_path = make_relative(draw_path);
    this.draw_space = make_relative(draw_space);
    this.draw_event = make_relative(draw_event);
  }

  transform(x, y, v) {
    [x, y] = [x + this.x, y + this.y]
    let ov = add_velocity(this.v, this.parent_rf.v);
    [x, y] = lorentz_transform(x, y, -ov);
    v = add_velocity(v, ov);
    return [x, y, v];
  }

  draw_axis() {
    this.draw_path(0, 0, 0, this.color, [4, 4]);
    this.draw_space(0, 0, 0, this.color, [4, 4]);
  }

}

const null_rf = { v: 0 };

class Universe {

  constructor(info) {
    this.origin_rf = new ReferenceFrame(null_rf, 0, 0, 0, 'hsl(0, 0%, 50%, 50%)');

    this.reference_frames = [ this.origin_rf ];
    this.objects = info.objects || [];
    this.events = info.events || [];
    this.time = info.time || 0;

    for (let e of info.reference_frames || []) {
      this.reference_frames[e.id] = new ReferenceFrame(this.origin_rf, e.x, e.y, e.v, e.color);
    }
  }

  draw() {
    let rfs = this.reference_frames;
    let t = this.time;

    for (let e of this.reference_frames) {
      e.draw_axis();
    }

    for (let e of this.objects) {
      let rf = rfs[e.rf];
      rf.draw_path(e.x, e.y, e.v, e.color);
    }

    for (let e of this.events) {
      let rf = rfs[e.rf];
      rf.draw_event(e.x, e.y, e.v, e.color);
    }

    for (let e of this.objects) {
      let rf = rfs[e.rf];
      rf.draw_event(e.x + e.v * t, e.y + t, e.v, e.color);
    }
  }

}

class Animation {

  constructor(seconds) {
    this.seconds = seconds;
  }

  begin() {
    this.cancel();

    this.first_timestamp = null;
    this.start = -4;
    this.end = +4;

    controls.time = this.start;
    this.request();
  }

  callback(timestamp) {
    if (!this.first_timestamp) this.first_timestamp = timestamp;

    let progress = (timestamp - this.first_timestamp) / (this.seconds * 1000);
    if (progress >= 1.0) {
      controls.time = this.end;
      return;
    }

    controls.time = this.start + (this.end - this.start) * progress;

    this.request();
  }

  request() {
    this.request_id = requestAnimationFrame(this.callback.bind(this));
  }

  cancel() {
    cancelAnimationFrame(this.request_id);
  }
}

universe = new Universe(universe_info);

var controls = new Vue({
  el: '#controls',
  data: {
    speed: 0,
    time: universe.time,
  },
  watch: {
    time: function(v) {
      universe.time = v;
      redraw();
    },
    speed: function(v) {
      universe.origin_rf.v = -v;
      redraw();
    },
  },
})

var object = new Vue({
  el: '#object',
  data: {
    rf: 0,
    x: 0,
    y: 0,
    v: 0,
    color: 'hsl(300, 50%, 50%)',
  },
  methods: {
    add() {
      object = { rf: this.rf, x: this.x, y: this.y, v: this.v, color: this.color };
      universe.objects.push(object);
      redraw();
    }
  },
})

var animation = new Animation(10);

resize_canvas();
