/**
 * 지도 화면 HTML (Leaflet + OpenStreetMap 지도 — 둘 다 무료, 키 필요 없음)
 *   웹은 iframe, 휴대폰은 WebView 안에서 같은 HTML 을 띄운다 (components/LeafletMap)
 *   지도 → 앱으로 보내는 말: {type: "open", atcId} 물건 열기 / {type: "list", keyword} 목록 / {type: "url", url} 길찾기
 *
 *   browse: 보이는 범위가 바뀔 때마다 우리 API(/items/map)를 직접 불러 핀을 다시 그린다 (같은 자리는 숫자 핀 하나)
 *   path:   한 물건의 이동 경로 — ① 처음 발견한 곳 → ② 옮긴 곳 → ③ 지금 있는 곳, 점선 화살표 + 움직이는 점
 */
import type { PathPoint } from "./types";

type Common = { me?: { lat: number; lng: number } | null };
export type BrowseOpts = Common & { api: string; center: { lat: number; lng: number }; zoom?: number; days: number; category?: string };
export type PathOpts = Common & { points: PathPoint[]; name: string };

const HEAD = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
  .pin{display:flex;align-items:center;justify-content:center;border-radius:999px;color:#fff;font-weight:800;font-size:13px;
       border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)}
  .pin.police{background:#2457D6}.pin.user{background:#E08600}
  .me{width:16px;height:16px;border-radius:50%;background:#1E7A44;border:3px solid #fff;box-shadow:0 0 0 6px rgba(30,122,68,.25)}
  .pop h4{margin:0 0 4px;font-size:15px}.pop .sub{color:#646B7A;font-size:12px;margin-bottom:6px}
  .pop a{display:block;padding:6px 0;border-top:1px solid #eee;color:#16181D;text-decoration:none;font-size:14px}
  .pop a b{color:#2457D6}.pop .btns{display:flex;gap:6px;margin-top:8px}
  .pop button{flex:1;border:0;border-radius:8px;padding:8px 6px;font-weight:700;font-size:13px;background:#EEF4FF;color:#1C46B0}
  .pop button.go{background:#2457D6;color:#fff}
  #msg{position:absolute;z-index:999;left:50%;top:10px;transform:translateX(-50%);background:rgba(22,24,29,.85);color:#fff;
       padding:7px 12px;border-radius:999px;font-size:13px;display:none;white-space:nowrap}
  .num{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;color:#fff;font-weight:800;
       border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);font-size:14px}
  .num.found{background:#646B7A}.num.moved{background:#E08600}.num.now{background:#2457D6;width:34px;height:34px;font-size:16px}
  .walker{width:12px;height:12px;border-radius:50%;background:#2457D6;border:2px solid #fff;box-shadow:0 0 0 4px rgba(36,87,214,.3)}
  .leaflet-popup-content{margin:12px 14px}
</style></head><body><div id="map"></div><div id="msg"></div><script>
function send(o){var s=JSON.stringify(o);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else window.parent.postMessage(s,"*")}
function esc(t){return String(t==null?"":t).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function kakao(n,la,ln){return "https://map.kakao.com/link/to/"+encodeURIComponent(String(n).replace(/,/g," "))+","+la+","+ln}
function msg(t){var m=document.getElementById("msg");m.textContent=t||"";m.style.display=t?"block":"none"}
var map=L.map("map",{zoomControl:true});
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap"}).addTo(map);
function addMe(me){if(me)L.marker([me.lat,me.lng],{icon:L.divIcon({className:"",html:'<div class="me"></div>',iconSize:[22,22]}),zIndexOffset:1000}).addTo(map).bindTooltip("내 위치")}
`;

const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

export function browseHtml(o: BrowseOpts): string {
  return `${HEAD}
var C=${json(o)};
map.setView([C.center.lat,C.center.lng],C.zoom||14);addMe(C.me);
var layer=L.layerGroup().addTo(map),timer=null,seq=0;
function load(){
  var b=map.getBounds(),s=++seq;
  if(b.getNorth()-b.getSouth()>6||b.getEast()-b.getWest()>8){layer.clearLayers();msg("지도를 조금 더 확대해 주세요");return}
  msg("불러오는 중…");
  var q="south="+b.getSouth()+"&west="+b.getWest()+"&north="+b.getNorth()+"&east="+b.getEast()+"&days="+C.days+(C.category?"&category="+encodeURIComponent(C.category):"");
  fetch(C.api+"/items/map?"+q).then(function(r){return r.json()}).then(function(d){
    if(s!==seq)return;layer.clearLayers();
    var ps=d.places||[];msg(d.error?d.error:ps.length?"":"이 근처에 최근 "+C.days+"일 습득물이 없어요");
    ps.forEach(function(p){
      var size=p.count>=100?46:p.count>=10?38:30;
      var m=L.marker([p.lat,p.lng],{icon:L.divIcon({className:"",html:'<div class="pin '+(p.user?"user":"police")+'" style="width:'+size+'px;height:'+size+'px">'+p.count+'</div>',iconSize:[size,size]})});
      var h='<div class="pop"><h4>'+esc(p.place)+'</h4><div class="sub">습득물 '+p.count+'개 · 최근 '+esc(p.latest)+'</div>';
      p.items.forEach(function(it){h+='<a href="#" data-open="'+esc(it.atcId)+'"><b>'+esc((it.color?it.color+" ":"")+it.name)+'</b> · '+esc(it.date)+'</a>'});
      h+='<div class="btns">'+(p.count>p.items.length?'<button data-list="'+esc(p.place)+'">전체 '+p.count+'개 보기</button>':'')+'<button class="go" data-url="'+esc(kakao(p.place,p.lat,p.lng))+'">길찾기</button></div></div>';
      m.bindPopup(h,{maxWidth:260});layer.addLayer(m);
    });
  }).catch(function(){if(s===seq)msg("불러오지 못했어요. 인터넷을 확인해 주세요")});
}
map.on("moveend",function(){clearTimeout(timer);timer=setTimeout(load,350)});load();
setTimeout(function(){map.invalidateSize()},400);
document.addEventListener("click",function(e){var t=e.target.closest("[data-open],[data-list],[data-url]");if(!t)return;e.preventDefault();
  if(t.dataset.open)send({type:"open",atcId:t.dataset.open});else if(t.dataset.list)send({type:"list",keyword:t.dataset.list});else send({type:"url",url:t.dataset.url})});
</script></body></html>`;
}

export function pathHtml(o: PathOpts): string {
  return `${HEAD}
var C=${json(o)},P=C.points;addMe(C.me);
var KIND={found:"처음 발견한 곳",moved:"옮긴 곳",now:"지금 있는 곳"};
var ll=P.map(function(p){return [p.lat,p.lng]});
if(ll.length>1){
  L.polyline(ll,{color:"#2457D6",weight:5,opacity:.85,dashArray:"10 10"}).addTo(map);
  for(var i=0;i<ll.length-1;i++){ // 구간마다 가운데에 화살표
    var dx=(ll[i+1][1]-ll[i][1])*Math.cos(ll[i][0]*Math.PI/180),dy=ll[i+1][0]-ll[i][0];
    var ang=Math.atan2(-dy,dx)*180/Math.PI,mid=[(ll[i][0]+ll[i+1][0])/2,(ll[i][1]+ll[i+1][1])/2];
    L.marker(mid,{interactive:false,icon:L.divIcon({className:"",html:'<div style="transform:rotate('+ang+'deg);color:#2457D6;font-size:22px;font-weight:900;line-height:22px">➤</div>',iconSize:[22,22]})}).addTo(map);
  }
  // 경로를 따라 움직이는 점 (물건이 이동한 길)
  var w=L.marker(ll[0],{interactive:false,icon:L.divIcon({className:"",html:'<div class="walker"></div>',iconSize:[16,16]})}).addTo(map),t=0;
  setInterval(function(){t=(t+0.006)%1;var seg=t*(ll.length-1),k=Math.min(Math.floor(seg),ll.length-2),f=seg-k;
    w.setLatLng([ll[k][0]+(ll[k+1][0]-ll[k][0])*f,ll[k][1]+(ll[k+1][1]-ll[k][1])*f])},40);
}
P.forEach(function(p,i){
  var m=L.marker([p.lat,p.lng],{zIndexOffset:p.kind==="now"?500:0,icon:L.divIcon({className:"",html:'<div class="num '+p.kind+'">'+(i+1)+'</div>',iconSize:p.kind==="now"?[40,40]:[34,34]})}).addTo(map);
  var h='<div class="pop"><h4>'+(i+1)+'. '+KIND[p.kind]+'</h4><div class="sub">'+esc(p.label)+(p.at?' · '+esc(String(p.at).slice(0,10)):'')+'</div>'+
        (p.kind==="now"?'<div class="btns"><button class="go" data-url="'+esc(kakao(p.label,p.lat,p.lng))+'">여기로 길찾기</button></div>':'')+'</div>';
  m.bindPopup(h,{maxWidth:240});if(p.kind==="now"&&P.length===1)m.openPopup();
});
var all=ll.slice();if(C.me)all.push([C.me.lat,C.me.lng]);
function fit(){map.invalidateSize();if(all.length>1)map.fitBounds(all,{padding:[40,40],maxZoom:17});else if(all.length)map.setView(all[0],16)}
fit();setTimeout(fit,400); // iframe·WebView 크기가 늦게 정해질 때 다시 맞춤
document.addEventListener("click",function(e){var t=e.target.closest("[data-url]");if(!t)return;e.preventDefault();send({type:"url",url:t.dataset.url})});
</script></body></html>`;
}
