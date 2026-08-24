// Post-process effects implemented on 2D canvas, approximating the Unity
// shaders used by Cytoid v2.0.2 storyboard controllers.
(() => {
  // Deterministic pseudo-random from time, so the preview is stable when scrubbing
  function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // Create/return a shared offscreen canvas
  function offscreen(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  const cache = {};

  // ------------------------------------------------------------------
  // WebGL (shader-level) post-processing backend. Ports the Unity
  // CameraFilterPack / SleekRender filter math to GLSL fragment shaders so
  // the effects are applied per-pixel exactly like the Unity shaders, instead
  // of Canvas approximations. Falls back to the 2D path when WebGL is
  // unavailable.
  // ------------------------------------------------------------------
  const GLPipeline = (() => {
    const VS =
      'attribute vec2 aPos; varying vec2 vUv;' +
      'void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }';

    const FS = {
      copy:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex;' +
        'void main(){ gl_FragColor = texture2D(uTex, vUv); }',

      // CameraFilterPack_Color_BrightContrastSaturation (exact).
      colorAdjust:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex;' +
        'uniform float uBrightness, uSaturation, uContrast;' +
        'void main(){' +
        '  vec3 c = texture2D(uTex, vUv).rgb;' +
        '  c = c * uBrightness;' +
        '  float luma = dot(c, vec3(0.2125, 0.7154, 0.0721));' +
        '  c = uSaturation * (c - vec3(luma)) + vec3(luma);' +
        '  c = (c - 0.5) * uContrast + 0.5;' +
        '  gl_FragColor = vec4(c, 1.0);' +
        '}',

      // CameraFilterPack_Color_GrayScale (exact; luma 0.222/0.707/0.071).
      gray:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform float uFade;' +
        'void main(){' +
        '  vec3 c = texture2D(uTex, vUv).rgb;' +
        '  float luma = dot(c, vec3(0.222, 0.707, 0.071));' +
        '  gl_FragColor = vec4(mix(c, vec3(luma), uFade), 1.0);' +
        '}',

      // CameraFilterPack_Color_Sepia (exact; sepia = gray + warm offset).
      sepia:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform float uFade;' +
        'void main(){' +
        '  vec3 c = texture2D(uTex, vUv).rgb;' +
        '  float luma = dot(c, vec3(0.222, 0.707, 0.071));' +
        '  vec3 sep = vec3(luma) + vec3(0.437, 0.171, 0.078);' +
        '  gl_FragColor = vec4(mix(c, sep, uFade), 1.0);' +
        '}',

      // CameraFilterPack_Color_Noise (exact): static per-UV spatial hash grain.
      noise:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex;' +
        'uniform float uIntensity;' +
        'void main(){' +
        '  vec4 c = texture2D(uTex, vUv);' +
        '  float n = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);' +
        '  gl_FragColor = mix(c, vec4(n), uIntensity);' +
        '}',

      colorFilter:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform vec3 uColor;' +
        'void main(){ gl_FragColor = vec4(texture2D(uTex, vUv).rgb * uColor, 1.0); }',

      // CameraFilterPack_Blur_Radial_Fast (exact): 8-tap radial zoom blur
      // around (uPos), factors 1 + intensity * (0.15 .. 1.05).
      radial:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex;' +
        'uniform float uIntensity; uniform vec2 uPos;' +
        'void main(){' +
        '  vec2 d = vUv - uPos;' +
        '  vec3 acc = texture2D(uTex, vUv).rgb;' +
        '  for (int i = 1; i <= 7; i++) {' +
        '    float k = 1.0 + uIntensity * (float(i) * 0.15);' +
        '    acc += texture2D(uTex, uPos + d * k).rgb;' +
        '  }' +
        '  gl_FragColor = vec4(acc * 0.125, 1.0);' +
        '}',

      // CameraFilterPack_TV_Chromatical (exact): animated radial chromatic
      // aberration driven by sin(6t)/sin(12t), radial falloff, y wobble.
      chromatical:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex;' +
        'uniform float uIntensity, uFade, uSpeed, uTime;' +
        'void main(){' +
        '  vec3 base = texture2D(uTex, vUv).rgb;' +
        '  float t = uSpeed * uTime;' +
        '  vec2 s = sin(t * vec2(6.0, 12.0));' +
        '  float a = 0.5 * (s.x + 1.0) * (0.5 * s.y + 1.0);' +
        '  float off = a * a * a * 0.05;' +
        '  vec2 p = vUv - 0.5;' +
        '  float r = length(p);' +
        '  float amount = r * uFade * uIntensity;' +
        '  vec3 c;' +
        '  c.r = texture2D(uTex, vec2(vUv.x + off * amount, vUv.y)).r;' +
        '  c.g = base.g;' +
        '  c.b = texture2D(uTex, vec2(vUv.x - off * amount, vUv.y)).b;' +
        '  float wob = sin(vUv.y * 800.0) * 0.04;' +
        '  c = vec3(c.r - wob, c.g, c.b - wob);' +
        '  float falloff = 1.0 - r * 0.5;' +
        '  gl_FragColor = vec4(base + uFade * (falloff * c - base), 1.0);' +
        '}',

      // CameraFilterPack_Distortion_FishEye (近似)：0.5 为中性点；偏离 0.5
      // 的量乘以 24 驱动桶形/枕形畸变强度。
      fisheye:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform float uIntensity;' +
        'void main(){' +
        '  vec2 p = vUv - 0.5;' +
        '  float r = length(p);' +
        '  float k = (0.5 - uIntensity) * 24.0;' +
        '  float f = 1.0 + k * r * r;' +
        '  gl_FragColor = texture2D(uTex, clamp(0.5 + p / f, 0.0, 1.0));' +
        '}',

      // CameraFilterPack_FX_Glitch1 (exact): per-row hash displacement with a
      // rare vertical flip trigger, then YUV-space U/V distortion.
      glitch:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex;' +
        'uniform float uIntensity, uTime;' +
        'float hash(float x){ return fract(sin(x * 91.2228) * 43758.5453); }' +
        'void main(){' +
        '  vec2 uv = vUv;' +
        '  vec2 t = floor(uTime * vec2(4.0, 8.0)) * vec2(37.5, 0.125);' +
        '  float row = floor(uv.y * 16.0);' +
        '  float hx = row * 0.0625 + t.x;' +
        '  bool flip = hash(t.y) > 0.99;' +
        '  float h = hash(hx) * 16.0;' +
        '  float a = h * uTime;' +
        '  float y2 = floor(a) / a * 5.0 + uv.y;' +
        '  float n = (hash(floor(y2 * 11.0) / 11.0) * 0.5 + hash(floor(y2 * 7.0) / 7.0) * 0.5) * 2.0 - 1.0;' +
        '  float sgn = n > 0.0 ? 1.0 : (n < 0.0 ? -1.0 : 0.0);' +
        '  float strip = max(0.0, (abs(n) - 0.6) * 2.5) * sgn;' +
        '  float inv = clamp(0.5 - uIntensity * strip, 0.0, 1.0);' +
        '  float gs = uIntensity * strip;' +
        '  float lo = clamp(gs - 0.5, 0.0, 1.0);' +
        '  float div = 1.0 - abs(gs) * 3.0 * inv;' +
        '  vec2 uv2 = clamp(uv + vec2(gs * 0.1, 0.0), 0.0, 1.0);' +
        '  if (flip) uv2.y = 1.0 - uv2.y;' +
        '  vec3 c = texture2D(uTex, uv2).rgb;' +
        '  float U = dot(c, vec3(-0.14713, -0.28886, 0.436));' +
        '  float V = dot(c, vec3(0.615, -0.51499, -0.10001));' +
        '  float Y = dot(c, vec3(0.299, 0.587, 0.114));' +
        '  U = U / div;' +
        '  V = V + gs * 0.125 * lo;' +
        '  float R = Y + 1.13983 * V;' +
        '  float G = Y - 0.39465 * U - 0.5806 * V;' +
        '  float B = Y + 2.03211 * U;' +
        '  gl_FragColor = vec4(R, G, B, 1.0);' +
        '}',

      // CameraFilterPack_Distortion_Dream (exact): time-driven shimmer offset.
      dream:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex;' +
        'uniform float uTime, uIntensity;' +
        'void main(){' +
        '  float a = uTime * 0.75;' +
        '  vec2 osc = vec2(sin(a), cos(a));' +
        '  vec2 uv = vUv;' +
        '  vec2 shifted = (uv + osc) * uIntensity * 0.15;' +
        '  float x = texture2D(uTex, shifted).x * uIntensity * 0.05;' +
        '  gl_FragColor = texture2D(uTex, uv + vec2(x, 0.0));' +
        '}',

      // CameraFilterPack_Distortion_ShockWave (exact, non-Manual): expanding
      // ring band [phase-0.1, phase+0.1]; inside the band the displaced sample
      // is boosted by v/(r*phase*40) and added to the base.
      // _Value/_Value2 = PosX/PosY, _Value3 = Speed, phase = fract(Speed*TimeX).
      shockwave:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex;' +
        'uniform float uTime, uSpeed; uniform vec2 uPos;' +
        'void main(){' +
        '  vec2 d = vUv - uPos;' +
        '  float r = length(d);' +
        '  vec2 dir = r > 0.000001 ? d / r : vec2(0.0);' +
        '  float phase = fract(uSpeed * uTime);' +
        '  float diff = r - phase;' +
        '  float v = 1.0 - pow(abs(diff * 10.0), 0.8);' +
        '  float divisor = max(r * phase * 40.0, 0.0001);' +
        '  vec2 offset = dir * diff * v / divisor;' +
        '  bool band = phase - 0.1 <= r && r <= phase + 0.1;' +
        '  vec2 suv = band ? vUv + offset : vUv;' +
        '  float z = band ? v : 1.0;' +
        '  float w = band ? 1.0 : 0.0;' +
        '  vec3 col = texture2D(uTex, suv).rgb;' +
        '  gl_FragColor = vec4(col + col * z / divisor * w, 1.0);' +
        '}',

      // CameraFilterPack_Drawing_Manga_Flash_Color (近似)：以 PosX/PosY 为
      // 中心的旋转径向速度线，集中在屏幕外环带（中央约 60% 保持清晰）。
      // _Value=Size（线密度）、_Value2=Speed（旋转）、_Intensity、Color。
      focus:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex;' +
        'uniform float uTime, uSize, uSpeed, uIntensity; uniform vec2 uPos; uniform vec3 uColor;' +
        'void main(){' +
        '  vec3 base = texture2D(uTex, vUv).rgb;' +
        '  vec2 d = vUv - uPos;' +
        '  float ang = atan(d.y, d.x) + uTime * uSpeed * 0.08;' +
        // 以半对角线归一化，使屏幕角落落在 r = 1.0。
        '  float r = length(d) * 1.41421356;' +
        '  float n = 24.0 * uSize;' +
        '  float sector = ang / (6.2831853 / n);' +
        '  float line = abs(fract(sector) - 0.5) * 2.0;' +
        '  float mask = 1.0 - smoothstep(0.08, 0.38, line);' +
        // 线只出现在中央 60% 之外并延伸到画面边缘（r ~ 1.0）。
        '  float edge = smoothstep(0.58, 0.66, r) * (1.0 - smoothstep(0.94, 1.08, r));' +
        '  float glow = mask * edge * uIntensity;' +
        '  gl_FragColor = vec4(base + uColor * glow * 0.42, 1.0);' +
        '}',

      // CameraFilterPack_TV_Videoflip (exact): rows roll upward one cycle per
      // second; wrapping rows flip the picture (no parameters).
      tape:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform float uTime;' +
        'void main(){' +
        '  gl_FragColor = texture2D(uTex, vec2(vUv.x, fract(vUv.y + uTime)));' +
        '}',

      // CameraFilterPack_TV_Artefact (exact): 12fps frame hash, 24x9/8x4 cell
      // parasite bands, per-pixel noise colourisation, Fade mix.
      artifact:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex;' +
        'uniform float uFade, uColorisation, uParasite, uNoise, uTime;' +
        'float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }' +
        'void main(){' +
        '  float frame = floor(uTime * 12.0);' +
        '  float h1 = hash2(frame * vec2(7.2341, 1.0));' +
        '  float h2 = hash2(frame * vec2(5.0, 1.0));' +
        '  float pow17 = pow(h1, 17.0) * 2.0;' +
        '  vec4 cells = floor(vUv.xyxy * vec4(24.0, 9.0, 8.0, 4.0)) * frame;' +
        '  float g1 = hash2(cells.xy);' +
        '  float g2 = hash2(cells.zw);' +
        '  float p8 = g1 * g1; p8 *= p8; p8 *= p8;' +
        '  float parasite = p8 * uParasite * (g2 * g2 * g2) - pow17;' +
        '  float h3 = hash2(frame * vUv);' +
        '  float h4 = hash2(frame * vec2(31.0, 1.0));' +
        '  float offX = h2 * parasite * 0.05;' +
        '  float offY = h4 * parasite * 0.05;' +
        '  vec3 base = texture2D(uTex, vUv).rgb;' +
        '  vec3 c = vec3(base.r, texture2D(uTex, vUv + vec2(offX, 0.0)).g, base.b);' +
        '  vec3 col = vec3(h3, 1.0 - h3 * uColorisation, h3 * 0.5 + 0.5);' +
        '  vec3 outCol = c + (col * uNoise - 2.0) * 0.08;' +
        '  gl_FragColor = vec4(base + uFade * (outCol - base), 1.0);' +
        '}',

      // CameraFilterPack_TV_ARCADE_2 (exact): glass curvature, interference
      // wobble, band displacement, phosphor ghost, tube vignette, scanlines,
      // contrast and flicker, all mixed with the source by Fade.
      // _Value=Interferance_Size, _Value2=Interferance_Speed, _Value3=Contrast,
      // "Fade"=Fade (0..1), _TimeX accumulates.
      arcade:
        'precision mediump float; varying vec2 vUv; uniform sampler2D uTex;' +
        'uniform float uTime, uSize, uSpeed, uContrast, uFade; uniform vec2 uScreen;' +
        'void main(){' +
        '  vec2 uv = vUv;' +
        '  vec2 p = (uv - 0.5) * 2.2;' +
        '  float cx = p.x * (1.0 + pow(0.2 * abs(p.y), 2.0));' +
        '  float cy = p.y * (1.0 + pow(0.25 * abs(cx), 2.0));' +
        '  vec2 cuv = (vec2(cx, cy) * 0.5 + 0.5) * 0.92 + 0.04;' +
        '  uv = clamp(uv + uFade * (cuv - uv), 0.0, 1.0);' +
        '  float wob = sin(uv.y * 21.0 + uTime * 0.3) * sin(uv.y * 29.0 + uTime * 0.7) * sin(uv.y * 31.0 + uTime * 0.33 + 0.3);' +
        '  uv.x += wob * 0.0017;' +
        '  float wave = wob * 0.0017 + 0.025;' +
        '  vec3 c = texture2D(uTex, vec2(uv.x + wob * 0.0017 + 0.001, uv.y + 0.001)).rgb + 0.05;' +
        '  float bp = clamp(uv.y * uSize - fract(-uSpeed * uTime) - 0.05, 0.0, 0.1);' +
        '  float env = 1.0 - 4.0 * pow(bp * 10.0 - 0.5, 2.0);' +
        '  uv.x += sin(bp * 100.0) * env * 0.02;' +
        '  vec3 c2 = texture2D(uTex, vec2(wave * 0.75 + uv.x, uv.y) + 0.001).rgb;' +
        '  c = c2 * vec3(0.08, 0.05, 0.08) + c;' +
        '  c = clamp(c * 0.6 + c * c * 0.4, 0.0, 1.0);' +
        '  float vig = pow(max(uv.x * uv.y * 16.0 * (1.0 - uv.x) * (1.0 - uv.y), 0.0), 0.3);' +
        '  c *= vig * vec3(2.66, 2.94, 2.66);' +
        '  float s = sin(uv.y * uScreen.y * 1.5 + uTime * 3.5) * 0.35 + 0.35;' +
        '  s = pow(s, 1.7) * uContrast * 0.7 + 0.4;' +
        '  c *= s;' +
        '  c *= sin(uTime * 110.0) * 0.01 + 1.0;' +
        '  vec3 src = texture2D(uTex, vUv).rgb;' +
        '  gl_FragColor = vec4(src + uFade * (c - src), 1.0);' +
        '}'
    };

    let canvas = null, gl = null, W = 0, H = 0, fb = null, quad = null;
    let texA = null, texB = null, texOrig = null;
    const programs = {};

    function ensure(w, h) {
      if (!canvas) {
        canvas = document.createElement('canvas');
        gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true }) ||
          canvas.getContext('experimental-webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true });
        if (!gl) return null;
        quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        fb = gl.createFramebuffer();
      }
      if (W !== w || H !== h) {
        W = w; H = h;
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        texA = makeTex(); texB = makeTex(); texOrig = makeTex();
      }
      return gl;
    }

    function makeTex() {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // Allocate storage so the texture can be used as a framebuffer target
      // (an unallocated texture makes the FBO incomplete -> black output).
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      return t;
    }

    function program(name, fs) {
      if (programs[name]) return programs[name];
      const mk = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          throw new Error('GL ' + name + ': ' + gl.getShaderInfoLog(s));
        }
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, mk(gl.VERTEX_SHADER, VS));
      gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        throw new Error('GL ' + name + ': ' + gl.getProgramInfoLog(p));
      }
      gl.useProgram(p);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      const loc = gl.getAttribLocation(p, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      programs[name] = p;
      return p;
    }

    function draw(prog, uniforms, src, extra) {
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src);
      gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);
      for (const k in uniforms) {
        const loc = gl.getUniformLocation(prog, k);
        if (loc === null) continue;
        const v = uniforms[k];
        if (Array.isArray(v)) {
          if (v.length >= 3) gl.uniform3f(loc, v[0], v[1], v[2]);
          else gl.uniform2f(loc, v[0], v[1]);
        }
        else if (typeof v === 'number') gl.uniform1f(loc, v);
      }
      if (extra) {
        const loc2 = gl.getUniformLocation(prog, 'uTex2');
        if (loc2 !== null) {
          gl.uniform1i(loc2, 1);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, extra);
        }
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function into(dst, prog, uniforms, src, extra) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dst, 0);
      gl.viewport(0, 0, W, H);
      draw(prog, uniforms, src, extra);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
    }

    // Sleek Render bloom render targets: a downsample buffer (sized like
    // SleekRenderPostProcess.cs: W*ratio/5 x H*ratio/5, ratio = min(720,H)/H)
    // plus two fixed 128x128 blur buffers.
    let bloomRT = null;
    function ensureBloomRT(w, h) {
      const ratio = Math.min(720, h) / h;
      const dsW = Math.max(2, Math.round(w * ratio / 5));
      const dsH = Math.max(2, Math.round(h * ratio / 5));
      if (bloomRT && bloomRT.dsW === dsW && bloomRT.dsH === dsH) return bloomRT;
      const mk = (tw, th) => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { tex, fbo, w: tw, h: th };
      };
      if (bloomRT) {
        [bloomRT.ds, bloomRT.h, bloomRT.v].forEach((rt) => {
          gl.deleteTexture(rt.tex);
          gl.deleteFramebuffer(rt.fbo);
        });
      }
      bloomRT = { dsW, dsH, ds: mk(dsW, dsH), h: mk(128, 128), v: mk(128, 128) };
      return bloomRT;
    }

    function intoRT(rt, prog, uniforms, src) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
      gl.viewport(0, 0, rt.w, rt.h);
      draw(prog, uniforms, src);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
    }

    // Exact Sleek Render bloom (the vendor backend real Cytoid builds run):
    // 5-tap downsample + luminance brightpass (threshold 0.6, uniform luma)
    // -> 128x128 alpha-weighted horizontal blur -> non-weighted vertical blur
    // -> base * (1 - luma(bloom)) + bloom * intensity.
    function doBloom(cur, bloomI) {
      const rt = ensureBloomRT(W, H);
      intoRT(rt.ds, program('blDs', FS.blDs), { uTexel: [1 / rt.dsW, 1 / rt.dsH] }, cur);
      intoRT(rt.h, program('blH', FS.blH), { uTexel: [1 / 128, 1 / 128] }, rt.ds.tex);
      intoRT(rt.v, program('blV', FS.blV), { uTexel: [1 / 128, 1 / 128] }, rt.h.tex);
      const dst = cur === texA ? texB : texA;
      into(dst, program('blC', FS.blC), { uIntensity: bloomI }, cur, rt.v.tex);
      return dst;
    }

    // Sleek Render/Post Process/Downsample Brightpass (exact). Cytoid uses
    // bloomThreshold 0.6 and uniform luma (1/3,1/3,1/3), so the alpha channel
    // is saturate((luma - 0.6) / 0.4).
    FS.blDs =
      'precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uTexel;' +
      'void main(){' +
      '  vec2 h = uTexel * 0.5;' +
      '  vec4 c0 = texture2D(uTex, vUv);' +
      '  vec4 c1 = texture2D(uTex, vUv - h);' +
      '  vec4 c2 = texture2D(uTex, vUv + vec2(h.x, -h.y));' +
      '  vec4 c3 = texture2D(uTex, vUv + vec2(-h.x, h.y));' +
      '  vec4 c4 = texture2D(uTex, vUv + h);' +
      '  float l0 = clamp((dot(c0.rgb, vec3(0.3333333)) - 0.6) / 0.4, 0.0, 1.0);' +
      '  float l1 = clamp((dot(c1.rgb, vec3(0.3333333)) - 0.6) / 0.4, 0.0, 1.0);' +
      '  float l2 = clamp((dot(c2.rgb, vec3(0.3333333)) - 0.6) / 0.4, 0.0, 1.0);' +
      '  float l3 = clamp((dot(c3.rgb, vec3(0.3333333)) - 0.6) / 0.4, 0.0, 1.0);' +
      '  float l4 = clamp((dot(c4.rgb, vec3(0.3333333)) - 0.6) / 0.4, 0.0, 1.0);' +
      '  vec3 sum = c0.rgb * 4.0 + c1.rgb + c2.rgb + c3.rgb + c4.rgb;' +
      '  float lsum = l0 * 4.0 + l1 + l2 + l3 + l4;' +
      '  gl_FragColor = vec4(sum * 0.125, lsum * 0.125);' +
      '}';

    // Sleek Render/Post Process/Horizontal Blur (exact): taps at
    // 0, +/-1.041, +/-2.31, +/-3.04 texels; samples are premultiplied by their
    // alpha (the brightpass amount).
    FS.blH =
      'precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uTexel;' +
      'void main(){' +
      '  float tx = uTexel.x;' +
      '  vec4 c0 = texture2D(uTex, vUv);' +
      '  vec4 c1 = texture2D(uTex, vUv + vec2(1.041 * tx, 0.0));' +
      '  vec4 c2 = texture2D(uTex, vUv - vec2(1.041 * tx, 0.0));' +
      '  vec4 c3 = texture2D(uTex, vUv + vec2(2.31 * tx, 0.0));' +
      '  vec4 c4 = texture2D(uTex, vUv - vec2(2.31 * tx, 0.0));' +
      '  vec4 c5 = texture2D(uTex, vUv + vec2(3.04 * tx, 0.0));' +
      '  vec4 c6 = texture2D(uTex, vUv - vec2(3.04 * tx, 0.0));' +
      '  gl_FragColor = c0 * c0.a * 0.263 + (c1 * c1.a + c2 * c2.a) * 0.159 + (c3 * c3.a + c4 * c4.a) * 0.122 + (c5 * c5.a + c6 * c6.a) * 0.023;' +
      '}';

    // Sleek Render/Post Process/Vertical Blur (exact): taps at
    // 0, +/-1.441, +/-3.361, +/-5.04 texels; NOT alpha-weighted.
    FS.blV =
      'precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uTexel;' +
      'void main(){' +
      '  float ty = uTexel.y;' +
      '  vec4 c0 = texture2D(uTex, vUv);' +
      '  vec4 c1 = texture2D(uTex, vUv + vec2(0.0, 1.441 * ty));' +
      '  vec4 c2 = texture2D(uTex, vUv - vec2(0.0, 1.441 * ty));' +
      '  vec4 c3 = texture2D(uTex, vUv + vec2(0.0, 3.361 * ty));' +
      '  vec4 c4 = texture2D(uTex, vUv - vec2(0.0, 3.361 * ty));' +
      '  vec4 c5 = texture2D(uTex, vUv + vec2(0.0, 5.04 * ty));' +
      '  vec4 c6 = texture2D(uTex, vUv - vec2(0.0, 5.04 * ty));' +
      '  gl_FragColor = c0 * 0.159 + (c1 + c2) * 0.263 + (c3 + c4) * 0.122 + (c5 + c6) * 0.023;' +
      '}';

    // Sleek Render PreCompose (BLOOM_ON) + Compose (base variant) collapsed:
    // out = base * (1 - luma(bloom)) + bloom * intensity * tint(white).
    FS.blC =
      'precision mediump float; varying vec2 vUv;' +
      'uniform sampler2D uTex; uniform sampler2D uTex2; uniform float uIntensity;' +
      'void main(){' +
      '  vec3 base = texture2D(uTex, vUv).rgb;' +
      '  vec3 bloom = texture2D(uTex2, vUv).rgb;' +
      '  float luma = dot(bloom, vec3(0.2126, 0.7152, 0.0722));' +
      '  gl_FragColor = vec4(base * (1.0 - luma) + bloom * uIntensity, 1.0);' +
      '}';

    function fallbackColorFS(defines) {
      return [
        'precision mediump float;',
        'varying vec2 vUv;',
        'uniform sampler2D uTex;',
        'uniform float uGrayFade, uSepiaFade, uBrightness, uSaturation, uContrast, uNoiseAmount, uTimeX;',
        'uniform vec3 uColorRgb;',
        ...defines,
        'void main(){',
        '  vec4 col = texture2D(uTex, vUv);',
        '#ifdef COLOR_ADJUST_ON',
        '  col.rgb = (col.rgb - 0.5) * uContrast + 0.5;',
        '  float luma = dot(col.rgb, vec3(0.299, 0.587, 0.114));',
        '  col.rgb = mix(vec3(luma), col.rgb, uSaturation);',
        '  col.rgb = col.rgb * uBrightness;',
        '#endif',
        '#ifdef COLOR_FILTER_ON',
        '  col.rgb *= uColorRgb.rgb;',
        '#endif',
        '#ifdef GRAYSCALE_ON',
        '  float gluma = dot(col.rgb, vec3(0.299, 0.587, 0.114));',
        '  col.rgb = mix(col.rgb, vec3(gluma), uGrayFade);',
        '#endif',
        '#ifdef SEPIA_ON',
        '  vec3 sepia = vec3(',
        '    dot(col.rgb, vec3(0.393, 0.769, 0.189)),',
        '    dot(col.rgb, vec3(0.349, 0.686, 0.168)),',
        '    dot(col.rgb, vec3(0.272, 0.534, 0.131)));',
        '  col.rgb = mix(col.rgb, sepia, uSepiaFade);',
        '#endif',
        '#ifdef NOISE_ON',
        '  float n = fract(sin(dot(vUv * 1200.0 + uTimeX, vec2(12.9898, 78.233))) * 43758.5453);',
        '  col.rgb += (n - 0.5) * uNoiseAmount;',
        '#endif',
        '#ifdef VIGNETTE_HINT_ON',
        '  vec2 d = vUv - 0.5;',
        '  float vig = clamp(1.0 - dot(d, d) * 2.5, 0.0, 1.0);',
        '  col.rgb *= mix(vec3(0.85), vec3(1.0), vec3(vig));',
        '#endif',
        '  gl_FragColor = col;',
        '}'
      ].join('\n');
    }

    function applyFallback(ctx, frame, w, h, eff, time) {
      if (!ensure(w, h)) return null;
      const applied = new Set();
      try {
        const unsupported = ['dream', 'glitch', 'chromatical', 'fisheye', 'shockwave',
          'focus', 'arcade', 'radial_blur'].some((k) => eff[k]);
        const colorPass = ['gray_scale', 'sepia', 'color_filter', 'color_adjustment', 'noise']
          .some((k) => eff[k]);
        const bloomI = eff.bloom_intensity != null ? eff.bloom_intensity : 0;
        const bloomOn = eff.bloom && Math.abs(bloomI) > 0.0001;
        if (!colorPass && !bloomOn && !unsupported) return null;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texA);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
        into(texOrig, program('copy', FS.copy), {}, texA);
        let cur = texA;

        if (colorPass || unsupported) {
          const defines = [];
          if (eff.gray_scale) defines.push('#define GRAYSCALE_ON');
          if (eff.sepia) defines.push('#define SEPIA_ON');
          if (eff.color_filter && eff.color_filter_color) defines.push('#define COLOR_FILTER_ON');
          if (eff.color_adjustment) defines.push('#define COLOR_ADJUST_ON');
          if (eff.noise) defines.push('#define NOISE_ON');
          if (unsupported) defines.push('#define VIGNETTE_HINT_ON');
          const prog = program('fbColor_' + defines.map((d) => d.slice(8)).join('|'), fallbackColorFS(defines));
          const cc = eff.color_filter_color || { r: 1, g: 1, b: 1 };
          const uniforms = {
            uGrayFade: eff.gray_scale_intensity != null ? eff.gray_scale_intensity : 1,
            uSepiaFade: eff.sepia_intensity != null ? eff.sepia_intensity : 1,
            uColorRgb: [cc.r, cc.g, cc.b],
            uBrightness: eff.brightness != null ? eff.brightness : 1,
            uSaturation: eff.saturation != null ? eff.saturation : 1,
            uContrast: eff.contrast != null ? eff.contrast : 1,
            uNoiseAmount: eff.noise_intensity != null ? eff.noise_intensity : 0.2,
            uTimeX: time
          };
          const dst = cur === texA ? texB : texA;
          into(dst, prog, uniforms, cur);
          cur = dst;
          applied.add('fallbackColor');
        }

        if (bloomOn) {
          cur = doBloom(cur, bloomI);
          applied.add('bloom');
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, W, H);
        draw(program('copy', FS.copy), {}, cur);
        ctx.drawImage(canvas, 0, 0, w, h);
        return applied;
      } catch (e) {
        return null;
      }
    }

    function apply(ctx, frame, w, h, eff, time) {
      if (!ensure(w, h)) return null;
      const applied = new Set();
      try {
        // All 16 storyboard filters are GL-handled here, in the exact order the
        // Cytoid components sit on the camera (StoryboardRendererProvider):
        // arcade, artifact, chromatical, color_adjustment, color_filter, dream,
        // fisheye, focus, glitch, gray_scale, noise, radial_blur, sepia,
        // shockwave, tape, bloom.
        const glKeys = [
          'arcade', 'artifact', 'chromatical', 'color_adjustment', 'color_filter',
          'dream', 'fisheye', 'focus', 'glitch', 'gray_scale', 'noise',
          'radial_blur', 'sepia', 'shockwave', 'tape', 'bloom'
        ];
        if (!glKeys.some((k) => eff[k])) return null;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texA);
        // Flip the source canvas on upload so the final blit keeps the same
        // vertical orientation as the input frame (without this the whole
        // preview renders upside down).
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
        into(texOrig, program('copy', FS.copy), {}, texA);
        let cur = texA;

        const step = (prog, uniforms, src, extra) => {
          const dst = cur === texA ? texB : texA;
          into(dst, prog, uniforms, src || cur, extra);
          cur = dst;
        };

        // 1. Arcade (CameraFilterPack_TV_ARCADE_2).
        if (eff.arcade) {
          step(program('arcade', FS.arcade), {
            uTime: time,
            uSize: eff.arcade_interference_size != null ? eff.arcade_interference_size : 1,
            uSpeed: eff.arcade_interference_speed != null ? eff.arcade_interference_speed : 0.5,
            uContrast: eff.arcade_contrast != null ? eff.arcade_contrast : 1,
            uFade: eff.arcade_intensity != null ? eff.arcade_intensity : 1,
            uScreen: [w, h],
          });
          applied.add('arcade');
        }

        // 2. Artifact (CameraFilterPack_TV_Artefact).
        if (eff.artifact) {
          step(program('artifact', FS.artifact), {
            uTime: time,
            uFade: eff.artifact_intensity != null ? eff.artifact_intensity : 1,
            uColorisation: eff.artifact_colorisation != null ? eff.artifact_colorisation : 1,
            uParasite: eff.artifact_parasite != null ? eff.artifact_parasite : 1,
            uNoise: eff.artifact_noise != null ? eff.artifact_noise : 1,
          });
          applied.add('artifact');
        }

        // 3. Chromatical (CameraFilterPack_TV_Chromatical).
        if (eff.chromatical) {
          step(program('chromatical', FS.chromatical), {
            uIntensity: eff.chromatical_intensity != null ? eff.chromatical_intensity : 1,
            uFade: eff.chromatical_fade != null ? eff.chromatical_fade : 1,
            uSpeed: eff.chromatical_speed != null ? eff.chromatical_speed : 1,
            uTime: time,
          });
          applied.add('chromatical');
        }

        // 4. Color adjustment (CameraFilterPack_Color_BrightContrastSaturation).
        if (eff.color_adjustment) {
          step(program('colorAdjust', FS.colorAdjust), {
            uBrightness: eff.brightness != null ? eff.brightness : 1,
            uSaturation: eff.saturation != null ? eff.saturation : 1,
            uContrast: eff.contrast != null ? eff.contrast : 1,
          });
          applied.add('color_adjustment');
        }

        // 5. Color filter (CameraFilterPack_Color_RGB).
        if (eff.color_filter && eff.color_filter_color) {
          const c = eff.color_filter_color;
          step(program('colorFilter', FS.colorFilter), { uColor: [c.r, c.g, c.b] });
          applied.add('color_filter');
        }

        // 6. Dream (CameraFilterPack_Distortion_Dream).
        if (eff.dream) {
          step(program('dream', FS.dream), {
            uTime: time,
            uIntensity: eff.dream_intensity != null ? eff.dream_intensity : 1,
          });
          applied.add('dream');
        }

        // 7. Fisheye (CameraFilterPack_Distortion_FishEye).
        const fi = eff.fisheye_intensity != null ? eff.fisheye_intensity : 0.5;
        if (eff.fisheye && Math.abs(fi - 0.5) > 0.0001) {
          step(program('fisheye', FS.fisheye), { uIntensity: fi });
          applied.add('fisheye');
        }

        // 8. Focus (CameraFilterPack_Drawing_Manga_Flash_Color).
        if (eff.focus) {
          const c = eff.focus_color || { r: 1, g: 1, b: 1 };
          step(program('focus', FS.focus), {
            uTime: time,
            uSize: eff.focus_size != null ? eff.focus_size : 1,
            uSpeed: eff.focus_speed != null ? eff.focus_speed : 5,
            uIntensity: eff.focus_intensity != null ? eff.focus_intensity : 0.25,
            uPos: [0.5, 0.5], uColor: [c.r, c.g, c.b],
          });
          applied.add('focus');
        }

        // 9. Glitch (CameraFilterPack_FX_Glitch1).
        if (eff.glitch) {
          step(program('glitch', FS.glitch), {
            uIntensity: eff.glitch_intensity != null ? eff.glitch_intensity : 1,
            uTime: time,
          });
          applied.add('glitch');
        }

        // 10. Gray scale (CameraFilterPack_Color_GrayScale).
        if (eff.gray_scale) {
          step(program('gray', FS.gray), {
            uFade: eff.gray_scale_intensity != null ? eff.gray_scale_intensity : 1,
          });
          applied.add('gray_scale');
        }

        // 11. Noise (CameraFilterPack_Color_Noise).
        if (eff.noise) {
          step(program('noise', FS.noise), {
            uIntensity: eff.noise_intensity != null ? eff.noise_intensity : 0.2,
          });
          applied.add('noise');
        }

        // 12. Radial blur (CameraFilterPack_Blur_Radial_Fast).
        const ri = eff.radial_blur_intensity != null ? eff.radial_blur_intensity : 0.025;
        if (eff.radial_blur && Math.abs(ri) > 0.0005) {
          step(program('radial', FS.radial), { uIntensity: ri, uPos: [0.5, 0.5] });
          applied.add('radial_blur');
        }

        // 13. Sepia (CameraFilterPack_Color_Sepia).
        if (eff.sepia) {
          step(program('sepia', FS.sepia), {
            uFade: eff.sepia_intensity != null ? eff.sepia_intensity : 1,
          });
          applied.add('sepia');
        }

        // 14. Shockwave (CameraFilterPack_Distortion_ShockWave).
        if (eff.shockwave) {
          step(program('shockwave', FS.shockwave), {
            uTime: time,
            uSpeed: eff.shockwave_speed != null ? eff.shockwave_speed : 1,
            uPos: [0.5, 0.5],
          });
          applied.add('shockwave');
        }

        // 15. Tape (CameraFilterPack_TV_Videoflip).
        if (eff.tape) {
          step(program('tape', FS.tape), { uTime: time });
          applied.add('tape');
        }

        // 16. Bloom (Sleek Render post process; the vendor backend real Cytoid
        // builds run). Negative intensity subtracts the glow.
        const bloomI = eff.bloom_intensity != null ? eff.bloom_intensity : 0;
        if (eff.bloom && Math.abs(bloomI) > 0.001) {
          cur = doBloom(cur, bloomI);
          applied.add('bloom');
        }

        // Blit the final texture back to the 2D canvas.
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, W, H);
        draw(program('copy', FS.copy), {}, cur);
        ctx.drawImage(canvas, 0, 0, w, h);
        return applied;
      } catch (e) {
        return null;
      }
    }

    return { apply, applyFallback };
  })();

  function applyEffects(ctx, frame, W, H, eff, time, rich) {
    if (!eff) return;
    // Shader-level pass first (WebGL); the 2D approximations below are only
    // used for filters the GL pipeline did not handle (or when GL is missing).
    let glApplied = null;
    try {
      glApplied = rich
        ? GLPipeline.apply(ctx, frame, W, H, eff, time)
        : GLPipeline.applyFallback(ctx, frame, W, H, eff, time);
    } catch (e) {
      glApplied = null;
    }
    window.SBGlUsed = glApplied ? 1 : 0;
    const need2D = (k) => !glApplied || !glApplied.has(k);
    // Frame is the same canvas (ctx). Draw effects in order.
    let filterParts = [];

    if (eff.color_adjustment && need2D('color_adjustment')) {
      const b = eff.brightness != null ? eff.brightness : 1;
      const s = eff.saturation != null ? eff.saturation : 1;
      const c = eff.contrast != null ? eff.contrast : 1;
      // Skip identity passes entirely (they are the #1 frame-rate killer in
      // software canvas rendering).
      if (Math.abs(b - 1) > 0.001) filterParts.push(`brightness(${b})`);
      if (Math.abs(s - 1) > 0.001) filterParts.push(`saturate(${s})`);
      if (Math.abs(c - 1) > 0.001) filterParts.push(`contrast(${c})`);
    }
    if (eff.gray_scale && need2D('gray_scale')) {
      const g = Math.abs(eff.gray_scale_intensity != null ? eff.gray_scale_intensity : 1);
      if (g > 0.005) filterParts.push(`grayscale(${Math.min(1, g)})`);
    }
    if (eff.sepia && need2D('sepia')) {
      const s = Math.abs(eff.sepia_intensity != null ? eff.sepia_intensity : 1);
      if (s > 0.005) filterParts.push(`sepia(${Math.min(1, s)})`);
    }

    if (filterParts.length) {
      // Apply the color pass at half resolution and upscale: smooth color
      // adjustments are visually equivalent and this is ~4x cheaper in
      // software rendering (keeps the preview at 60fps on dense sections).
      const HW = Math.max(2, W >> 1), HH = Math.max(2, H >> 1);
      const key = 'coloradj' + HW + 'x' + HH;
      let buf = cache[key];
      if (!buf) {
        buf = offscreen(HW, HH);
        cache[key] = buf;
      }
      const bctx = buf.getContext('2d');
      bctx.clearRect(0, 0, HW, HH);
      bctx.filter = filterParts.join(' ');
      bctx.drawImage(frame, 0, 0, HW, HH);
      bctx.filter = 'none';
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(buf, 0, 0, W, H);
      ctx.restore();
    }

    if (eff.bloom && need2D('bloom')) {
      const intensity = Math.abs(eff.bloom_intensity != null ? eff.bloom_intensity : 0);
      if (intensity > 0.001) {
        const BW = Math.max(2, W >> 1), BH = Math.max(2, H >> 1);
        const key = 'bloom' + BW + 'x' + BH;
        let bloom = cache[key];
        if (!bloom) {
          bloom = offscreen(BW, BH);
          cache[key] = bloom;
        }
        const bctx = bloom.getContext('2d');
        bctx.clearRect(0, 0, BW, BH);
        bctx.filter = 'brightness(1.45)';
        bctx.drawImage(frame, 0, 0, BW, BH);
        bctx.filter = 'blur(' + Math.max(2, Math.round(BW / 70)) + 'px)';
        bctx.globalCompositeOperation = 'source-over';
        bctx.drawImage(bloom, 0, 0);
        bctx.filter = 'none';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, intensity / 5 * 0.9);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(bloom, 0, 0, W, H);
        ctx.restore();
      }
    }

    if (eff.radial_blur && need2D('radial_blur')) {
      const intensity = eff.radial_blur_intensity != null ? eff.radial_blur_intensity : 0.025;
      if (Math.abs(intensity) > 0.0005) {
        radialBlur(ctx, frame, W, H, intensity);
      }
    }

    if (eff.dream && need2D('dream')) {
      const intensity = Math.abs(eff.dream_intensity != null ? eff.dream_intensity : 1);
      if (intensity > 0.01) {
        const key = 'dream' + W + 'x' + H;
        let d = cache[key];
        if (!d) {
          d = offscreen(Math.max(2, W >> 2), Math.max(2, H >> 2));
          cache[key] = d;
        }
        const dctx = d.getContext('2d');
        dctx.clearRect(0, 0, d.width, d.height);
        dctx.drawImage(frame, 0, 0, d.width, d.height);
        dctx.filter = 'blur(' + Math.max(1, Math.round(d.width / 60)) + 'px) brightness(1.35)';
        dctx.drawImage(d, 0, 0);
        dctx.filter = 'none';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(0.85, intensity / 10 * 0.55);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(d, 0, 0, W, H);
        ctx.restore();
      }
    }

    if (eff.glitch && need2D('glitch')) {
      const intensity = Math.abs(eff.glitch_intensity != null ? eff.glitch_intensity : 1);
      if (intensity > 0.01) {
        const rnd = seededRandom(Math.floor(time * 24));
        const strips = Math.ceil(intensity * 14);
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < strips; i++) {
          const y = rnd() * H;
          const h = 2 + rnd() * Math.max(3, H * 0.05 * intensity);
          const dx = (rnd() - 0.5) * W * 0.12 * intensity;
          ctx.drawImage(frame, 0, y, W, h, dx, y, W, h);
        }
        ctx.restore();
        // RGB split
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.min(0.8, intensity * 0.6);
        const off = 2 + intensity * 8;
        ctx.drawImage(frame, -off, 0);
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.min(0.8, intensity * 0.6);
        ctx.drawImage(frame, off, 0);
        ctx.restore();
      }
    }

    if (eff.chromatical && need2D('chromatical')) {
      const intensity = Math.abs(eff.chromatical_intensity != null ? eff.chromatical_intensity : 1);
      const fade = Math.abs(eff.chromatical_fade != null ? eff.chromatical_fade : 1);
      const speed = eff.chromatical_speed != null ? eff.chromatical_speed : 1;
      if (intensity > 0.001 && fade > 0.001) {
        chromaticalAberration(ctx, frame, W, H, intensity, fade, speed, time);
      }
    }

    if (eff.fisheye && need2D('fisheye')) {
      const intensity = eff.fisheye_intensity != null ? eff.fisheye_intensity : 0.5;
      if (Math.abs(intensity - 0.5) > 0.01) {
        fisheye(ctx, frame, W, H, intensity);
      }
    }

    if (eff.noise && need2D('noise')) {
      const intensity = Math.abs(eff.noise_intensity != null ? eff.noise_intensity : 0.235);
      if (intensity > 0.005) {
        noise(ctx, W, H, intensity, time);
      }
    }

    if (eff.color_filter && eff.color_filter_color && need2D('color_filter')) {
      const c = eff.color_filter_color;
      ctx.save();
      // Unity's CameraFilterPack_Color_RGB multiplies the frame by the filter
      // color (white = no change), instead of a translucent overlay.
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (eff.shockwave && need2D('shockwave')) {
      const speed = eff.shockwave_speed != null ? eff.shockwave_speed : 1;
      const cx = W / 2, cy = H / 2;
      const phase = (time * speed * 0.8) % 1;
      const r = phase * Math.max(W, H) * 0.9;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * (1 - phase);
      const grad = ctx.createRadialGradient(cx, cy, Math.max(1, r * 0.94), cx, cy, r);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.9, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (eff.focus && need2D('focus')) {
      const size = eff.focus_size != null ? eff.focus_size : 1;
      const speed = eff.focus_speed != null ? eff.focus_speed : 5;
      const intensity = eff.focus_intensity != null ? eff.focus_intensity : 0.25;
      const color = eff.focus_color || { r: 1, g: 1, b: 1, a: 1 };
      focusLines(ctx, W, H, size, speed, intensity, color, time);
    }

    if (eff.arcade && need2D('arcade')) {
      const intensity = eff.arcade_intensity != null ? eff.arcade_intensity : 1;
      const size = eff.arcade_interference_size != null ? eff.arcade_interference_size : 1;
      const speed = eff.arcade_interference_speed != null ? eff.arcade_interference_speed : 0.5;
      const contrast = eff.arcade_contrast != null ? eff.arcade_contrast : 1;
      arcade(ctx, frame, W, H, intensity, size, speed, contrast, time);
    }

    if (eff.tape && need2D('tape')) {
      tape(ctx, frame, W, H, time);
    }

    if (eff.artifact && need2D('artifact')) {
      artifact2D(ctx, frame, W, H, eff, time);
    }

  }

  function chromaticalAberration(ctx, frame, W, H, intensity, fade, speed, time) {
    const SW = 480, SH = Math.round(480 * H / W);
    const key = 'chroma' + SW + 'x' + SH;
    let buf = cache[key];
    if (!buf) {
      buf = offscreen(SW, SH);
      cache[key] = buf;
    }
    const bctx = buf.getContext('2d');
    bctx.clearRect(0, 0, SW, SH);
    bctx.drawImage(frame, 0, 0, SW, SH);
    const src = bctx.getImageData(0, 0, SW, SH);
    const dst = bctx.createImageData(SW, SH);
    const off = Math.max(1, Math.round(intensity * SW * 0.04 * (0.6 + 0.4 * Math.sin(time * speed * 3))));
    const data = src.data;
    const out = dst.data;
    for (let y = 0; y < SH; y++) {
      for (let x = 0; x < SW; x++) {
        const i = (y * SW + x) * 4;
        const ri = (y * SW + Math.min(SW - 1, x + off)) * 4;
        const bi = (y * SW + Math.max(0, x - off)) * 4;
        out[i] = data[ri];
        out[i + 1] = data[i + 1];
        out[i + 2] = data[bi];
        out[i + 3] = data[i + 3];
      }
    }
    bctx.putImageData(dst, 0, 0);
    ctx.save();
    ctx.globalAlpha = Math.min(1, fade);
    ctx.drawImage(buf, 0, 0, W, H);
    ctx.restore();
  }

  function fisheye(ctx, frame, W, H, intensity) {
    const SW = 400, SH = Math.round(400 * H / W);
    const key = 'fisheye' + SW + 'x' + SH;
    let buf = cache[key];
    if (!buf) {
      buf = offscreen(SW, SH);
      cache[key] = buf;
    }
    const bctx = buf.getContext('2d');
    bctx.clearRect(0, 0, SW, SH);
    bctx.drawImage(frame, 0, 0, SW, SH);
    const src = bctx.getImageData(0, 0, SW, SH);
    const dst = bctx.createImageData(SW, SH);
    const data = src.data;
    const out = dst.data;
    const cx = SW / 2, cy = SH / 2;
    // 0.5 is neutral; the offset from 0.5, scaled by the same 24 as the GLSL
    // path, sets the barrel/pincushion strength.  Uses normalized UV radii so
    // the fallback matches the shader's shape exactly.
    const k = (0.5 - intensity) * 24;
    for (let y = 0; y < SH; y++) {
      for (let x = 0; x < SW; x++) {
        const dx = x - cx, dy = y - cy;
        const f = 1 + k * ((dx / SW) * (dx / SW) + (dy / SH) * (dy / SH));
        const sx = Math.min(SW - 1, Math.max(0, cx + dx / f));
        const sy = Math.min(SH - 1, Math.max(0, cy + dy / f));
        const si = (Math.round(sy) * SW + Math.round(sx)) * 4;
        const di = (y * SW + x) * 4;
        out[di] = data[si];
        out[di + 1] = data[si + 1];
        out[di + 2] = data[si + 2];
        out[di + 3] = data[si + 3];
      }
    }
    bctx.putImageData(dst, 0, 0);
    ctx.drawImage(buf, 0, 0, W, H);
  }

  // True radial blur (CameraFilterPack_Blur_Radial_Fast style): pixels are
  // smeared ALONG the radial direction from the screen center, so the center
  // stays sharp and the streak grows toward the edges - not a uniform
  // full-screen Gaussian blur.
  function radialBlur(ctx, frame, W, H, intensity) {
    const SW = 360, SH = Math.max(2, Math.round(360 * H / W));
    const key = 'radialblur' + SW + 'x' + SH;
    let buf = cache[key];
    if (!buf) {
      buf = offscreen(SW, SH);
      cache[key] = buf;
    }
    const bctx = buf.getContext('2d');
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, SW, SH);
    bctx.drawImage(frame, 0, 0, SW, SH);

    const src = bctx.getImageData(0, 0, SW, SH);
    const dst = bctx.createImageData(SW, SH);
    const data = src.data, out = dst.data;
    const cx = SW / 2, cy = SH / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy) || 1;
    // One-sided radial smear; the sign flips the streak direction.
    const dir = intensity < 0 ? -1 : 1;
    const mag = Math.min(0.4, Math.abs(intensity) * 0.7);
    const samples = Math.max(3, Math.min(10, Math.round(mag * 30 + 3)));
    // Weighted samples: the original pixel keeps the most energy so the streak
    // is a fading tail (motion-blur look) instead of a flat dim smear.
    const weights = [];
    let wsum = 0;
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const w = Math.exp(-t * t * 2.5);
      weights.push(w);
      wsum += w;
    }
    const w1 = SW - 1, h1 = SH - 1;
    for (let y = 0; y < SH; y++) {
      const dy = y - cy;
      const rowBase = y * SW;
      for (let x = 0; x < SW; x++) {
        const dx = x - cx;
        const rn = Math.sqrt(dx * dx + dy * dy) / maxR;
        const step = (dir * mag * rn) / samples;
        let r = 0, g = 0, b = 0, a = 0;
        for (let i = 0; i < samples; i++) {
          let sx = x + dx * i * step;
          let sy = y + dy * i * step;
          if (sx < 0) sx = 0; else if (sx > w1) sx = w1;
          if (sy < 0) sy = 0; else if (sy > h1) sy = h1;
          const si = (Math.round(sy) * SW + Math.round(sx)) * 4;
          r += data[si] * weights[i];
          g += data[si + 1] * weights[i];
          b += data[si + 2] * weights[i];
          a += data[si + 3] * weights[i];
        }
        const di = (rowBase + x) * 4;
        out[di] = r / wsum;
        out[di + 1] = g / wsum;
        out[di + 2] = b / wsum;
        out[di + 3] = a / wsum;
      }
    }
    bctx.putImageData(dst, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buf, 0, 0, W, H);
    ctx.restore();
  }

  function noise(ctx, W, H, intensity, time) {
    const SW = 160, SH = 90;
    const key = 'noise' + SW + 'x' + SH;
    let buf = cache[key];
    if (!buf) {
      buf = offscreen(SW, SH);
      cache[key] = buf;
    }
    const bctx = buf.getContext('2d');
    const img = bctx.createImageData(SW, SH);
    const rnd = seededRandom(Math.floor(time * 30));
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rnd() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    bctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = Math.min(1, intensity * 0.65);
    ctx.drawImage(buf, 0, 0, W, H);
    ctx.restore();
  }

  function focusLines(ctx, W, H, size, speed, intensity, color, time) {
    if (Math.abs(intensity) <= 0.005) return;
    const cx = W / 2, cy = H / 2;
    const rot = time * speed * 0.5;
    const lines = Math.max(8, Math.round(48 * Math.max(0.25, size || 1)));
    // Same geometry as the GLSL path: the central ~60% of the screen stays
    // clear and the rays span from there out to the corners.
    const halfDiag = Math.hypot(W, H) / 2;
    const inner = halfDiag * 0.6;
    const outer = halfDiag;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = Math.max(1, W / 480);
    ctx.strokeStyle = `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${Math.min(1, Math.abs(intensity))})`;
    ctx.beginPath();
    for (let i = 0; i < lines; i++) {
      const a = (i / lines) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Subtle barrel distortion (CRT screen curvature): dst(x,y) samples src
  // closer to the center, inflating the middle like a convex tube face.
  function barrelWarp(ctx, w, h, k) {
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const dst = ctx.createImageData(w, h);
    const out = dst.data;
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy) || 1;
    const w1 = w - 1, h1 = h - 1;
    for (let y = 0; y < h; y++) {
      const dy = y - cy;
      const rowBase = y * w;
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const rn2 = (dx * dx + dy * dy) / (maxR * maxR);
        const f = 1 + k * rn2;
        let sx = cx + dx / f;
        let sy = cy + dy / f;
        if (sx < 0) sx = 0; else if (sx > w1) sx = w1;
        if (sy < 0) sy = 0; else if (sy > h1) sy = h1;
        const si = (Math.round(sy) * w + Math.round(sx)) * 4;
        const di = (rowBase + x) * 4;
        out[di] = data[si];
        out[di + 1] = data[si + 1];
        out[di + 2] = data[si + 2];
        out[di + 3] = data[si + 3];
      }
    }
    ctx.putImageData(dst, 0, 0);
  }

  function arcade(ctx, frame, W, H, intensity, size, speed, contrast, time) {
    if (Math.abs(intensity) <= 0.005) return;
    // Signed intensity drives the fisheye direction (negative = reversed
    // curvature); the other CRT layers follow the magnitude.
    const k = Math.max(-1, Math.min(1, intensity));
    const a = Math.min(1, Math.abs(intensity));
    // Classic CRT (显像管) look: subtle barrel curvature, a faint double-glass
    // echo (old CRT tube front panel), fine uniform dark horizontal scanlines
    // (1px line, 2px pitch at default size), a tube vignette, and the
    // storyboard's arcade_contrast pass.
    const HW = Math.max(2, W >> 1), HH = Math.max(2, H >> 1);
    const key = 'arcade' + HW + 'x' + HH;
    let buf = cache[key];
    if (!buf) {
      buf = offscreen(HW, HH);
      cache[key] = buf;
    }
    const bctx = buf.getContext('2d');
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, HW, HH);
    bctx.drawImage(frame, 0, 0, HW, HH);

    // 1. Barrel curvature (subtle fisheye); negative intensity reverses it.
    if (Math.abs(k) > 0.02) {
      barrelWarp(bctx, HW, HH, 0.08 * k);
    }

    // 2. Double-glass echo: faint offset duplicate of the curved frame.
    if (a > 0.03) {
      const ghostKey = 'arcadeghost' + HW + 'x' + HH;
      let ghost = cache[ghostKey];
      if (!ghost) {
        ghost = offscreen(HW, HH);
        cache[ghostKey] = ghost;
      }
      const gctx = ghost.getContext('2d');
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.clearRect(0, 0, HW, HH);
      gctx.drawImage(buf, 0, 0);
      bctx.save();
      bctx.globalCompositeOperation = 'screen';
      bctx.globalAlpha = 0.16 * a;
      bctx.drawImage(ghost, 2, 0);
      bctx.drawImage(ghost, -2, 0);
      bctx.globalAlpha = 0.10 * a;
      bctx.drawImage(ghost, 0, 2);
      bctx.drawImage(ghost, 0, -2);
      bctx.restore();
    }

    // 3. Contrast pass (only when non-default).
    if (Math.abs(contrast - 1) > 0.01) {
      const cKey = 'arcadec' + HW + 'x' + HH;
      let cbuf = cache[cKey];
      if (!cbuf) {
        cbuf = offscreen(HW, HH);
        cache[cKey] = cbuf;
      }
      const cctx = cbuf.getContext('2d');
      cctx.setTransform(1, 0, 0, 1, 0, 0);
      cctx.clearRect(0, 0, HW, HH);
      cctx.filter = `contrast(${contrast})`;
      cctx.drawImage(buf, 0, 0);
      cctx.filter = 'none';
      bctx.clearRect(0, 0, HW, HH);
      bctx.drawImage(cbuf, 0, 0);
    }

    // 4. Upscale the composed frame once.
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buf, 0, 0, W, H);
    ctx.restore();

    // 5. Scanlines (full-res, crisp 1px lines at the configured pitch).
    // Reference spacing is ~5px at the default arcade_interference_size=1.
    const pitch = Math.max(2, Math.round(1 + 4 * size));
    const lineAlpha = Math.min(0.85, 0.72 * a);
    const drift = speed > 0.001 ? Math.round((time * speed * 6) % pitch) : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(16,16,16,${lineAlpha})`;
    for (let y = drift; y < H; y += pitch) {
      ctx.fillRect(0, y, W, 1);
    }
    ctx.restore();

    // 6. Slight vignette at the corners (part of the CRT tube look).
    if (a > 0.01) {
      const vg = Math.min(0.3, 0.15 * a);
      const grad = ctx.createRadialGradient(
        W / 2, H / 2, Math.min(W, H) * 0.25,
        W / 2, H / 2, Math.max(W, H) * 0.72
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${vg})`);
      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // v2.0.2 语义：arcade_intensity 映射 CameraFilterPack_TV_ARCADE_2 的 Fade
    // （0..1 混合度）——处理后的 CRT 帧与原帧按 intensity 混合（0=无效果）。
    if (Math.abs(intensity) > 0.005 && Math.abs(intensity) < 0.995) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, 1 - Math.abs(intensity)));
      ctx.drawImage(frame, 0, 0, W, H);
      ctx.restore();
    }
  }

  // CameraFilterPack_TV_Videoflip 2D 近似：画面绕水平轴周期翻转，过渡时带
  // 轻微压缩扭曲（v2.0.2 中 tape 只有开关，无强度参数）。
  function tape(ctx, frame, W, H, time) {
    const cyc = 1.8;
    const ph = ((time % cyc) + cyc) % cyc / cyc;
    const flip = Math.sin(ph * Math.PI); // 0..1..0（中间为翻转瞬间）
    if (flip < 0.02) return;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    const sy = flip;
    // 翻转过渡：scaleY 由 1 → -1（穿过 0 时压缩），配合小幅水平撕裂。
    ctx.translate(0, H / 2);
    ctx.scale(1, sy);
    ctx.drawImage(frame, 0, -H / 2, W, H);
    ctx.restore();
    // 过渡瞬间补一条滚动的亮线（磁带翻转的特征）。
    if (flip > 0.4 && flip < 0.96) {
      const y = (time * 220) % H;
      ctx.save();
      ctx.globalAlpha = 0.25 * Math.sin(flip * Math.PI);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, y, W, 2);
      ctx.restore();
    }
  }

  // CameraFilterPack_TV_Artefact 2D 近似：寄生干扰条 + 噪点 + 颜色化，
  // 按 Fade（artifact_intensity）与原帧混合。
  function artifact2D(ctx, frame, W, H, eff, time) {
    const fade = Math.max(0, Math.min(1, eff.artifact_intensity != null ? eff.artifact_intensity : 1));
    if (fade <= 0.005) return;
    const colorisation = Math.max(0, Math.min(1, eff.artifact_colorisation != null ? eff.artifact_colorisation : 0.5));
    const parasite = eff.artifact_parasite != null ? eff.artifact_parasite : 0.5;
    const noiseAmt = eff.artifact_noise != null ? eff.artifact_noise : 0.2;
    const SW = 320, SH = Math.max(2, Math.round(320 * H / W));
    const key = 'artifact' + SW + 'x' + SH;
    let buf = cache[key];
    if (!buf) {
      buf = offscreen(SW, SH);
      cache[key] = buf;
    }
    const bctx = buf.getContext('2d');
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, SW, SH);
    bctx.drawImage(frame, 0, 0, SW, SH);
    const src = bctx.getImageData(0, 0, SW, SH);
    const dst = bctx.createImageData(SW, SH);
    const data = src.data, out = dst.data;
    const rnd = seededRandom(Math.floor(time * 14));
    const bandPhase = Math.floor(time * 14) * 0.37;
    for (let y = 0; y < SH; y++) {
      const band = (Math.floor(y / 9) + bandPhase) % 2;
      const rowBase = y * SW;
      for (let x = 0; x < SW; x++) {
        const dx = band ? Math.max(0, Math.min(SW - 1, Math.round(x + (rnd() - 0.5) * parasite * 6))) : x;
        const si = (rowBase + dx) * 4;
        let r = data[si], g = data[si + 1], b = data[si + 2];
        const n = (rnd() - 0.5) * noiseAmt * 130;
        r += n; g += n; b += n;
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = r * (1 - colorisation * 0.5) + luma * colorisation * 0.5 * 1.02;
        g = g * (1 - colorisation * 0.5) + luma * colorisation * 0.5 * 0.88;
        b = b * (1 - colorisation * 0.5) + luma * colorisation * 0.5 * 0.72;
        const di = (rowBase + x) * 4;
        out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = 255;
      }
    }
    bctx.putImageData(dst, 0, 0);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buf, 0, 0, W, H);
    ctx.restore();
  }

  const api = { applyEffects };
  if (typeof window !== 'undefined') window.SBEffects = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
