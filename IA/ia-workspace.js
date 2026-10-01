import { createAccount } from './ia-account.js';
import { tracks, resources, projectIdeas, starters } from './ia-resources.js';

const ext = {javascript:'js',typescript:'ts',python:'py',java:'java',html:'html',css:'css',sql:'sql',json:'json',bash:'sh',shell:'sh',c:'c',cpp:'cpp',csharp:'cs',markdown:'md',text:'txt'};
export function filenameFor(language, index=1) { return language === 'java' ? `Exemplo${index}.java` : `codigo-${index}.${ext[language] || 'txt'}`; }
export function downloadFile(name, content, type='text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const a = document.createElement('a'); a.href=url; a.download=name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-');
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function el(tag, text='', cls='') { const n=document.createElement(tag); n.textContent=text; if(cls)n.className=cls; return n; }
function button(label, fn, cls='studio-button') { const b=el('button',label,cls); b.type='button'; b.addEventListener('click',fn); return b; }
function link(label,url) { const a=el('a',label,'studio-link'); a.href=url; a.target='_blank'; a.rel='noopener noreferrer'; return a; }
function isSafeURL(url) { try { return new URL(url).protocol==='https:'; } catch { return false; } }

export function createWorkspace({supabase,notify,ask,openLogin,closeSidebar,getConversation}) {
  const account=createAccount({supabase,notify,closeSidebar});
  let user=null, version=0, items=[], view='conversas', selectedProject=null, loading=false, loadError=false;
  const pending=new Set();
  const main=document.querySelector('.ai-main');
  const chatSections=[...main.children];
  const panel=el('section','','studio-panel'); panel.hidden=true; panel.tabIndex=-1; panel.setAttribute('aria-label','Área de estudos'); main.append(panel);
  const menu=document.querySelector('.sidebar-menu');
  for(const title of ['Design','Conteúdos','Livros']){const a=el('a',title,'sidebar-link');menu.append(a);}
  const links=[...document.querySelectorAll('.sidebar-menu .sidebar-link')];
  const views=['conversas','projetos','codigos','aprender','favoritos','design','conteudos','livros'];
  links.forEach((a,i)=>{ a.href='#'+views[i]; a.addEventListener('click',e=>{e.preventDefault(); navigate(views[i]);}); });
  links[3].after(links[7]);
  const banner=el('div','','project-context'); banner.hidden=true; document.querySelector('.chat-card').before(banner);
  const refreshBanner=()=>{const p=items.find(x=>x.id===selectedProject);banner.replaceChildren();banner.hidden=!p;if(p){banner.append(el('span','Projeto: '+p.title),button('Desvincular',()=>{selectedProject=null;refreshBanner();}));}};
  function navigate(next) {
    view=views.includes(next)?next:'conversas';
    if(location.hash!=='#'+view)history.pushState(null,'','#'+view);
    links.forEach((a,i)=>{a.classList.toggle('active',views[i]===view);if(views[i]===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    chatSections.forEach(n=>n.hidden=view!=='conversas'); banner.hidden=view!=='conversas'||!selectedProject;
    panel.hidden=view==='conversas'; if(!panel.hidden){render();panel.focus({preventScroll:true});}
    closeSidebar();
  }
  function requireUser(){if(user)return true;notify('Entre para salvar na sua conta.');openLogin();return false;}
  async function reload() {
    const v=version, owner=user?.id; if(!owner)return; loading=true;loadError=false;if(view!=='conversas')render();
    try {
      const rows=[];
      for(let start=0;;start+=100){const {data,error}=await supabase.from('study_items').select('*').eq('user_id',owner).order('updated_at',{ascending:false}).order('id').range(start,start+99);if(error)throw error;rows.push(...data);if(data.length<100)break;}
      if(version!==v)return;items=rows;
    } catch {if(version===v){loadError=true;notify('Não foi possível carregar a área de estudos. Tente novamente.');}}
    finally {if(version===v){loading=false;if(view!=='conversas')render();refreshBanner();}}
  }
  async function save(kind,title,payload,id=null) {
    if(!requireUser())return null;
    const v=version,owner=user.id;
    const row={id:id||crypto.randomUUID(),user_id:owner,kind,title:title.trim().slice(0,160),payload,updated_at:new Date().toISOString()};
    try {
      const {data,error}=await supabase.from('study_items').upsert(row,{onConflict:'id'}).select().single();if(error)throw error;
      if(version!==v)return null; items=[data,...items.filter(x=>x.id!==data.id)];refreshBanner();return data;
    } catch {if(version===v)notify('Não foi possível salvar. Verifique sua conexão e tente novamente.');return null;}
  }
  async function remove(item) {
    if(!user||!window.confirm(`Excluir “${item.title}”?`))return;
    const v=version;
    const {error}=await supabase.from('study_items').delete().eq('id',item.id).eq('user_id',user.id);
    if(v!==version)return;if(error){notify('Não foi possível excluir.');return;}items=items.filter(x=>x.id!==item.id);if(selectedProject===item.id)selectedProject=null;refreshBanner();render();
  }
  function header(title,description) { panel.replaceChildren(el('p','SEU ESPAÇO DE PROGRAMAÇÃO','studio-eyebrow'),el('h1',title),el('p',description,'studio-lead')); }
  function grid(){const g=el('div','','studio-grid');panel.append(g);return g;}
  function card(title,desc){const c=el('article','','studio-card');c.append(el('h2',title));if(desc)c.append(el('p',desc));return c;}
  function group(...children){const g=el('div','','studio-actions');g.append(...children);return g;}
  function accountNotice(){if(!user)panel.append(button('Entrar para salvar seus projetos e favoritos',openLogin));if(loading)panel.append(el('p','Carregando sua biblioteca…','studio-status'));if(loadError)panel.append(group(el('p','Sua biblioteca não carregou.'),button('Tentar novamente',reload)));}
  function searchCards(g,placeholder){const input=el('input','','studio-search');input.type='search';input.placeholder=placeholder;input.setAttribute('aria-label',placeholder);g.before(input);input.addEventListener('input',()=>{const q=input.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();for(const c of g.children)c.hidden=!c.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q);});}
  async function favorite(payload,title,b){
    if(!requireUser())return;
    const key=JSON.stringify(payload);if(pending.has(key))return;
    const existing=items.find(x=>x.kind==='favorite'&&x.payload.key===key);
    if(existing){notify('Este item já está nos favoritos.');return;}
    pending.add(key);if(b)b.disabled=true;
    try{const saved=await save('favorite',title,{...payload,key});if(saved){notify('Salvo em Favoritos.','success');if(b)b.textContent='Salvo ★';}}finally{pending.delete(key);if(b)b.disabled=false;}
  }
  function favButton(payload,title){const b=button('☆ Favoritar',()=>favorite(payload,title,b));return b;}
  function launch(prompt){navigate('conversas');ask(prompt);}
  function projectForm(existing=null,idea=null) {
    if(!requireUser())return;
    const form=el('form','','studio-editor');
    const name=el('input');name.required=true;name.maxLength=120;name.value=existing?.title||idea?.title||'';
    const desc=el('textarea');desc.rows=3;desc.maxLength=4000;desc.value=existing?.payload.description||idea?.description||'';
    const tasksInput=el('textarea');tasksInput.rows=5;tasksInput.maxLength=6000;tasksInput.value=(existing?.payload.tasks||idea?.tasks?.map(text=>({text,done:false}))||[]).map(t=>t.text).join('\n');
    for(const [label,input] of [['Nome do projeto',name],['Objetivo e anotações',desc],['Tarefas — uma por linha',tasksInput]]){const l=el('label',label);l.append(input);form.append(l);}
    const submit=el('button','Salvar projeto','studio-button primary');submit.type='submit';form.append(group(submit,button('Cancelar',()=>form.remove())));panel.prepend(form);name.focus();
    form.addEventListener('submit',async e=>{e.preventDefault();if(!name.value.trim())return;submit.disabled=true;const old=existing?.payload.tasks||[];const tasks=tasksInput.value.split('\n').map(t=>t.trim()).filter(Boolean).slice(0,60).map(text=>({text,done:old.find(t=>t.text===text)?.done||false}));const saved=await save('project',name.value,{...existing?.payload,description:desc.value,tasks},existing?.id);if(saved)render();else submit.disabled=false;});
  }
  function renderProjects(){
    header('Projetos','Transforme uma ideia em etapas pequenas. Planeje, acompanhe e leve o contexto para uma conversa.');accountNotice();panel.append(button('+ Novo projeto',()=>projectForm(), 'studio-button primary'));
    const own=items.filter(x=>x.kind==='project');
    if(own.length){const g=grid();for(const p of own){const c=card(p.title,p.payload.description);const tasks=p.payload.tasks||[];const done=tasks.filter(t=>t.done).length;c.append(el('p',`${done} de ${tasks.length} tarefas concluídas`,'studio-meta'));const progress=el('progress');progress.max=tasks.length||1;progress.value=done;progress.setAttribute('aria-label','Progresso de '+p.title);c.append(progress);
      tasks.forEach((task,index)=>{const label=el('label','','studio-task');const input=el('input');input.type='checkbox';input.checked=task.done;input.addEventListener('change',async()=>{input.disabled=true;const next=tasks.map((t,i)=>i===index?{...t,done:input.checked}:t);if(await save('project',p.title,{...p.payload,tasks:next},p.id))render();else{input.checked=task.done;input.disabled=false;}});label.append(input,el('span',task.text));c.append(label);});
      c.append(group(button('Trabalhar com a IA',()=>{selectedProject=p.id;refreshBanner();launch(`Vamos trabalhar no projeto ${p.title}. Sugira o próximo passo com base nas tarefas e no objetivo.`);}),button('Editar',()=>projectForm(p)),button('Baixar plano',()=>downloadFile(p.title+'.md',`# ${p.title}\n\n${p.payload.description||''}\n\n`+tasks.map(t=>`- [${t.done?'x':' '}] ${t.text}`).join('\n'))),button('Excluir',()=>remove(p))));g.append(c);}}
    panel.append(el('h2','Ideias para começar','studio-section-title'));const ideas=grid();for(const idea of projectIdeas){const c=card(idea.title,idea.description);c.append(button('Usar este plano',()=>projectForm(null,idea)));ideas.append(c);}
  }
  function codeCard(code,own=null){const c=card(code.title,code.filename);const pre=el('pre');pre.append(el('code',code.content));c.append(pre);c.append(group(button('Copiar',()=>copy(code.content)),button('Baixar arquivo',()=>downloadFile(code.filename,code.content)),button('Explicar com a IA',()=>launch(`Explique este código e proponha um exercício:\n\n${code.content}`)),favButton({type:'code',...code},code.title)));if(own)c.append(button('Excluir da biblioteca',()=>remove(own)));return c;}
  function renderCodes(){header('Códigos','Exemplos editáveis para estudar e arquivos para abrir no VS Code. O código não é executado nesta página.');accountNotice();panel.append(el('p','Baixe o arquivo, abra uma pasta no VS Code e leia as instruções antes de executar. Java precisa do JDK; Python precisa do interpretador.','studio-meta'));
    panel.append(button('Baixar projeto web inicial (.zip)',downloadStarter,'studio-button primary'));
    const own=items.filter(x=>x.kind==='snippet');const g=grid();for(const s of own)g.append(codeCard({...s.payload,title:s.title},s));for(const s of starters)g.append(codeCard(s));searchCards(g,'Buscar por linguagem ou título');
  }
  function renderLearn(){header('Aprender','Escolha uma trilha, pratique com um projeto e marque seu progresso. As leituras são sugestões por objetivo, não um ranking universal.');accountNotice();const g=grid();for(const t of tracks){const c=card(t.title,t.tag);const saved=items.find(x=>x.kind==='progress'&&x.payload.track===t.id);const completed=saved?.payload.completed||[];t.steps.forEach((step,i)=>{const l=el('label','','studio-task');const input=el('input');input.type='checkbox';input.checked=completed.includes(i);input.addEventListener('change',async()=>{if(!requireUser()){input.checked=false;return;}input.disabled=true;const next=input.checked?[...completed,i]:completed.filter(n=>n!==i);if(await save('progress',t.title,{track:t.id,completed:next},saved?.id))render();else{input.checked=completed.includes(i);input.disabled=false;}});l.append(input,el('span',step));c.append(l);});c.append(group(button('Estudar com a IA',()=>launch(t.prompt)),favButton({type:'track',track:t.id},t.title)));g.append(c);}
    panel.append(button('Abrir biblioteca de livros',()=>navigate('livros'),'studio-button primary'));
    panel.append(el('h2','Livros e referências','studio-section-title'),el('p','Links para autores, editoras e documentação oficial. Alguns livros são pagos e em inglês; os materiais gratuitos estão identificados.'));const books=grid();for(const r of resources){const c=card(r.title,r.description);c.append(el('p',`${r.author} · ${r.topic}`,'studio-meta'),el('p',r.access,'studio-meta'),group(link('Ver fonte',r.url),favButton({type:'resource',url:r.url,description:r.description},r.title)));books.append(c);}searchCards(books,'Buscar livros e referências');
  }

  function renderBooks(){
    header('Livros','Encontre livros de programação e referências para acompanhar seus estudos.');
    panel.append(el('p','A leitura acontece nos sites dos autores e editoras. Confira em cada item o idioma e se o acesso é gratuito ou pago.','studio-meta'));
    const controls=group();controls.style.display='grid';controls.style.gridTemplateColumns='minmax(0,1fr)';const search=el('input','','studio-search');search.style.minWidth='0';search.style.width='100%';search.style.boxSizing='border-box';search.type='search';search.placeholder='Buscar título, autor ou linguagem';search.setAttribute('aria-label',search.placeholder);
    const label=el('label','Assunto ');const select=el('select','','studio-button');for(const topic of ['Todos os assuntos',...new Set(resources.map(r=>r.topic))]){const opt=el('option',topic);opt.value=topic;select.append(opt);}label.append(select);controls.append(search,label);panel.append(controls);
    const empty=el('p','Nenhum material encontrado. Tente outro título ou assunto.','studio-empty');empty.hidden=true;empty.setAttribute('role','status');panel.append(empty);
    const booksTitle=el('h2','Livros','studio-section-title');panel.append(booksTitle);const books=grid();const refsTitle=el('h2','Documentação e cursos','studio-section-title');panel.append(refsTitle);const refs=grid();const entries=[];
    for(const r of resources){const isBook=!/Documentação|Curso/.test(r.access);const c=card(r.title,r.description);c.append(el('p',r.author+' · '+r.topic,'studio-meta'),el('p',r.access,'studio-meta'),group(link(isBook?'Ver livro':'Ver referência',r.url),favButton({type:'resource',url:r.url,description:r.description},r.title)));(isBook?books:refs).append(c);entries.push({c,r});}
    const norm=t=>t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const filter=()=>{const q=norm(search.value.trim());for(const {c,r} of entries)c.hidden=!(norm(r.title+' '+r.author+' '+r.topic).includes(q)&&(select.value==='Todos os assuntos'||r.topic===select.value));booksTitle.hidden=books.hidden=![...books.children].some(c=>!c.hidden);refsTitle.hidden=refs.hidden=![...refs.children].some(c=>!c.hidden);empty.hidden=entries.some(e=>!e.c.hidden);};search.addEventListener('input',filter);select.addEventListener('change',filter);
  }

  function renderFavorites(){header('Favoritos','Respostas, códigos e referências que você quer encontrar de novo.');accountNotice();const own=items.filter(x=>x.kind==='favorite');if(!own.length&&!loading)panel.append(el('p','Use ☆ Favoritar nas respostas, códigos e leituras para começar.','studio-empty'));const g=grid();for(const f of own){const c=card(f.title,f.payload.description);if(f.payload.content){const pre=el('pre',f.payload.content);c.append(pre,button('Copiar',()=>copy(f.payload.content)));}if(f.payload.type==='code')c.append(button('Baixar arquivo',()=>downloadFile(f.payload.filename||'codigo.txt',f.payload.content)));if(isSafeURL(f.payload.url))c.append(link('Abrir referência',f.payload.url));if(f.payload.track)c.append(button('Ver trilhas',()=>navigate('aprender')));c.append(button('Remover favorito',()=>remove(f)));g.append(c);}if(own.length)searchCards(g,'Buscar favoritos');}
  function render(){if(view==='projetos')renderProjects();if(view==='codigos')renderCodes();if(view==='aprender')renderLearn();if(view==='favoritos')renderFavorites();if(view==='design')renderDesign();if(view==='conteudos')renderContents();if(view==='livros')renderBooks();}
  async function copy(text){try{await navigator.clipboard.writeText(text);notify('Copiado.','success');}catch{notify('Não foi possível copiar. Selecione o texto ou baixe o arquivo.');}}
  async function downloadStarter(){try{await loadScript('./vendor/fflate.js','fflate');const files={};for(const s of starters.slice(0,3))files[s.filename]=window.fflate.strToU8(s.content);files['README.md']=window.fflate.strToU8('# Primeiro site\n\nAbra esta pasta no VS Code. Abra index.html no navegador.\n\nArquivos: index.html, style.css e script.js. Não requer instalação de pacotes.\n');const data=window.fflate.zipSync(files,{level:6});downloadFile('primeiro-site.zip',data,'application/zip');}catch{notify('Não foi possível gerar o ZIP. Os arquivos individuais continuam disponíveis.');}}
  function decorate(message,text){
    if(!message.classList.contains('ai-message')||message.classList.contains('loading-message'))return;
    const actions=group(button('Copiar resposta',()=>copy(text)),favButton({type:'answer',content:text,conversation:getConversation()},text.slice(0,100)||'Resposta salva'));
    message.querySelector('.message-content')?.append(actions);
    message.querySelectorAll('pre code').forEach((block,i)=>{const language=[...block.classList].find(c=>c.startsWith('language-'))?.slice(9)||'text';const code=block.textContent;const preceding=block.parentElement.previousElementSibling?.textContent||'';const hinted=preceding.match(/(?:^|\s)([\w.-]+\.(?:html|css|js|ts|py|java|json|sql|md|txt|c|cpp|cs))\b/)?.[1];const name=hinted||(language==='java'?((code.match(/public\s+class\s+(\w+)/)?.[1]||'Main')+'.java'):filenameFor(language,i+1));const toolbar=group(el('span',name,'studio-meta'),button('Copiar',()=>copy(code)),button('Baixar',()=>downloadFile(name,code)),button('Salvar código',async e=>{const b=e.currentTarget;b.disabled=true;try{if(await save('snippet',name,{filename:name,language,content:code})){notify('Salvo em Códigos.','success');b.textContent='Salvo';}}finally{b.disabled=false;}}));toolbar.classList.add('code-toolbar');block.parentElement.before(toolbar);});
  }

  function renderDesign(){
    header('Design','Inspirações para transformar uma ideia visual em um site. Escolha uma direção e prepare seu pedido para a IA.');
    const g=grid();
    const ideas=[
      ['Portfólio editorial','Tipografia marcante, fundo claro e projetos em destaque.','Crie um portfólio editorial responsivo em HTML e CSS, com tipografia legível, fundo pérola, apresentação, projetos e contato. Explique a estrutura dos arquivos.','editorial'],
      ['Plataforma de estudos','Cards organizados, progresso visível e navegação simples.','Me ajude a projetar uma plataforma de estudos acessível com cards de cursos, progresso e menu responsivo. Comece pelo planejamento e depois HTML e CSS.','study'],
      ['Página de produto','Uma mensagem principal, detalhes úteis e chamada para ação.','Crie o conceito de uma landing page de produto digital com hierarquia visual clara, benefícios e botão de ação. Evite avaliações fictícias e explique decisões de design.','product'],
      ['Painel de projetos','Organização visual para tarefas, etapas e prioridades.','Planeje um dashboard de projetos responsivo com tarefas e filtros. Use dados de exemplo identificados e explique como implementar com JavaScript.','dashboard']
    ];
    for(const [title,desc,prompt,style] of ideas){const c=card(title,desc);const preview=el('div','','design-preview '+style);preview.setAttribute('aria-hidden','true');preview.append(el('span','IDEIA / ESTUDO'),el('strong',title),el('div','','design-preview-blocks'));c.prepend(preview);c.append(group(button('Criar com a IA',()=>launch(prompt)),favButton({type:'answer',content:prompt},title)));g.append(c);}
    panel.append(el('p','Estudos visuais originais para inspiração. Os botões preparam uma mensagem no chat; você pode editar antes de enviar.','studio-meta'));
  }
  function renderContents(){
    header('Conteúdos','Escolha o que quer aprender e continue no chat com uma pergunta pronta.');
    const g=grid();
    const lessons=[
      ['Primeiros passos em programação','Entenda variáveis, condições e repetições com pequenos exercícios.','Sou iniciante. Ensine variáveis, condições e repetições com exemplos em Python e um exercício de cada vez.'],
      ['HTML e CSS na prática','Monte sua primeira página e adapte para o celular.','Quero criar minha primeira página com HTML e CSS. Oriente passo a passo, com arquivos separados e explicações curtas.'],
      ['JavaScript e interação','Dê vida a botões, formulários e listas.','Ensine eventos e manipulação do DOM criando uma lista de tarefas em JavaScript. Inclua acessibilidade e explique cada etapa.'],
      ['Git e GitHub','Aprenda a acompanhar alterações e publicar seu trabalho.','Explique Git e GitHub para iniciantes. Mostre um fluxo seguro para revisar alterações, fazer commit e enviar ao repositório, sem apagar arquivos.'],
      ['Como estudar com IA','Faça perguntas melhores e confira o que aprendeu.','Monte um roteiro de estudo de programação com IA, exercícios e formas de verificar respostas. Pergunte primeiro meu nível e tempo disponível.'],
      ['Revisar e entender erros','Aprenda a investigar mensagens e testar hipóteses.','Me ensine a depurar um programa. Peça o código e a mensagem de erro antes de sugerir uma correção.']
    ];
    for(const [title,desc,prompt] of lessons){const c=card(title,desc);c.append(group(button('Estudar no chat',()=>launch(prompt)),favButton({type:'answer',content:prompt},title)));g.append(c);}
    panel.append(group(button('Ver trilhas e livros',()=>navigate('aprender')),button('Abrir biblioteca de códigos',()=>navigate('codigos')),button('Explorar design',()=>navigate('design'))));
  }
  const openRoute=()=>{const route=location.hash.slice(1);if(views.includes(route))navigate(route);};
  window.addEventListener('hashchange',openRoute);
  window.addEventListener('popstate',openRoute);
  // Defer until the surrounding chat has completed its synchronous setup.
  queueMicrotask(openRoute);

  return {navigate,decorate,setUser(next){account.setUser(next);if(next?.id===user?.id){user=next;return;}version++;user=next;items=[];selectedProject=null;loading=false;loadError=false;pending.clear();refreshBanner();if(view!=='conversas')render();if(user)setTimeout(reload,0);},context(){const p=items.find(x=>x.id===selectedProject);return p?`Projeto: ${p.title}\nObjetivo: ${p.payload.description||''}\nTarefas:\n${(p.payload.tasks||[]).map(t=>`${t.done?'Concluída':'Pendente'}: ${t.text}`).join('\n')}`.slice(0,8000):'';}};
}

const scripts=new Map();
export async function loadScript(src,globalName){if(window[globalName])return window[globalName];if(!scripts.has(src))scripts.set(src,new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=()=>resolve(window[globalName]);s.onerror=()=>{scripts.delete(src);s.remove();reject(new Error('Falha ao carregar recurso.'));};document.head.append(s);}));return scripts.get(src);}

