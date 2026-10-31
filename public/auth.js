const form=document.querySelector("form");
form?.addEventListener("submit",async e=>{
 e.preventDefault();const msg=document.getElementById("message");msg.textContent="Please wait…";msg.className="message";
 const data=Object.fromEntries(new FormData(form).entries());
 const endpoint=form.id==="signupForm"?"/api/signup":"/api/login";
 try{const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const out=await r.json();if(!r.ok)throw new Error(out.error||"Request failed");location.href="dashboard.html";}
 catch(err){msg.textContent=err.message;msg.className="message error";}
});