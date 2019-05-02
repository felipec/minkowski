var canvas = document.getElementById('canvas');
var ctx = canvas.getContext("2d");

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

var universe_info = {
  time: 0,
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
  universe.draw();
}

class ReferenceFrame {

  constructor(parent_rf, x, y, v, color) {
    this.parent_rf = parent_rf;

    this.x = x;
    this.y = y;
    this.v = v;
    this.color = color;

    function make_relative(f) {
      return function(x, y, v, color) {
        [x, y, v] = this.transform(x, y, v);
        f(x, y, v, color);
      }
    }

    this.draw_path = make_relative(draw_path);
    this.draw_space = make_relative(draw_space);
    this.draw_event = make_relative(draw_event);
  }

  transform(x, y, v) {
    let ov = this.v;
    x += this.x;
    y += this.y;
    if (this.parent_rf) {
      ov = add_velocity(ov, this.parent_rf.v);
    }
    [x, y] = lorentz_transform(x, y, -ov);
    v = add_velocity(v, ov);
    return [x, y, v];
  }

  draw_axis() {
    this.draw_path(0, 0, 0, this.color);
    this.draw_space(0, 0, 0, this.color);
  }

}

class Universe {

  constructor(info) {
    this.origin_rf = new ReferenceFrame(null, 0, 0, 0);

    this.reference_frames = [];
    this.objects = info.objects;
    this.events = info.events;
    this.time = info.time;

    for (let key in info.reference_frames) {
      let e = info.reference_frames[key];
      e.ctx = new ReferenceFrame(this.origin_rf, e.x, e.y, e.v, e.color);
      this.reference_frames[key] = e.ctx;
    }

    this.update();
  }

  update() {
    // Calculate paths of objects

    for (let e of this.objects) {
      let rf = this.reference_frames[e.rf];
      let [x, y] = [e.x + rf.x, e.y + rf.y];
      let v = rf.v;

      [x, y] = lorentz_transform(x, y, -v);
      v = add_velocity(v, e.v);

      e.ctx = [x, y, v];
    }
  }

  draw() {
    let rfs = this.reference_frames;
    let t = this.time;

    for (let key in this.reference_frames) {
      let e = rfs[key];
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
      let [x, y, v] = e.ctx;

      x += -v * (y - t);
      y = t;

      this.origin_rf.draw_event(x, y, 0, e.color);
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
    this.start = animate.start;
    this.end = animate.end;

    controls.time = this.start;
    this.request();
  }

  callback(timestamp) {
    if (this.first_timestamp == null) {
      this.first_timestamp = timestamp;
    }

    let progress = (timestamp - this.first_timestamp) / (this.seconds * 1000);
    controls.time = this.start + (this.end - this.start) * progress;

    redraw();

    if (controls.time <= this.end) {
      this.request();
    }
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
    time: 0,
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

var animate = new Vue({
  el: '#animate',
  data: {
    start: -4,
    end: 4,
  },
})

var object = new Vue({
  el: '#object',
  data: {
    rf: 0,
    x: 0,
    y: 0,
    v: 0,
    color: '#000f',
  },
  methods: {
    add: function() {
      object = { rf: this.rf, x: this.x, y: this.y, v: this.v, color: this.color };
      universe.objects.push(object);
      universe.update();
      redraw();
    }
  },
})

var animation = new Animation(10);

resize_canvas();
