/*
 * Copyright (C) 2019-2026 Felipe Contreras
 *
 * This file may be used under the terms of the ISC License.
 *
 */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

var size;

const scale = 100;

function lorentz_transform(x, y, v) {
  const g = 1 / Math.sqrt(1 - v * v);
  return [g * (x - v * y), g * (y - v * x)];
}

function add_velocity(v, u) {
  return (v + u) / (1 + v * u);
}

function relative(transform, draw) {
  return (x, y, v, ...args) => draw(...transform(x, y, v), ...args);
}

function resize_canvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(1, -1);
  size = Math.max(canvas.width / 2, canvas.height / 2) * 10;
  redraw();
}

function scroll_speed(e) {
  const n = controls.speed - Math.sign(event.deltaY) * 0.05;
  controls.speed = n > 1.0 ? 1.0 : n < -1.0 ? -1.0 : n;
}

function change_example(e) {
  const examples = {
    basic:
      universe_info,
    approaching:
      {
        description: "The purple object is one light-year away with our same speed vector. The orange object is at the same distance but moving towards us. The red event represents the moment they collide in orange's reference frame, which is in our future.",
        reference_frames: [
          { id: 1, x: 1.1547, y: 0.5774, v: -0.5, color: 'oklch(0.75 0.2 60 / 50%)' }
        ],
        objects: [
          { rf: 0, x: 1, y: 0, v: 0, color: 'oklch(0.5 0.2 300)' },
          { rf: 1, x: 0, y: 0, v: 0, color: 'oklch(0.75 0.2 60)' }
        ],
        events: [
          { rf: 0, x: 0, y: 0.5, v: 0, color: 'oklch(0.6 0.2 30)' }
        ]
      },
  };
  universe = new Universe(examples[e.target.value]);
  redraw();
}

window.addEventListener('resize', resize_canvas, false);
window.addEventListener('wheel', scroll_speed);

function draw_grid(v) {
  // grid

  const g = 1 / Math.sqrt(1 - v * v);

  const ux = canvas.offsetWidth / (2 * scale);
  const uy = canvas.offsetHeight / (2 * scale);
  const cx = 0;
  const ct = 0;

  const [cx_, ct_] = lorentz_transform(cx, ct, v);
  const [ux_, uy_] = lorentz_transform(ux, uy, -Math.abs(v));

  const n_min = Math.floor(cx_ - ux_ - 1e-9);
  const n_max = Math.ceil(cx_ + ux_ + 1e-9);
  const m_min = Math.floor(ct_ - uy_ - 1e-9);
  const m_max = Math.ceil(ct_ + uy_ + 1e-9);

  const dd = g * scale;
  const dc = g * v * scale;

  ctx.strokeStyle = 'oklch(0.6 0 0 / 25%)';
  ctx.lineWidth = 1;

  ctx.beginPath();

  for (let n = n_min; n <= n_max; n++) {
    ctx.moveTo(n * dd + m_min * dc, n * dc + m_min * dd);
    ctx.lineTo(n * dd + m_max * dc, n * dc + m_max * dd);
  }
  for (let m = m_min; m <= m_max; m++) {
    ctx.moveTo(n_min * dd + m * dc, n_min * dc + m * dd);
    ctx.lineTo(n_max * dd + m * dc, n_max * dc + m * dd);
  }

  ctx.stroke();

  // light cone

  ctx.strokeStyle = 'oklch(0.75 0.15 90 / 25%)';
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
  const dx = size * Math.cos(angle);
  const dy = size * Math.sin(angle);
  ctx.moveTo(x * scale - dx, y * scale - dy);
  ctx.lineTo(x * scale + dx, y * scale + dy);

  ctx.stroke();
}

function draw_circle(x, y, color) {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x * scale, y * scale, 8, 0, 2 * Math.PI);
  ctx.fill();
}

function draw_path(x, y, v, color, segments=[]) {
  draw_line(x, y, Math.PI / 2 - Math.atan(v), color, segments);
}

function draw_space(x, y, v, color, segments=[]) {
  color = `oklch(from ${color} l c h / 0.75)`;
  draw_line(x, y, Math.atan(v), color, segments);
}

function draw_event(x, y, _, color) {
  draw_circle(x, y, color);
}

