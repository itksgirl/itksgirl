// Supabase owns the durable counter. Browser state is only a display cache.
export function createTrial({supabase,form,openLogin}) {
  let user=null,quota=null,epoch=0,creating=null;
  const row=document.createElement('div');row.className='chat-usage';
  row.style.cssText='font-size:12px;line-height:1.4;color:inherit;opacity:.85;padding:4px 12px;overflow-wrap:anywhere';
  const text=document.createElement('span');text.setAttribute('role','status');
  const login=document.createElement('button');login.type='button';login.className='studio-button';login.textContent='Entrar gratuitamente';login.onclick=openLogin;
  row.append(text,login);form.append(row);
  function draw(){
    login.hidden=!quota?.anonymous||quota.remaining>0;
    if(!quota){text.textContent=user&&!user.is_anonymous?'30 perguntas a cada 3 horas · sem plano pago. ':'10 perguntas a cada 3 horas sem cadastro. ';return;}
    const remaining=quota.remaining;
    text.textContent=`${remaining} de ${quota.anonymous?10:30} perguntas disponíveis · ${quota.resetAt?'renovação às '+new Date(quota.resetAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'aguarde a atualização do limite'}. `;
  }
  async function refresh(){
    const current=epoch;if(!user)return;
    try{const {data,error}=await supabase.rpc('chat_quota',{p_consume:false});
      if(current!==epoch)return;
      if(error||!data||!Number.isInteger(data.remaining))throw new Error();
      quota=data;draw();
    }catch{if(current===epoch)text.textContent='O limite será verificado ao enviar sua pergunta. ';}
  }
  draw();
  setInterval(()=>{if(!document.hidden&&quota?.resetAt&&Date.now()>=Date.parse(quota.resetAt))refresh();},30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  return {
    sessionChanged(next){const changed=user?.id!==next?.id||user?.is_anonymous!==next?.is_anonymous;user=next||null;if(changed){epoch++;quota=null;draw();setTimeout(refresh,0);}},
    async token(){
      const {data,error}=await supabase.auth.getSession();if(error)throw new Error('Não foi possível consultar sua sessão.');
      if(data.session?.access_token)return data.session.access_token;
      if(!creating)creating=supabase.auth.signInAnonymously().finally(()=>{creating=null;});
      const result=await creating;
      if(result.error||!result.data?.session?.access_token)throw new Error('O teste sem cadastro está indisponível no momento. Entre na sua conta para conversar.');
      return result.data.session.access_token;
    },
    readResponse(response){const value=response.headers.get('X-Chat-Quota');if(value){try{const data=JSON.parse(value);if(Number.isInteger(data.remaining)){epoch++;quota=data;draw();}}catch{}}},
    canSend(){if(quota?.remaining===0){if(!quota.resetAt||Date.now()<Date.parse(quota.resetAt)){draw();return false;}}return true;}
  };
}
