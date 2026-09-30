export function createAccount({supabase,notify,closeSidebar}) {
  let user=null;
  const defaults={font:'normal',enter:true};
  let prefs={...defaults};
  const dialog=document.createElement('dialog');dialog.className='account-dialog';document.body.append(dialog);
  const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const key=()=>`itks-preferences:${user?.id||'guest'}`;
  function apply(){document.documentElement.dataset.chatFont=prefs.font;document.documentElement.dataset.enterSend=String(prefs.enter);}
  function persist(){apply();try{localStorage.setItem(key(),JSON.stringify(prefs));}catch{notify('A preferência foi aplicada, mas não pôde ser salva neste navegador.','error');}}
  function field(label,input){const wrap=node('label',label);wrap.append(input);dialog.append(wrap);}
  function open(title){closeSidebar();document.getElementById('account-menu').hidden=true;document.getElementById('account-menu-button').setAttribute('aria-expanded','false');dialog.replaceChildren();const h=node('h2',title);h.id='account-dialog-title';dialog.setAttribute('aria-labelledby',h.id);const close=node('button','Fechar');close.type='button';close.className='studio-button';close.onclick=()=>dialog.close();dialog.append(close,h);dialog.showModal();}
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  document.getElementById('profile-button').addEventListener('click',()=>{
    if(!user)return;open('Minha conta');const owner=user.id;
    const name=document.createElement('input');name.maxLength=80;name.autocomplete='name';name.value=user.user_metadata?.display_name||user.user_metadata?.full_name||user.user_metadata?.name||'';field('Nome de exibição',name);
    const email=document.createElement('input');email.value=user.email||'';email.readOnly=true;field('Email da conta',email);
    const save=node('button','Salvar nome');save.className='studio-button';const status=node('p','');status.setAttribute('role','status');
    save.onclick=async()=>{const value=name.value.trim();if(!value){status.textContent='Preencha seu nome.';return;}save.disabled=true;status.textContent='Salvando…';try{const {error}=await supabase.auth.updateUser({data:{display_name:value}});if(error)throw error;if(user?.id===owner){document.getElementById('account-name').textContent=value;document.getElementById('account-avatar').textContent=value[0].toUpperCase();status.textContent='Nome salvo.';}}catch{status.textContent='Não foi possível salvar. Tente novamente.';}finally{save.disabled=false;}};
    const privacy=node('a','Privacidade e exclusão dos meus dados');privacy.href='/privacidade/';privacy.target='_blank';privacy.rel='noopener';dialog.append(save,status,privacy);
  });
  document.getElementById('settings-button').addEventListener('click',()=>{
    open('Configurações');dialog.append(node('p','Estas preferências ficam salvas para sua conta neste navegador.'));
    const font=document.createElement('select');for(const [value,label] of [['normal','Normal'],['large','Maior']]){const opt=node('option',label);opt.value=value;font.append(opt);}font.value=prefs.font;field('Tamanho do texto da conversa',font);font.onchange=()=>{prefs.font=font.value;persist();};
    const enter=document.createElement('input');enter.type='checkbox';enter.checked=prefs.enter;field('Enviar com Enter (Shift + Enter quebra a linha)',enter);enter.onchange=()=>{prefs.enter=enter.checked;persist();};
    const reset=node('button','Restaurar preferências');reset.className='studio-button';reset.onclick=()=>{prefs={...defaults};font.value=prefs.font;enter.checked=prefs.enter;persist();};dialog.append(reset);
  });
  return {setUser(next){if(user?.id!==next?.id&&dialog.open)dialog.close();user=next;prefs={...defaults};try{const saved=JSON.parse(localStorage.getItem(key())||'{}');prefs.font=saved.font==='large'?'large':'normal';prefs.enter=saved.enter!==false;}catch{}apply();}};
}
