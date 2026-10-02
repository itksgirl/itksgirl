const button=document.getElementById('install-ai');
const standalone=window.matchMedia('(display-mode: standalone)');
let deferred=null,dialog=null;
function installed(){return standalone.matches||navigator.standalone===true;}
function update(){button.hidden=installed();}
update();standalone.addEventListener('change',update);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;});
window.addEventListener('appinstalled',()=>{deferred=null;button.hidden=true;dialog?.close();});
if('serviceWorker' in navigator){navigator.serviceWorker.register('/IA/ia-sw.js',{scope:'/IA/'}).catch(()=>{/* The manual browser installation path remains available. */});}
button.addEventListener('click',()=>{
  if(dialog?.open)return;
  dialog=document.createElement('dialog');dialog.className='ai-install-dialog';dialog.setAttribute('aria-labelledby','install-title');
  const heading=document.createElement('h2');heading.id='install-title';heading.textContent='Instalar a ITKs AI';
  const description=document.createElement('p');description.textContent='Tenha a ITKs AI em uma janela própria, com ícone no computador. A instalação é feita pelo navegador e o chat precisa de internet.';
  const help=document.createElement('p');help.setAttribute('role','status');help.textContent='No Windows, use o Microsoft Edge ou Google Chrome. Se a instalação não aparecer, abra o menu ⋯ do Edge e procure Aplicativos → Instalar este site como aplicativo. O nome pode variar conforme a versão.';
  const install=document.createElement('button');install.type='button';install.className='install-confirm';install.textContent='Instalar agora';install.hidden=!deferred;
  install.onclick=async()=>{const prompt=deferred;if(!prompt)return;deferred=null;install.disabled=true;try{await prompt.prompt();const choice=await prompt.userChoice;help.textContent=choice.outcome==='accepted'?'Pedido aceito. Aguarde a conclusão da instalação pelo navegador.':'Instalação cancelada. Você pode continuar usando o site normalmente.';}catch{help.textContent='Use a opção de instalar aplicativo no menu do navegador.';}finally{install.hidden=true;}};
  const close=document.createElement('button');close.type='button';close.textContent='Fechar';close.onclick=()=>dialog.close();
  dialog.append(heading,description,help,install,close);document.body.append(dialog);
  dialog.addEventListener('close',()=>{dialog.remove();dialog=null;},{once:true});dialog.showModal();(deferred?install:close).focus();
});
