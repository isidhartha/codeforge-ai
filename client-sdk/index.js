"use strict";
class CodeForgeClient {
  constructor(o={}) { this.host=o.host||"http://localhost:8000"; this.timeout=o.timeout||60000; }
  async _req(m,p,b) {
    const c=new AbortController(),t=setTimeout(()=>c.abort(),this.timeout);
    try {
      const r=await fetch(`${this.host}${p}`,{method:m,headers:{"Content-Type":"application/json"},body:b?JSON.stringify(b):undefined,signal:c.signal});
      if(!r.ok) throw new Error(`CodeForge API ${r.status}`);
      return r.json();
    } finally { clearTimeout(t); }
  }
  generate(spec,language="python") { return this._req("POST","/api/v1/ai/generate",{spec,language}); }
  explain(code,context="") { return this._req("POST","/api/v1/ai/explain",{code,context}); }
  debug(code,error) { return this._req("POST","/api/v1/ai/debug",{code,error}); }
  chat(message,history=[]) { return this._req("POST","/api/v1/ai/chat",{message,history}); }
  runCommand(command) { return this._req("POST","/api/v1/terminal/run",{command}); }
  nlToCommand(description) { return this._req("POST","/api/v1/terminal/nl",{description}); }
  indexProject(path) { return this._req("POST","/api/v1/project/index",{path}); }
  search(query,topK=5) { return this._req("POST","/api/v1/project/search",{query,top_k:topK}); }
  health() { return this._req("GET","/health",null); }
}
module.exports=CodeForgeClient;
