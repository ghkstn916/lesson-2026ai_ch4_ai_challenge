/**
 * GlowScript VPython 3.2 HTML 빌더
 * Blob URL iframe으로 렌더링
 *
 * 학생 친화 컨트롤:
 *   - 좌클릭 + 드래그 → 카메라 회전 (azimuth + elevation)
 *   - 마우스 휠 → 줌
 *   - autoRotate: true면 마우스 비조작 시 천천히 자동 회전 (드래그 후 2초 정지)
 *
 * 구현 노트:
 *   GlowScript 기본 회전은 우클릭/Shift+드래그라 학생이 헷갈림.
 *   scene.userspin/pan을 끄고 native addEventListener(capture:true)로
 *   GlowScript 자체 핸들러보다 먼저 마우스 이벤트를 잡아서 카메라를 직접 제어.
 */

export function buildGlowScriptHTML(code, options = {}) {
  const { autoRotate = false } = options

  // 학생 코드 다음에 삽입할 카메라 컨트롤 스크립트.
  // scene은 __main__ 클로저의 변수이므로 같은 함수 안에서 접근 가능.
  const controlScript = `
try {
    (function(){
        var azimuth = Math.PI * 0.7;
        var elevation = 0.45;
        var distance = (scene && scene.range) ? Math.max(8, scene.range * 2.2) : 14;
        var dragging = false;
        var lastX = 0, lastY = 0;
        var lastDragAt = 0;
        var autoRotateOn = ${autoRotate ? 'true' : 'false'};

        function applyAngle() {
            if (!scene) return;
            var ce = Math.cos(elevation);
            var px = Math.sin(azimuth) * ce * distance;
            var py = Math.sin(elevation) * distance;
            var pz = Math.cos(azimuth) * ce * distance;
            try {
                if (scene.camera) {
                    scene.camera.pos = vec(px, py, pz);
                    scene.camera.axis = vec(-px, -py, -pz);
                } else {
                    scene.forward = vec(-Math.sin(azimuth)*ce, -Math.sin(elevation), -Math.cos(azimuth)*ce);
                }
            } catch (err) {
                try {
                    scene.forward = vec(-Math.sin(azimuth)*ce, -Math.sin(elevation), -Math.cos(azimuth)*ce);
                } catch (e2) {}
            }
        }

        // GlowScript 기본 회전·팬 비활성화 — 우리 핸들러가 직접 처리
        try { scene.userspin = false; } catch (e) {}
        try { scene.userpan = false; } catch (e) {}
        try { scene.userzoom = false; } catch (e) {} // 휠도 우리가 처리

        applyAngle();

        function onDown(e) {
            if (e.button !== 0 && e.button !== undefined) return; // 좌클릭만
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            lastDragAt = Date.now();
            var c = document.querySelector('canvas');
            if (c) c.style.cursor = 'grabbing';
            e.preventDefault();
            e.stopPropagation();
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
        }
        function onUp() {
            if (!dragging) return;
            dragging = false;
            var c = document.querySelector('canvas');
            if (c) c.style.cursor = 'grab';
        }
        function onWheel(e) {
            distance = Math.max(3, Math.min(60, distance * (1 + e.deltaY * 0.001)));
            applyAngle();
            e.preventDefault();
        }

        function bindCanvas(tries) {
            tries = tries || 0;
            var canvasEl = document.querySelector('canvas');
            if (!canvasEl) {
                if (tries > 80) return; // ~8초 후 포기
                setTimeout(function(){ bindCanvas(tries + 1); }, 100);
                return;
            }
            canvasEl.style.cursor = 'grab';

            // capture 단계에서 잡아서 GlowScript 핸들러보다 먼저 실행
            canvasEl.addEventListener('mousedown', onDown, true);
            canvasEl.addEventListener('wheel', onWheel, { passive: false, capture: true });
        }
        // GlowScript canvas가 만들어지는 시점이 비동기일 수 있어 약간 지연 후 폴링
        setTimeout(function(){ bindCanvas(0); }, 50);

        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup', onUp, true);

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
    console.error('camera-control error', mainErr);
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
</style>
</head>
<body>
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