const universe_info = {
  description: 'The blue object represents us. The red object is moving at 50% the speed of light to the right.',
  objects: [
    { rf: 0, x: 0, y: 0, v: 0.0, color: 'oklch(0.5 0.25 270)' },
    { rf: 0, x: 0, y: 0, v: 0.5, color: 'oklch(0.5 0.25 30)' },
  ],
};

function redraw() {
  ctx.clearRect(-canvas.width, -canvas.height, canvas.width * 2, canvas.height * 2);
  draw_grid(controls.root_grid ? -view_rf.v : 0);
  universe.draw();
}

function upload(f) {
  const reader = new FileReader();

  reader.onload = (e) => {
    const info = JSON.parse(e.target.result);
    universe = new Universe(info);
    redraw();
  };

  reader.readAsText(f);
}

class ReferenceFrame {
  constructor(x, y, v, color='transparent') {
    [x, y] = lorentz_transform(x, y, -v);
    this.x = x;
    this.y = y;
    this.v = v;
    this.color = color;
  }

  to_root(x, y, v) {
    [x, y] = lorentz_transform(x, y, -this.v);
    v = add_velocity(v, this.v);
    return [x + this.x, y + this.y, v];
  }

  from_root(x, y, v) {
    x -= this.x;
    y -= this.y;
    [x, y] = lorentz_transform(x, y, this.v);
    v = add_velocity(v, -this.v);
    return [x, y, v];
  }
}

const root_rf = new ReferenceFrame(0, 0, 0, 'oklch(0.6 0 0 / 50%)');
const view_rf = new ReferenceFrame(0, 0, 0);

function reframe(source, target, x, y, v) {
  return target.from_root(...source.to_root(x, y, v));
}

class Universe {
  constructor(info) {
    this.reference_frames = [ root_rf ];
    this.objects = info.objects || [];
    this.events = info.events || [];
    this.time = info.time || 0;

    description.textContent = info.description;

    for (const e of info.reference_frames || []) {
      this.reference_frames[e.id] = new ReferenceFrame(e.x, e.y, e.v, e.color);
    }

    for (const e of this.objects) {
      this.calc_object_path(e);
    }
  }

  calc_object_path(e) {
    const rf = this.reference_frames[e.rf];
    e.ctx = reframe(rf, root_rf, e.x, e.y, e.v);
  }

  draw() {
    const rfs = this.reference_frames;
    const to_view = (source, x, y, v) => reframe(source, view_rf, x, y, v);
    const t = this.time;

    for (const rf of rfs) {
      relative((x, y, v) => to_view(rf, x, y, v), (x, y, v, color) => {
        draw_path(x, y, v, color, [4, 4]);
        draw_space(x, y, v, color, [4, 4]);
      })(0, 0, 0, rf.color);
    }

    for (const obj of this.objects) {
      const rf = rfs[obj.rf];
      relative((x, y, v) => to_view(rf, x, y, v), (x, y, v, color) =>
        draw_path(x, y, v, color))(obj.x, obj.y, obj.v, obj.color);
    }

    for (const ev of this.events) {
      const rf = rfs[ev.rf];
      relative((x, y, v) => to_view(rf, x, y, v), (x, y, v, color) =>
        draw_event(x, y, v, color))(ev.x, ev.y, ev.v, ev.color);
    }

    for (const obj of this.objects) {
      const [x0, y0, v0] = obj.ctx;
      const sim = x0 + v0 * (t - y0);
      relative((x, y, v) => to_view(root_rf, x, y, v), (x, y, v, color) => {
        draw_event(x, y, v, color);
      })(sim, this.time, v0, obj.color);
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

    const progress = (timestamp - this.first_timestamp) / (this.seconds * 1000);
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
const animation = new Animation(30);

var controls = new Vue({
  el: '#controls',
  data: {
    speed: view_rf.v,
    time: universe.time,
    root_grid: false,
  },
  watch: {
    time(v) {
      universe.time = v;
      redraw();
    },
    speed(v) {
      view_rf.v = v;
      redraw();
    },
    root_grid(v) {
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
      universe.calc_object_path(object);
      redraw();
    }
  },
})

resize_canvas();
