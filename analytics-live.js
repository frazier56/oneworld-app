(() => {
  if (location.pathname.startsWith("/admin") || navigator.doNotTrack === "1" || navigator.globalPrivacyControl) return;
  const endpoint = "https://wseblryyqxawvbjmylbo.supabase.co/functions/v1/track-oneworld-event";
  const visitorKey = "ow_analytics_visitor_v1", sessionKey = "ow_analytics_session_v1";
  const uuid = () => { try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; } };
  const getId = (store, key) => { try { let value=store.getItem(key); if(value&&value.length>=16)return value; value=uuid(); store.setItem(key,value); return value; } catch { return uuid(); } };
  const safePath = path => (path||"/").split("/").map(segment => { if(!segment)return segment; let value=segment; try{value=decodeURIComponent(segment)}catch{} if(/^\d+$/.test(value)||/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value))return ":id"; if(value.includes("@"))return ":email"; if(value.length>=24&&/^[a-z0-9_-]+$/i.test(value))return ":token"; return value.slice(0,80); }).join("/").slice(0,300)||"/";
  const product = path => path.startsWith("/events")?"oneevent":path.startsWith("/jobs")?"onejob":path.startsWith("/rentals")||path.startsWith("/sale")?"onehome":path.startsWith("/social")?"onesocial":path.startsWith("/score")?"onescore":"oneworld";
  let last="";
  const send = () => { if(location.pathname.startsWith("/admin"))return; const page_path=safePath(location.pathname), key=`${product(page_path)}:${page_path}`; if(key===last)return; last=key; let referrer=""; try{const u=new URL(document.referrer);referrer=u.origin===location.origin?`${u.origin}${safePath(u.pathname)}`:u.origin}catch{} fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({event_name:"page_view",event_category:"navigation",product:product(page_path),page_path,referrer,visitor_id:getId(localStorage,visitorKey),session_id:getId(sessionStorage,sessionKey),screen_width:screen.width||0,screen_height:screen.height||0}),keepalive:true}).catch(()=>{}); };
  const push=history.pushState, replace=history.replaceState; history.pushState=function(...args){push.apply(this,args);queueMicrotask(send)}; history.replaceState=function(...args){replace.apply(this,args);queueMicrotask(send)}; addEventListener("popstate",send); send();
})();
