/**
 * GlowScript VPython 3.2 HTML 빌더
 * Blob URL iframe으로 렌더링
 *
 * 회전 컨트롤:
 *   - GlowScript 기본: 우클릭 드래그 또는 Shift+드래그 (scene.userspin)
 *   - 추가 시뮬레이션: 좌클릭 드래그를 우클릭 이벤트로 jQuery trigger 해서
 *     학생이 그냥 좌클릭+드래그해도 회전이 되도록 시도
 *   - 휠 줌: scene.userzoom 기본
 *   - autoRotate: 옵션 (기본 OFF)
 */

export function buildGlowScriptHTML(code, options = {}) {
  const { autoRotate = false } = options

  const controlScript = `
try {
    (function(){
        // GlowScript 기본 컨트롤 유지 — 우클릭/Shift+드래그 회전, 휠 줌
        try { scene.userspin = true; } catch (e) {}
        try { scene.userpan = false; } catch (e) {}
        try { scene.userzoom = true; } catch (e) {}

        // 시작 시점에 비스듬한 입체 각도로 보여줌
        try {
            scene.forward = vec(-0.55, -0.45, -0.7);
            scene.up = vec(0, 1, 0);
        } catch (e) {}

        // ── 좌클릭 → 우클릭 시뮬레이션 ────────────────────────────────────
        // GlowScript는 우클릭 드래그를 회전으로 처리한다.
        // 학생이 그냥 좌클릭+드래그해도 회전되도록, 좌클릭 이벤트를
        // 우클릭 이벤트로 jQuery 트리거해서 GlowScript에 전달한다.
        var leftDown = false;
        var lastDragAt = 0;

        function makeEvent(type, e) {
            return $.Event(type, {
                which: 3, button: 2, buttons: 2,
                clientX: e.clientX, clientY: e.clientY,
                pageX:   e.pageX,   pageY:   e.pageY,
                screenX: e.screenX, screenY: e.screenY,
                ctrlKey: e.ctrlKey, shiftKey: e.shiftKey,
                altKey:  e.altKey,  metaKey: e.metaKey,
            });
        }

        function bindCanvas(tries) {
            tries = tries || 0;
            var canvasEl = document.querySelector('canvas');
            if (!canvasEl) {
                if (tries > 80) return;
                setTimeout(function(){ bindCanvas(tries + 1); }, 100);
                return;
            }
            var $c = $(canvasEl);
            canvasEl.style.cursor = 'grab';

            // 좌클릭 → 우클릭 mousedown 으로 변환
            canvasEl.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return;          // 좌클릭만 가로채기
                e.preventDefault();
                e.stopPropagation();
                leftDown = true;
                lastDragAt = Date.now();
                canvasEl.style.cursor = 'grabbing';
                $c.trigger(makeEvent('mousedown', e));
            }, true);

            // 좌클릭 상태에서의 mousemove → 우클릭 mousemove
            document.addEventListener('mousemove', function(e) {
                if (!leftDown) return;
                lastDragAt = Date.now();
                $c.trigger(makeEvent('mousemove', e));
            }, true);

            // mouseup → 우클릭 mouseup + 좌클릭 잠금 해제
            document.addEventListener('mouseup', function(e) {
                if (!leftDown) return;
                leftDown = false;
                canvasEl.style.cursor = 'grab';
                $c.trigger(makeEvent('mouseup', e));
            }, true);
        }
        setTimeout(function(){ bindCanvas(0); }, 80);

        // 우클릭 컨텍스트 메뉴 차단 (학생이 우클릭으로 직접 돌리는 경우 메뉴 안 뜨게)
        document.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        // 자동 회전 (옵션)
        if (${autoRotate ? 'true' : 'false'}) {
            var t = 0;
            setInterval(function() {
                if (leftDown) return;
                if (Date.now() - lastDragAt < 2000) return;
                t += 0.008;
                try {
                    scene.forward = vec(Math.sin(t)*0.8, -0.4, -Math.cos(t)*0.8);
                } catch (e) {}
            }, 30);
        }
    })();
} catch (mainErr) {
    // 컨트롤 스크립트 실패해도 GlowScript 기본 우클릭은 살아 있음
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
<script type="text/javascript">
// 학생/AI 코드가 부모 페이지(갤러리)에 모달을 띄우지 못하도록 무력화
try { window.alert = function(){}; } catch (e) {}
try { window.confirm = function(){ return false; }; } catch (e) {}
try { window.prompt = function(){ return null; }; } catch (e) {}
</script>
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
