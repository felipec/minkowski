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

function scroll_speed(e) {
  let n = controls.speed + Math.sign(event.deltaY) * 0.05;
  controls.speed = n > 1.0 ? 1.0 : n < -1.0 ? -1.0 : n;
}

function change_example(e) {
  let examples = {
    basic:
      universe_info,
    approaching:
      {
        description: "The purple object is one light-year away with our same speed vector. The orange object is at the same distance but moving towards us. The red event represents the moment they collide in orange's reference frame, which is in our future.",
        reference_frames: [
          { id: 1, x: 1.1547, y: 0.5774, v: -0.5, color: 'hsl(30, 100%, 50%, 50%)' }
        ],
        objects: [
          { rf: 0, x: 1, y: 0, v: 0, color: 'hsl(270, 100%, 50%)' },
          { rf: 1, x: 0, y: 0, v: 0, color: 'hsl(30, 100%, 50%)' }
        ],
        events: [
          { rf: 0, x: 0, y: 0.5, v: 0, color: 'hsl(0, 100%, 50%)' }
        ]
      },
  };
  universe = new Universe(examples[e.target.value]);
  redraw();
}

window.addEventListener('resize', resize_canvas, false);
window.addEventListener('wheel', scroll_speed);

function draw_grid() {
  // grid

  ctx.strokeStyle = 'hsl(0, 0%, 50%, 25%)';
  ctx.lineWidth = 1;

  ctx.beginPath();

  for (let i = -10; i < 10; i++) {
    ctx.moveTo(-size, i * scale);
    ctx.lineTo(size, i * scale);
    ctx.moveTo(i * scale, -size);
    ctx.lineTo(i * scale, size);
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
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.setLineDash(segments);
  let dx = size * Math.cos(angle);
  let dy = size * Math.sin(angle);
  ctx.moveTo(x * scale - dx, y * scale - dy);
  ctx.lineTo(x * scale + dx, y * scale + dy);

  ctx.stroke();
}

function draw_circle(x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x * scale, y * scale, 8, 0, 2 * Math.PI);
  ctx.fill();

  ctx.stroke();
}

function lorentz_transform(x, y, v) {
  let g = 1 / Math.sqrt(1 - v ** 2);
  return [g * (x - v * y), g * (y - v * x)];
}

function add_velocity(v, u) {
  return (v + u) / (1 + (v * u));
}

function draw_path(x, y, v, color, segments = []) {
  draw_line(x, y, Math.PI / 2 - Math.atan(v), color, segments);
}

function draw_space(x, y, v, color, segments = []) {
  draw_line(x, y, Math.atan(v), color, segments);
}

function draw_event(x, y, _, color) {
  draw_circle(x, y, color);
}

var universe_info = {
  description: 'The blue object represents us. The red object is moving at 50% the speed of light to the right.',
  objects: [
    { rf: 0, x: 0, y: 0, v: 0.0, color: 'hsl(240, 100%, 50%)' },
    { rf: 0, x: 0, y: 0, v: 0.5, color: 'hsl(0, 100%, 50%)' },
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
const main_rf = new ReferenceFrame(null_rf, 0, 0, 0, 'hsl(0, 0%, 50%, 50%)');

class Universe {

  constructor(info) {
    this.reference_frames = [ main_rf ];
    this.objects = info.objects || [];
    this.events = info.events || [];
    this.time = info.time || 0;

    description.textContent = info.description;

    for (let e of info.reference_frames || []) {
      this.reference_frames[e.id] = new ReferenceFrame(main_rf, e.x, e.y, e.v, e.color);
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
      rf.draw_event(e.x + e.v * t, e.y + t, e.v, e.color);
    }

    for (let e of this.events) {
      let rf = rfs[e.rf];
      rf.draw_event(e.x, e.y, e.v, e.color);
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

var universe = new Universe(universe_info);
var animation = new Animation(30);

var controls = new Vue({
  el: '#controls',
  data: {
    speed: 0,
    time: universe.time,
  },
  watch: {
    time(v) {
      universe.time = v;
      redraw();
    },
    speed(v) {
      main_rf.v = -v;
      redraw();
    },
  },
})

var object = new Vue({
  el: '#object',
  data: {
    rf: 0,
    x: 1.0,
    y: 0.0,
    v: 0.5,
    color: 'magenta',
  },
  methods: {
    add() {
      object = { rf: this.rf, x: this.x, y: this.y, v: this.v, color: this.color };
      universe.objects.push(object);
      redraw();
    }
  },
})

resize_canvas();
