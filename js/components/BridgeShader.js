export class BridgeShader {
  constructor(canvas) {
    this.canvas = canvas;
    this.animationFrameId = null;
    this.mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    this.init();
  }

  init() {
    const canvas = this.canvas;
    
    this.syncSize = () => {
      const w = canvas.clientWidth || window.innerWidth || 1280;
      const h = canvas.clientHeight || window.innerHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(this.syncSize);
      this.ro.observe(canvas);
    }
    this.syncSize();

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;
    this.gl = gl;

    const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

    const fsSrc = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
varying vec2 v_texCoord;

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = rot(0.37);
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = m * p * 2.05 + vec2(0.4, 0.2);
        a *= 0.5;
    }
    return v;
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float map(vec3 p) {
    float ground = p.y + 2.2 + 0.15 * sin(p.x * 1.5 + u_time * 0.4) * cos(p.z * 1.2);
    
    vec3 roadPos = p - vec3(0.0, 0.0, 0.0);
    float roadDeck = sdBox(roadPos - vec3(0.0, -0.05, 0.0), vec3(1.4, 0.08, 100.0));
    float railLeft = sdBox(roadPos - vec3(-1.38, 0.15, 0.0), vec3(0.06, 0.12, 100.0));
    float railRight = sdBox(roadPos - vec3(1.38, 0.15, 0.0), vec3(0.06, 0.12, 100.0));
    float road = min(roadDeck, min(railLeft, railRight));

    float zPylonRep = mod(p.z + 6.0, 12.0) - 6.0;
    vec3 pylonPos = vec3(p.x, p.y, zPylonRep);
    
    float towerLeft = sdBox(pylonPos - vec3(-1.8, 1.4, 0.0), vec3(0.14, 2.0, 0.18));
    float towerRight = sdBox(pylonPos - vec3(1.8, 1.4, 0.0), vec3(0.14, 2.0, 0.18));
    float crossBeam = sdBox(pylonPos - vec3(0.0, 3.2, 0.0), vec3(1.9, 0.15, 0.16));
    float pierLeft = sdBox(pylonPos - vec3(-1.4, -1.2, 0.0), vec3(0.25, 1.1, 0.35));
    float pierRight = sdBox(pylonPos - vec3(1.4, -1.2, 0.0), vec3(0.25, 1.1, 0.35));
    
    float bridgeStructure = min(min(towerLeft, towerRight), min(crossBeam, min(pierLeft, pierRight)));

    float mainPipeRight = length(p.xy - vec2(2.6, -0.6)) - 0.28;
    float collarRight = length(vec2(length(p.xy - vec2(2.6, -0.6)) - 0.33, mod(p.z + 1.0, 2.0) - 1.0)) - 0.05;
    
    float pipeLeftUpper = length(p.xy - vec2(-2.5, -0.4)) - 0.18;
    float pipeLeftLower = length(p.xy - vec2(-2.5, -0.9)) - 0.18;
    
    float zPipeRep = mod(p.z + 3.0, 6.0) - 3.0;
    float crossPipe = length(vec2(p.y - (-0.75), zPipeRep)) - 0.14;
    vec3 riserPos = vec3(p.x, p.y, zPylonRep);
    float riserLeft = length(riserPos.xz - vec2(-2.5, 0.0)) - 0.12;
    riserLeft = max(riserLeft, p.y - 1.2);
    riserLeft = max(riserLeft, -p.y - 1.2);
    
    float plumbing = min(min(mainPipeRight, collarRight), min(pipeLeftUpper, min(pipeLeftLower, min(crossPipe, riserLeft))));

    float d = min(ground, road);
    d = min(d, bridgeStructure);
    d = min(d, plumbing);
    return d;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    
    float camSpeed = u_time * 2.2;
    vec2 mouseOffset = (u_mouse / u_resolution) - 0.5;
    
    vec3 ro = vec3(0.0 + mouseOffset.x * 1.5, 1.2 + mouseOffset.y * 0.8, camSpeed);
    vec3 target = vec3(sin(u_time * 0.3) * 0.4, 0.4, camSpeed + 8.0);
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);
    
    vec3 rd = normalize(forward * 1.25 + right * uv.x + up * uv.y);
    
    float t = 0.0;
    float d = 0.0;
    int hit = 0;
    for (int i = 0; i < 54; i++) {
        vec3 p = ro + rd * t;
        d = map(p);
        if (d < 0.007) {
            hit = 1;
            break;
        }
        t += d * 0.82;
        if (t > 24.0) break;
    }
    
    vec3 skyDark = vec3(0.02, 0.025, 0.05);
    vec3 skyGlow = vec3(0.07, 0.025, 0.08);
    vec3 col = mix(skyDark, skyGlow, uv.y + 0.5);

    vec3 malachite = vec3(0.0, 0.86, 0.46);
    vec3 razzmatazz = vec3(0.91, 0.045, 0.38);
    vec3 heliotrope = vec3(0.88, 0.46, 1.0);
    
    if (hit == 1) {
        vec3 p = ro + rd * t;
        vec2 e = vec2(0.01, 0.0);
        vec3 n = normalize(vec3(
            map(p + e.xyy) - map(p - e.xyy),
            map(p + e.yxy) - map(p - e.yxy),
            map(p + e.yyx) - map(p - e.yyx)
        ));
        
        vec3 lightDir = normalize(vec3(0.6, 1.2, -0.7));
        float diff = max(dot(n, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 16.0);
        float fresnel = pow(1.0 - max(dot(-rd, n), 0.0), 2.2);
        
        vec3 surfaceBase = vec3(0.07, 0.08, 0.11);
        vec3 glow = vec3(0.0);
        
        if (abs(p.y) < 0.25 && abs(p.x) < 1.45) {
            surfaceBase = vec3(0.05, 0.06, 0.085);
            
            float centerDist = abs(p.x);
            float laneStripe = step(centerDist, 0.04) * step(fract((p.z - camSpeed * 0.2) * 0.4), 0.55);
            glow += malachite * laneStripe * 2.2;
            
            float sideLeft = smoothstep(0.04, 0.0, abs(p.x - (-1.2)));
            float sideRight = smoothstep(0.04, 0.0, abs(p.x - 1.2));
            glow += heliotrope * (sideLeft + sideRight) * 1.6;
            
            float trafficRight = sin((p.z - u_time * 14.0) * 0.6) * 0.5 + 0.5;
            float carBeamRight = smoothstep(0.88, 0.99, trafficRight) * smoothstep(0.28, 0.0, abs(p.x - 0.6));
            glow += razzmatazz * carBeamRight * 3.5;
            
            float trafficLeft = sin((p.z + u_time * 11.0) * 0.7) * 0.5 + 0.5;
            float carBeamLeft = smoothstep(0.86, 0.99, trafficLeft) * smoothstep(0.28, 0.0, abs(p.x - (-0.6)));
            glow += malachite * carBeamLeft * 3.2;
        }
        
        if (p.y > 0.25 || abs(p.x) > 1.4) {
            surfaceBase = vec3(0.08, 0.09, 0.13);
            glow += heliotrope * fresnel * 0.9;
            
            if (p.y > 3.0) {
                float beaconBlink = sin(u_time * 4.0) * 0.5 + 0.5;
                glow += razzmatazz * beaconBlink * 1.5;
            }
        }
        
        if (p.y < 0.1 && (abs(p.x) > 1.9 || abs(p.x) < 0.2)) {
            surfaceBase = vec3(0.04, 0.05, 0.07);
            
            float flowSpeed = p.z * 1.5 - u_time * 7.5;
            float pulse = sin(flowSpeed);
            float pulseCore = smoothstep(0.65, 0.98, pulse);
            
            vec3 fluidColor = mix(malachite, heliotrope, sin(p.z * 0.25 + u_time * 1.2) * 0.5 + 0.5);
            glow += fluidColor * pulseCore * 2.8;
            glow += fresnel * fluidColor * 1.1;
            
            float ringPattern = smoothstep(0.85, 0.98, sin(p.z * 3.1415));
            glow += razzmatazz * ringPattern * 0.75;
        }
        
        col = surfaceBase * (diff * 0.6 + 0.4) + glow + spec * heliotrope * 0.6;
        col = mix(col, skyDark, smoothstep(4.0, 23.0, t));
    }
    
    vec2 pScreen = uv;
    float cableMod = fract(pScreen.x * 12.0 + pScreen.y * 5.0 + u_time * 0.2);
    if (cableMod < 0.04 && uv.y > -0.2 && uv.y < 0.55) {
        float cableFade = smoothstep(0.55, 0.0, uv.y) * smoothstep(-0.2, 0.1, uv.y);
        col += heliotrope * cableFade * 0.35;
    }
    
    vec2 smokeUV1 = uv * 2.4 + vec2(u_time * 0.06, -u_time * 0.18);
    vec2 smokeUV2 = uv * 3.8 + vec2(-u_time * 0.08, -u_time * 0.28);
    float steam = fbm(smokeUV1 + fbm(smokeUV2));
    steam = smoothstep(0.35, 0.8, steam);
    
    vec3 steamTint = mix(vec3(0.04, 0.06, 0.1), heliotrope * 0.4, sin(uv.x * 3.0 + u_time * 0.8) * 0.5 + 0.5);
    steamTint = mix(steamTint, razzmatazz * 0.35, clamp(uv.y * 0.6 + 0.2, 0.0, 0.5));
    col = mix(col, steamTint, steam * 0.35);

    col *= 0.86 + 0.14 * cos(uv.y * 3.1415);
    
    float spark = hash(uv + fract(u_time * 0.03));
    if (spark > 0.991) {
        col += mix(malachite, razzmatazz, fract(spark * 100.0)) * 0.6;
    }

    gl_FragColor = vec4(col, 1.0);
}`;

    function cs(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    this.uTime = gl.getUniformLocation(prog, 'u_time');
    this.uRes = gl.getUniformLocation(prog, 'u_resolution');
    this.uMouse = gl.getUniformLocation(prog, 'u_mouse');

    this.onMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = 1.0 - (event.clientY - rect.top) / rect.height;
        this.mouse.x = nx * canvas.width;
        this.mouse.y = ny * canvas.height;
      }
    };
    window.addEventListener('mousemove', this.onMouseMove);

    this.render = (t) => {
      if (typeof ResizeObserver === 'undefined') this.syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (this.uTime) gl.uniform1f(this.uTime, t * 0.001);
      if (this.uRes) gl.uniform2f(this.uRes, canvas.width, canvas.height);
      if (this.uMouse) gl.uniform2f(this.uMouse, this.mouse.x, this.mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.animationFrameId = requestAnimationFrame(this.render);
    };
    this.animationFrameId = requestAnimationFrame(this.render);
  }

  destroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.ro) this.ro.disconnect();
    window.removeEventListener('mousemove', this.onMouseMove);
  }
}
