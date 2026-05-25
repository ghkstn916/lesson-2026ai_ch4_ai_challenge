/**
 * GlowScript VPython 3.2 HTML 빌더
 * Blob URL iframe으로 렌더링
 *
 * 학생 친화 컨트롤:
 *   - 좌클릭 + 드래그 → 카메라 회전 (azimuth + elevation)
 *   - 마우스 휠 → 줌
 *   - autoRotate: true면 마우스 비조작 시 천천히 자동 회전 (드래그 후 2초 정지)
 *
 * GlowScript 기본 컨트롤(Shift/우클릭 드래그)이 학생에게 직관적이지 않아
 * scene.userspin / userpan은 끄고 직접 핸들러를 부착한다.
 */

export function buildGlowScriptHTML(code, options = {}) {
  const { autoRotate = false } = options

  const controlScript = `
;(function(){
    var azimuth = Math.PI * 0.7;
    var elevation = 0.45;
    var dragging = false;
    var lastX = 0, lastY = 0;
    var lastDragAt = 0;
    var autoRotate = ${autoRotate ? 'true' : 'false'};

    function applyAngle() {
        if (!scene) return;
        var ce = Math.cos(elevation);
        scene.forward = vec(
            Math.sin(azimuth) * ce,
            -Math.sin(elevation),
            Math.cos(azimuth) * ce
        );
    }
    applyAngle();

    // GlowScript 자체 회전·팬은 끄고 우리 핸들러가 잡는다. 줌(휠)만 유지.
    scene.userspin = false;
    scene.userpan = false;
    scene.userzoom = true;

    function bindCanvas() {
        var $c = $('canvas').first();
        if ($c.length === 0) { setTimeout(bindCanvas, 100); return; }
        $c.css('cursor', 'grab').on('mousedown', function(e) {
            if (e.button !== 0) return;          // 좌클릭만
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            lastDragAt = Date.now();
            $c.css('cursor', 'grabbing');
            e.preventDefault();
        });
    }
    setTimeout(bindCanvas, 50);

    $(document).on('mousemove', function(e) {
        if (!dragging) return;
        var dx = e.clientX - lastX;
        var dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        // 좌우 드래그 → azimuth, 상하 드래그 → elevation
        azimuth -= dx * 0.012;
        elevation = Math.max(-1.4, Math.min(1.4, elevation + dy * 0.012));
        lastDragAt = Date.now();
        applyAngle();
    });
    $(document).on('mouseup mouseleave', function() {
        if (dragging) {
            dragging = false;
            $('canvas').first().css('cursor', 'grab');
        }
    });

    // 자동 회전 — 드래그 후 2초 동안은 잠시 멈춤
    if (autoRotate) {
        setInterval(function() {
            if (dragging) return;
            if (Date.now() - lastDragAt < 2000) return;
            azimuth += 0.006;
            applyAngle();
        }, 30);
    }
})();
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
