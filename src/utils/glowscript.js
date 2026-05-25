/**
 * GlowScript VPython 3.2 HTML 빌더
 * Blob URL iframe으로 렌더링
 *
 * options:
 *   isoAngle  — true면 비스듬한 입체 각도로 시작 (기본 true)
 *   autoRotate — true면 카메라가 천천히 회전하는 setInterval 루프 추가 (기본 false)
 */

export function buildGlowScriptHTML(code, options = {}) {
  const { isoAngle = true, autoRotate = false } = options

  const angleSetup = isoAngle
    ? 'scene.forward = vec(-0.55, -0.45, -0.8);\n    scene.up = vec(0,1,0);'
    : ''

  // 학생 코드 다음에 자동 회전 루프 — scene 클로저 안에서 setInterval로 forward 갱신
  const rotateLoop = autoRotate
    ? `
    ;(function(){
        var __t = Math.PI * 0.7;
        setInterval(function(){
            __t += 0.006;
            if (scene && scene.forward) {
                scene.forward = vec(Math.sin(__t), -0.4, Math.cos(__t));
            }
        }, 30);
    })();`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  .glowscript { width: 100% !important; padding: 0 !important; margin: 0 !important; }
  div > canvas { display: block; cursor: grab; }
  div > canvas:active { cursor: grabbing; }
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
    scene.userspin = true;
    scene.userzoom = true;
    scene.userpan = true;
    ${angleSetup}
    ${code}
    ${rotateLoop}
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
