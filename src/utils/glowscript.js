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

  // 학생/AI 코드 안에 "</script>"나 "<!--" 같은 문자열이 그대로 들어가면
  // 외부 HTML parser가 <script> 블록을 조기 종료시켜 iframe 전체가 깨진다.
  // JSON.stringify로 문자열 리터럴화한 뒤 "</" → "<\/" 로 이스케이프.
  const safeCodeLiteral = JSON.stringify(code ?? '')
    .replace(/<\//g, '<\\/')
    .replace(/<!--/g, '<\\!--')

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
    // 학생/AI 코드를 eval로 감싸 syntax error도 캐치 → iframe 자체가 깨지지 않게
    try {
        eval(${safeCodeLiteral});
    } catch (e) {
        console.error('[VPython] code error:', e);
        try {
            scene.append_to_caption('<br><span style="color:#ff6b6b;font-family:monospace;font-size:0.85em">⚠ 코드 오류: ' + (e && e.message ? e.message : e) + '</span>');
        } catch (_) {}
    }
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
 * GlowScript 로딩 큐
 * 갤러리에서 한 화면에 보이는 VPython iframe이 동시에 외부 CDN(jQuery·glow.js)을
 * 요청하면 브라우저 동시 연결 한도(~6)를 넘어 일부 iframe이 영영 로드되지 못한다.
 * 한 번에 MAX 개만 시작하고, 시작 간격도 최소 INTERVAL ms 유지.
 * 첫 카드들이 CDN 캐시를 채우면 이후 카드들은 cache hit으로 빨라진다.
 */
const _glowQueue = []
let _activeLoads = 0
let _lastStartAt = 0
const _MAX_CONCURRENT = 2
const _MIN_INTERVAL_MS = 350
const _LOAD_SLOT_MS = 1500 // 한 카드가 슬롯을 점유하는 시간(추정)

function _pumpGlowQueue() {
  while (_activeLoads < _MAX_CONCURRENT && _glowQueue.length > 0) {
    const now = Date.now()
    const delay = Math.max(0, _lastStartAt + _MIN_INTERVAL_MS - now)
    _lastStartAt = now + delay
    const job = _glowQueue.shift()
    _activeLoads++
    setTimeout(() => {
      try { job() } catch (_) {}
      setTimeout(() => {
        _activeLoads--
        _pumpGlowQueue()
      }, _LOAD_SLOT_MS)
    }, delay)
  }
}

export function scheduleGlowScriptLoad(job) {
  _glowQueue.push(job)
  _pumpGlowQueue()
}

/**
 * 기존 Blob URL 해제 (메모리 누수 방지)
 */
export function revokeBlobURL(url) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
