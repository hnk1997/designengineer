// The hero's 3D piece: a product as an exploded stack of layers,
// from napkin sketch at the bottom to live product on top.
(() => {
  const { makeTextures } = window.HC;

  const DIMS = { w: 3.2, d: 1.95, t: 0.07 };

  const LAYERS = [
    { key: 'idea', idx: '01', name: 'Idea', meta: 'Napkin sketch, taken seriously', glow: 0.9, anchor: [0.75, -0.55] },
    { key: 'structure', idx: '02', name: 'Structure', meta: 'Flows, wireframes, the boring bits that matter', glow: 0.75, anchor: [0.62, -0.35] },
    { key: 'design', idx: '03', name: 'Design', meta: 'Interface and design system', glow: 0.32, anchor: [0.7, -0.5] },
    { key: 'build', idx: '04', name: 'Build', meta: 'Production front-end, not a prototype', glow: 0.8, anchor: [0.66, -0.3] },
    { key: 'launch', idx: '05', name: 'Launch', meta: 'Live, on the date we agreed', glow: 0.85, anchor: [0.72, -0.48] },
  ];

  const SPREAD = 0.54; // exploded layer gap
  const STACKED = 0.085; // assembled layer gap
  const BG_SCALE = 0.35; // the background is soft, so it renders at a fraction of screen size
  const INTRO = 1.7; // seconds for each layer to drop in

  const quadVert = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

  // Slow domain-warped fbm in the brand gradient. Light rises from the
  // bottom-right so the top-left stays quiet for the headline.
  const bgFrag = /* glsl */ `
    precision mediump float;
    uniform float uTime;
    uniform vec2 uRes;
    uniform vec2 uPointer;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
      return v;
    }

    void main() {
      vec2 uv = vUv;
      vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      p += uPointer * 0.05;
      float t = uTime * 0.045;

      vec2 q = vec2(fbm(p * 1.3 + vec2(0.0, t)), fbm(p * 1.3 + vec2(5.2, 1.3) - t));
      vec2 r = vec2(fbm(p * 1.1 + 2.6 * q + vec2(1.7, 9.2) + t * 1.4),
                    fbm(p * 1.1 + 2.6 * q + vec2(8.3, 2.8) - t));
      float f = fbm(p * 1.2 + 2.2 * r);

      vec3 blue = vec3(0.145, 0.388, 0.922);
      vec3 rose = vec3(0.882, 0.114, 0.282);
      vec3 orange = vec3(0.976, 0.451, 0.086);
      vec3 col = mix(blue, rose, smoothstep(0.42, 0.82, r.x));
      col = mix(col, orange, smoothstep(0.58, 0.9, q.y) * 0.7);

      float lift = smoothstep(1.0, -0.1, uv.y) * 0.9 + smoothstep(0.25, 1.1, uv.x) * 0.35;
      float glow = pow(f, 2.0) * 2.3 * lift;
      vec3 c = vec3(0.012, 0.013, 0.018) + col * glow * 0.6;
      c += blue * 0.12 * smoothstep(0.5, 0.0, uv.y);

      float vig = smoothstep(1.3, 0.25, length((uv - vec2(0.62, 0.45)) * vec2(1.1, 1.3)));
      c *= mix(0.5, 1.0, vig);
      gl_FragColor = vec4(c, 1.0);
    }
  `;

  // Draws the low-res background texture across the screen, untouched
  const blitFrag = /* glsl */ `
    precision mediump float;
    uniform sampler2D tMap;
    varying vec2 vUv;
    void main() { gl_FragColor = texture2D(tMap, vUv); }
  `;

  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(37,99,235,0.9)');
    gr.addColorStop(0.45, 'rgba(37,99,235,0.25)');
    gr.addColorStop(1, 'rgba(37,99,235,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const quartOut = (x) => (x >= 1 ? 1 : 1 - Math.pow(1 - x, 4));

  function createStage(canvas, { reduced = false, maxPixelRatio = 1.5, lowPower = false } = {}) {
    const dpr = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      // MSAA is wasted work once the pixel ratio is high enough to hide jaggies
      antialias: dpr < 1.5,
      powerPreference: 'default',
      stencil: false,
    });
    renderer.setPixelRatio(dpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const lookAt = new THREE.Vector3(0, 0.3, 0);
    camera.position.set(0, 3.3, 8.6);
    camera.lookAt(lookAt);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.RoomEnvironment(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
    envScene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });

    // Background: rendered small into its own target, then stretched behind the scene
    const quad = new THREE.PlaneGeometry(2, 2);
    const bgTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: bgFrag,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uPointer: { value: new THREE.Vector2() },
      },
      depthTest: false,
      depthWrite: false,
    });
    const bgScene = new THREE.Scene();
    const bgMesh = new THREE.Mesh(quad, bgMat);
    bgMesh.frustumCulled = false;
    bgScene.add(bgMesh);
    const bgCamera = new THREE.Camera();

    const blit = new THREE.Mesh(quad, new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: blitFrag,
      uniforms: { tMap: { value: bgTarget.texture } },
      depthTest: false,
      depthWrite: false,
    }));
    blit.frustumCulled = false;
    blit.renderOrder = -1;
    scene.add(blit);

    // Light, tinted with the brand colours so the chrome edges pick them up
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 6, 4);
    const blue = new THREE.PointLight(0x2563eb, 38, 0, 2);
    blue.position.set(-4, 1.2, 3);
    const rose = new THREE.PointLight(0xe11d48, 30, 0, 2);
    rose.position.set(4.5, -1.2, 2.2);
    const orange = new THREE.PointLight(0xf97316, 26, 0, 2);
    orange.position.set(1.5, 4, -3);
    scene.add(key, blue, rose, orange);

    // Stack
    const stack = new THREE.Group();
    scene.add(stack);

    const { w, d, t } = DIMS;
    const bodyGeo = new THREE.RoundedBoxGeometry(w, t, d, 2, 0.035);
    // Clearcoat is the priciest part of the shading; on a low budget the standard material
    // with a touch less roughness reads almost the same
    const bodyMat = lowPower
      ? new THREE.MeshStandardMaterial({ color: 0x171a21, metalness: 1, roughness: 0.2 })
      : new THREE.MeshPhysicalMaterial({ color: 0x171a21, metalness: 1, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.15 });
    // Frosted look without real transmission, which would render the whole scene twice
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x8fa6e8, metalness: 0.2, roughness: 0.2, transparent: true, opacity: 0.22, depthWrite: false,
    });
    const screenGeo = new THREE.PlaneGeometry(w - 0.09, d - 0.09);
    screenGeo.rotateX(-Math.PI / 2);

    const outlinePts = [
      [-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2],
    ].map(([x, z]) => new THREE.Vector3(x, t / 2 + 0.004, z));
    const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePts);
    const outlineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32 });

    const textures = makeTextures(Math.min(4, renderer.capabilities.getMaxAnisotropy()));

    const layers = LAYERS.map((cfg, i) => {
      const group = new THREE.Group();
      const isGlass = cfg.key === 'idea';
      const body = new THREE.Mesh(bodyGeo, isGlass ? glassMat : bodyMat);
      const tex = textures[cfg.key];
      const screen = new THREE.Mesh(
        screenGeo,
        new THREE.MeshStandardMaterial({
          map: tex,
          emissiveMap: tex,
          emissive: 0xffffff,
          emissiveIntensity: cfg.glow,
          roughness: 0.4,
          envMapIntensity: 0.25,
          transparent: isGlass,
          depthWrite: !isGlass,
        }),
      );
      screen.position.y = t / 2 + 0.002;
      const outline = new THREE.LineLoop(outlineGeo, outlineMat);
      group.add(body, screen, outline);
      stack.add(group);

      return {
        ...cfg,
        group,
        // Annotation anchor on the screen surface, in layer-local space
        anchorLocal: new THREE.Vector3(cfg.anchor[0] * (w / 2), t / 2, cfg.anchor[1] * (d / 2)),
        phase: i * 0.9,
        // how far above its resting place it starts: close enough to fall in with the canvas fade,
        // so the stack, not the empty background, is the first thing that shows
        drop: 2.6 + i * 0.45,
        delay: i * 0.08,
        intro: { y: 0, r: 0 },
      };
    });

    // Dashed construction lines through the corners, like an assembly drawing
    const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
    const guidePos = new Float32Array(corners.length * (layers.length - 1) * 2 * 3);
    const guideGeo = new THREE.BufferGeometry();
    guideGeo.setAttribute('position', new THREE.BufferAttribute(guidePos, 3));
    const guides = new THREE.LineSegments(
      guideGeo,
      new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.035, gapSize: 0.05, transparent: true, opacity: 0.38 }),
    );
    guides.frustumCulled = false;
    stack.add(guides);

    // Soft blue pool of light under the stack
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 5),
      new THREE.MeshBasicMaterial({
        map: glowTexture(), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    stack.add(pool);

    function updateGuides() {
      let k = 0;
      for (const [cx, cz] of corners) {
        for (let i = 0; i < layers.length - 1; i++) {
          const a = layers[i].group.position.y + t / 2;
          const b = layers[i + 1].group.position.y - t / 2;
          guidePos[k++] = cx; guidePos[k++] = a; guidePos[k++] = cz;
          guidePos[k++] = cx; guidePos[k++] = b; guidePos[k++] = cz;
        }
      }
      guideGeo.attributes.position.needsUpdate = true;
      guides.computeLineDistances();
    }

    // State
    const size = { w: 1, h: 1 };
    const layout = { x: 0, y: 0, scale: 1, fit: 0 };
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    let assemble = 0;
    let assembleS = 0;
    let focusY = null; // canvas y (px) the stacked product should centre on
    let band = null;   // phones: the canvas rows (px) left free above the headline, { top, bottom }
    const v = new THREE.Vector3();
    let introAt = reduced ? -Infinity : Infinity; // Infinity = waiting above the frame

    function resize(width, height) {
      size.w = width;
      size.h = height;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      bgMat.uniforms.uRes.value.set(width, height);
      bgTarget.setSize(Math.max(1, Math.round(width * BG_SCALE)), Math.max(1, Math.round(height * BG_SCALE)));

      const dist = camera.position.distanceTo(lookAt);
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
      const halfW = halfH * camera.aspect;
      if (width / height > 1.05) {
        layout.x = halfW * 0.3;
        layout.y = 0.24;
        layout.scale = Math.min(0.88, halfW / 4.4);
        layout.fit = 0.32;
      } else {
        // portrait. Tablets keep the headline on top, so the stack sits a little low; phones put
        // the headline and button at the bottom (styles.css) and the stack floats above them.
        layout.x = 0;
        layout.y = -halfH * 0.12;
        layout.scale = Math.min(0.85, halfW / 2.05);
        layout.fit = 0.05;
        if (width < 768 && band) fitBand(width, height, halfH);
      }
    }

    // Phones: pose the stack as it rests, spread out, and measure where it really lands on screen
    // (the camera looks down on it, so it sits lower and taller than its centre suggests), then
    // move and scale it until it fills the free band above the headline with a margin to spare
    const box = new THREE.Box3(), corner = new THREE.Vector3();
    function screenSpan() {
      const n = layers.length;
      layers.forEach((L, i) => { L.group.position.y = (i - (n - 1) / 2) * SPREAD; L.group.rotation.y = 0; });
      pool.position.y = layers[0].group.position.y - 0.35;
      stack.position.set(layout.x, layout.y, 0);
      stack.scale.setScalar(layout.scale);
      stack.rotation.set(0, -0.6, 0);
      stack.updateMatrixWorld(true);
      camera.clearViewOffset();
      camera.updateMatrixWorld();
      box.makeEmpty();
      layers.forEach((L) => box.expandByObject(L.group));
      let top = Infinity, bottom = -Infinity;
      for (let k = 0; k < 8; k++) {
        corner.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(camera);
        const y = (1 - corner.y) * 0.5 * size.h;
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      return { top, bottom };
    }
    function fitBand(width, height, halfH) {
      const room = (band.bottom - band.top) * 0.9, mid = (band.top + band.bottom) / 2;
      for (let pass = 0; pass < 3; pass++) {
        const span = screenSpan();
        const h = span.bottom - span.top;
        if (h > room) layout.scale *= room / h;
        const now = screenSpan();
        // screen pixels to world units at the stack's depth
        layout.y += ((now.top + now.bottom) / 2 - mid) * ((2 * halfH) / height);
      }
    }

    function update(time, dt) {
      const ease = Math.min(1, dt * 3);
      pointer.sx += (pointer.x - pointer.sx) * ease;
      pointer.sy += (pointer.y - pointer.sy) * ease;
      assembleS = assemble; // follows scroll exactly, no lag
      const open = 1 - assembleS;
      const motion = reduced ? 0 : 1;

      const breathe = Math.sin(time * 0.7) * 0.05 * motion;
      const spacing = THREE.MathUtils.lerp(SPREAD + breathe, STACKED, assembleS);
      const n = layers.length;
      layers.forEach((L, i) => {
        // quartic, not expo: expo starts so fast the first frames jump; this one glides in and settles
        const k = quartOut(Math.max(0, (time - introAt - L.delay) / INTRO));
        L.intro.y = L.drop * (1 - k);
        L.intro.r = 0.5 * (1 - k);
        const bob = Math.sin(time * 0.9 + L.phase) * 0.028 * open * motion;
        L.group.position.y = (i - (n - 1) / 2) * spacing + bob + L.intro.y;
        L.group.rotation.y = L.intro.r + Math.sin(time * 0.5 + L.phase) * 0.014 * open * motion;
      });
      pool.position.y = layers[0].group.position.y - 0.35;

      stack.position.set(layout.x * open, layout.y + assembleS * 0.15, 0);
      // Shrink as it assembles so the finished product fits the collapsed frame
      stack.scale.setScalar(layout.scale * (1 - assembleS * layout.fit));
      stack.rotation.set(
        pointer.sy * 0.07,
        -0.6 + pointer.sx * 0.2 + Math.sin(time * 0.15) * 0.06 * motion + assembleS * 0.18,
        0,
      );

      // Slide the picture (not the camera's angle) so the stacked product centres on focusY
      camera.clearViewOffset();
      if (focusY != null && assembleS > 0) {
        stack.updateMatrixWorld();
        v.setFromMatrixPosition(stack.matrixWorld).project(camera);
        const dy = (focusY - (1 - v.y) * 0.5 * size.h) * assembleS;
        camera.setViewOffset(size.w, size.h, 0, -dy, size.w, size.h);
      }

      updateGuides();
      bgMat.uniforms.uTime.value = time;
      bgMat.uniforms.uPointer.value.set(pointer.sx, pointer.sy);
      renderer.setRenderTarget(bgTarget);
      renderer.render(bgScene, bgCamera);
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }

    function project(object, local, out) {
      v.copy(local);
      object.localToWorld(v);
      v.project(camera);
      out.x = (v.x + 1) * 0.5 * size.w;
      out.y = (1 - v.y) * 0.5 * size.h;
      return out;
    }

    return {
      layers,
      camera,
      resize,
      update,
      project,
      /** Drop the layers in, starting at scene time `time`. */
      intro(time) { introAt = reduced ? -Infinity : time; },
      /** Skip the drop-in and show everything at rest. */
      settle() { introAt = -Infinity; },
      get pixelRatio() { return renderer.getPixelRatio(); },
      setPixelRatio(r) { renderer.setPixelRatio(r); resize(size.w, size.h); },
      setPointer(x, y) { pointer.x = x; pointer.y = y; },
      setAssemble(k) { assemble = k; },
      setFocus(y) { focusY = y; },
      setBand(top, bottom) { band = { top, bottom }; resize(size.w, size.h); },
      /** Do the expensive first-use work up front, before anyone sees the canvas: upload
          the textures and compile every shader (in parallel where the browser allows). */
      async warm() {
        Object.values(textures).forEach((tex) => renderer.initTexture(tex));
        renderer.compile(bgScene, bgCamera);
        if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
        else renderer.compile(scene, camera);
      },
      /** Redraw the layer screens, e.g. once the web font has loaded. */
      refreshTextures() { Object.values(textures).forEach((tex) => tex.userData.redraw?.()); },
      onContextLost(fn) { canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fn(); }); },
      /** Free GPU memory and the WebGL context. */
      dispose() {
        Object.values(textures).forEach((tex) => tex.dispose());
        bgTarget.dispose();
        scene.environment?.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      },
    };
  }

  Object.assign((window.HC = window.HC || {}), { DIMS, LAYERS, createStage });
})();
