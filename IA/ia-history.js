// Persistência por conta. O RLS do Supabase continua sendo a proteção do banco.
export function criarHistorico({ supabase, lista, renderizar, avisar }) {
  let usuarioId = null;
  let conversaId = null;
  let versao = 0;
  let listagem = 0;

  function contexto() { return { usuarioId, conversaId, versao }; }
  function atual(ctx) {
    return ctx.usuarioId === usuarioId && ctx.versao === versao;
  }
  function status(texto) {
    if (!lista) return;
    const p = document.createElement('p');
    p.className = 'history-empty';
    p.textContent = texto;
    lista.replaceChildren(p);
  }
  async function lerPaginas(tabela, colunas, configurar) {
    const linhas = [];
    for (let inicio = 0; ; inicio += 100) {
      const { data, error } = await configurar(
        supabase.from(tabela).select(colunas)
      ).range(inicio, inicio + 99);
      if (error) throw error;
      linhas.push(...data);
      if (data.length < 100) return linhas;
    }
  }
  async function listar() {
    const ctx = contexto();
    const pedido = ++listagem;
    if (!ctx.usuarioId) {
      status('Entre na sua conta para salvar conversas.');
      return;
    }
    try {
      const conversas = await lerPaginas('conversations', 'id,title', q =>
        q.eq('user_id', ctx.usuarioId)
          .order('updated_at', { ascending: false }).order('id')
      );
      if (!atual(ctx) || pedido !== listagem || !lista) return;
      lista.replaceChildren();
      if (!conversas.length) status('Suas conversas aparecerão aqui.');
      for (const conversa of conversas) {
        const item = document.createElement('a');
        item.href = '#chat-messages';
        item.className = 'sidebar-link';
        item.textContent = conversa.title || 'Nova conversa';
        if (conversa.id === conversaId) item.setAttribute('aria-current', 'true');
        item.addEventListener('click', event => {
          event.preventDefault();
          renderizar.abrir(conversa.id);
        });
        lista.appendChild(item);
      }
    } catch {
      if (atual(ctx) && pedido === listagem) {
        status('Não foi possível carregar as conversas.');
        if (lista) {
          const tentar = document.createElement('button');
          tentar.type = 'button';
          tentar.className = 'text-button';
          tentar.textContent = 'Tentar novamente';
          tentar.addEventListener('click', listar);
          lista.appendChild(tentar);
        }
      }
    }
  }
  function trocarUsuario(id) {
    if (id === usuarioId) return false;
    usuarioId = id;
    conversaId = null;
    versao++;
    status(id ? 'Carregando conversas...' : 'Entre na sua conta para salvar conversas.');
    // Não executar consultas assíncronas dentro do callback de autenticação.
    window.setTimeout(listar, 0);
    return true;
  }
  function nova() { conversaId = null; versao++; void listar(); }
  async function abrir(id) {
    const ctx = contexto();
    if (!ctx.usuarioId) return null;
    const { data: conversa, error } = await supabase.from('conversations')
      .select('id').eq('id', id).eq('user_id', ctx.usuarioId).single();
    if (error) throw error;
    const mensagens = await lerPaginas('messages', 'id,role,content,created_at', q =>
      q.eq('conversation_id', conversa.id).eq('user_id', ctx.usuarioId)
        .order('created_at').order('id')
    );
    if (!atual(ctx)) return null;
    conversaId = id;
    versao++;
    void listar();
    return mensagens.filter(m => m.role === 'user' || m.role === 'assistant');
  }
  async function salvar(ctx, pergunta, resposta) {
    if (!ctx.usuarioId || !atual(ctx)) return;
    try {
      let id = ctx.conversaId || conversaId;
      if (!id) {
        id = crypto.randomUUID();
        const agora = new Date().toISOString();
        const { error } = await supabase.from('conversations').insert({
          id, user_id: ctx.usuarioId, title: pergunta.replace(/\s+/g, ' ').slice(0, 80),
          created_at: agora, updated_at: agora
        });
        if (error) throw error;
        if (!atual(ctx)) return;
        conversaId = id;
      }
      if (!atual(ctx)) return;
      const instante = Date.now();
      // As duas mensagens são inseridas na mesma operação: tudo ou nada.
      const { error } = await supabase.from('messages').insert([
        { id: crypto.randomUUID(), conversation_id: id, user_id: ctx.usuarioId,
          role: 'user', content: pergunta, created_at: new Date(instante).toISOString() },
        { id: crypto.randomUUID(), conversation_id: id, user_id: ctx.usuarioId,
          role: 'assistant', content: resposta, created_at: new Date(instante + 1).toISOString() }
      ]);
      if (error) throw error;
      if (!atual(ctx)) return;
      const { error: erroData } = await supabase.from('conversations')
        .update({ updated_at: new Date(instante + 1).toISOString() })
        .eq('id', id).eq('user_id', ctx.usuarioId);
      if (erroData && atual(ctx)) avisar('Mensagens salvas, mas a ordem de Recentes não foi atualizada.');
      if (atual(ctx)) await listar();
    } catch {
      if (atual(ctx)) avisar('Esta interação não foi salva na conta. Copie as mensagens antes de sair ou recarregar.');
    }
  }
  status('Entre na sua conta para salvar conversas.');
  return { contexto, atual, listar, trocarUsuario, nova, abrir, salvar };
}
