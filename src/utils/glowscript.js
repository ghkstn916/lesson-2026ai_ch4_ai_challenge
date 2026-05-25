/**
 * GlowScript VPython 3.2 HTML 빌더
 * Blob URL iframe으로 렌더링
 *
 * 컨트롤 (의도):
 *   - 좌클릭 + 드래그 → 카메라 회전
 *   - 마우스 휠 → 줌
 *   - 백업: GlowScript 기본 우클릭/Shift+드래그도 활성화 유지
 *
 * 디버그: 우상단 작은 박스에 현재 상태 표시 (캔버스 발견·마우스다운 등)
 */

export function buildGlowScriptHTML(code, options = {}) {
  const { autoRotate = false } = options

  const controlScript = `
try {
    (function(){
        // ── 디버그 표시 ────────────────────────────────────────────────────
        function dbg(msg) {
            var d = document.getElementById('__dbg__');
            if (d) d.textContent = msg;
        }

        // ── 카메라 상태 ────────────────────────────────────────────────────
        var azimuth = Math.PI * 0.7;
        var elevation = 0.45;
        var distance = 14;
        var dragging = false;
        var lastX = 0, lastY = 0;
        var lastDragAt = 0;
        var autoRotateOn = ${autoRotate ? 'true' : 'false'};
        var rotationCount = 0;

        function applyAngle() {
            if (typeof scene === 'undefined' || !scene) { dbg('no scene'); return; }
            var ce = Math.cos(elevation);
            var fx = -Math.sin(azimuth) * ce;
            var fy = -Math.sin(elevation);
            var fz = -Math.cos(azimuth) * ce;
            try {
                scene.forward = vec(fx, fy, fz);
                rotationCount++;
            } catch (err) {
                dbg('forward err: ' + err.message);
            }
        }

        // GlowScript 기본 회전은 백업으로 켜둠 (우리 좌클릭이 안 잡혀도 우클릭/Shift는 작동)
        try { scene.userspin = true; } catch (e) {}
        try { scene.userpan = false; } catch (e) {}
        try { scene.userzoom = true; } catch (e) {}

        applyAngle();

        // ── 마우스 핸들러 (좌클릭) ─────────────────────────────────────────
        function onDown(e) {
            dbg('down b=' + e.button);
            if (e.button !== 0 && e.button !== undefined) return;
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            lastDragAt = Date.now();
            var c = document.querySelector('canvas');
            if (c) c.style.cursor = 'grabbing';
            e.preventDefault();
            // stopPropagation은 안 함 — GlowScript도 자기 이벤트 받게
        }
        function onMove(e) {
            if (!dragging) return;
            var dx = e.clientX - lastX;
            var dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            azimuth -= dx * 0.012;
            elevation = Math.max(-1.4, Math.min(1.4, elevation + dy * 0.012));
            lastDragAt = Date.now();
            applyAngle();
            dbg('drag rot=' + rotationCount + ' az=' + azimuth.toFixed(2));
        }
        function onUp() {
            if (!dragging) return;
            dragging = false;
            var c = document.querySelector('canvas');
            if (c) c.style.cursor = 'grab';
            dbg('up rot=' + rotationCount);
        }
        function onWheel(e) {
            distance = Math.max(3, Math.min(60, distance * (1 + e.deltaY * 0.001)));
            applyAngle();
            e.preventDefault();
            dbg('wheel d=' + distance.toFixed(1));
        }

        function bindCanvas(tries) {
            tries = tries || 0;
            var canvasEl = document.querySelector('canvas');
            if (!canvasEl) {
                dbg('no canvas yet ' + tries);
                if (tries > 80) { dbg('canvas not found'); return; }
                setTimeout(function(){ bindCanvas(tries + 1); }, 100);
                return;
            }
            dbg('canvas found');
            canvasEl.style.cursor = 'grab';
            // capture 모드로 GlowScript 핸들러보다 먼저 잡기
            canvasEl.addEventListener('mousedown', onDown, true);
            canvasEl.addEventListener('wheel', onWheel, { passive: false, capture: true });
            // 일부 환경에서 mousedown 대신 pointerdown만 발생할 수도
            canvasEl.addEventListener('pointerdown', onDown, true);
            dbg('listeners bound');
        }
        setTimeout(function(){ bindCanvas(0); }, 50);

        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup', onUp, true);
        document.addEventListener('pointermove', onMove, true);
        document.addEventListener('pointerup', onUp, true);

        if (autoRotateOn) {
            setInterval(function() {
                if (dragging) return;
                if (Date.now() - lastDragAt < 2000) return;
                azimuth += 0.008;
                applyAngle();
            }, 30);
        }
    })();
} catch (mainErr) {
    var dEl = document.getElementById('__dbg__');
    if (dEl) dEl.textContent = 'main err: ' + mainErr.message;
}
`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; user-select: none; }
  .glowscript { width: 100% !important; padding: 0 !important; margin: 0 !important; }
  div > canvas { display: block; cursor: grab; }
  #__dbg__ {
    position: fixed;
    top: 4px;
    right: 4px;
    font-size: 10px;
    color: #fff;
    background: rgba(0,0,0,0.55);
    padding: 2px 6px;
    border-radius: 3px;
    z-index: 9999;
    font-family: monospace;
    pointer-events: none;
    max-width: 60%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
</head>
<body>
<div id="__dbg__">loading...</div>
<div id="glowscript" class="glowscript">
<link type="text/css" href="https://www.glowscript.org/css/redmond/2.1/jquery-ui.custom.css" rel="stylesheet" />
<link type="text/css" href="https://www.glowscript.org/css/ide.css" rel="stylesheet" />
<script type="text/javascript" src="https://www.glowscript.org/lib/jquery/2.1/jquery.min.js"></script>
<script type="text/javascript" src="https://www.glowscript.org/lib/jquery/2.1/jquery-ui.custom.min.js"></script>
<script type="text/javascript" src="https://www.glowscript.org/package/glow.3.2.min.js"></script>
<script type="text/javascript" src="https://www.glowscript.org/package/RSrun.3.2.min.js"></script>
<script type="text/javascript"><!--//--><![CDATA[//><!--
;(function() {
function __main__() {
    var scene = canvas();
    scene.width = window.innerWidth;
    scene.height = window.innerHeight;
    document.getElementById('__dbg__').textContent = 'scene created';
    ${code}
    ${controlScript}
}
;$(function(){ window.__context = { glowscript_container: $("#glowscript").removeAttr("id") }; __main__() })})()
//--><!]]></script>
</div>
</body>
</html>`
}

/**
 * 코드를 Blob URL로 변환해서 반환
 */
export function createBlobURL(code, options) {
  const html = buildGlowScriptHTML(code, options)
  const blob = new Blob([html], { type: 'text/html' })
  return URL.createObjectURL(blob)
}

/**
 * 기존 Blob URL 해제 (메모리 누수 방지)
 */
export function revokeBlobURL(url) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
