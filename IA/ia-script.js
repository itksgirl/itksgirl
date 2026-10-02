import { supabase } from "./supabase-config.js";
import { criarHistorico } from "./ia-history.js";
import { createWorkspace } from "./ia-workspace.js";
import { createTrial } from "./ia-trial.js";
import { createAttachments } from "./ia-attachments.js";

// =========================================================
// ELEMENTOS DO CHAT
// =========================================================

const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatMessages = document.getElementById("chat-messages");
const sendButton = document.getElementById("send-button");
const characterCounter = document.getElementById("character-counter");

const suggestionButtons = document.querySelectorAll(
  ".suggestion-button"
);

// =========================================================
// ELEMENTOS DA SIDEBAR
// =========================================================

const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menu-button");
const menuClose = document.getElementById("menu-close");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const newChatButton = document.getElementById("new-chat");

// =========================================================
// ELEMENTOS DE AUTENTICAÇÃO
// =========================================================

const authModal = document.getElementById("auth-modal");
const authBackdrop = document.getElementById("auth-backdrop");
const authClose = document.getElementById("auth-close");

const headerLoginButton = document.getElementById(
  "header-login-button"
);

const headerUserButton = document.getElementById(
  "header-user-button"
);

const headerUserInitial = document.getElementById(
  "header-user-initial"
);

const sidebarLoginButton = document.getElementById(
  "sidebar-login-button"
);

const sidebarUser = document.getElementById("sidebar-user");
const accountMenuButton = document.getElementById(
  "account-menu-button"
);

const accountMenu = document.getElementById("account-menu");
const accountAvatar = document.getElementById("account-avatar");
const accountName = document.getElementById("account-name");
const accountEmail = document.getElementById("account-email");
const logoutButton = document.getElementById("logout-button");

const loginTab = document.getElementById("login-tab");
const registerTab = document.getElementById("register-tab");

const loginPanel = document.getElementById("login-panel");
const registerPanel = document.getElementById("register-panel");

const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginSubmit = document.getElementById("login-submit");
const loginMessage = document.getElementById("login-message");

const registerForm = document.getElementById("register-form");
const registerName = document.getElementById("register-name");
const registerEmail = document.getElementById("register-email");
const registerPassword = document.getElementById(
  "register-password"
);

const registerTerms = document.getElementById("register-terms");
const registerSubmit = document.getElementById("register-submit");
const registerMessage = document.getElementById(
  "register-message"
);

const authMainView = document.getElementById("auth-main-view");
const passwordResetView = document.getElementById(
  "password-reset-view"
);

const forgotPasswordButton = document.getElementById(
  "forgot-password-button"
);

const passwordResetBack = document.getElementById(
  "password-reset-back"
);

const passwordResetForm = document.getElementById(
  "password-reset-form"
);

const passwordResetEmail = document.getElementById(
  "password-reset-email"
);

const passwordResetSubmit = document.getElementById(
  "password-reset-submit"
);

const passwordResetMessage = document.getElementById(
  "password-reset-message"
);

const passwordToggleButtons = document.querySelectorAll(
  "[data-password-toggle]"
);

const toastContainer = document.getElementById("toast-container");

// =========================================================
// LIMITES E ESTADO
// =========================================================

const LIMITE_PERGUNTA = 4000;
const LIMITE_MENSAGENS_HISTORICO = 20;
const LIMITE_TOTAL_HISTORICO = 24000;
const TEMPO_MAXIMO_REQUISICAO = 120000;

let requisicaoEmAndamento = false;
let autenticacaoEmAndamento = false;
let historicoDaConversa = [];
let usuarioAtual = null;
let carregandoConversa = false;
let sessaoCarregada = false;
let activeController = null;
const workspace = createWorkspace({ supabase, notify: mostrarToast, openLogin: abrirModalAutenticacao,
  closeSidebar: fecharSidebar, getConversation: () => memoria.contexto().conversaId,
  ask: text => { if (requisicaoEmAndamento) { mostrarToast('Aguarde a resposta ou clique em Parar.'); return; } userInput.value = text.slice(0,4000); atualizarBotaoEnviar(); userInput.focus(); }
});
const trial = createTrial({supabase,form:chatForm,openLogin:abrirModalAutenticacao});
const attachments = createAttachments({ form: chatForm, notify: mostrarToast, onChange: () => atualizarBotaoEnviar() });
const stopButton = document.createElement('button'); stopButton.type='button'; stopButton.className='stop-button'; stopButton.textContent='Parar resposta'; stopButton.hidden=true;
stopButton.onclick=()=>activeController?.abort();chatForm.append(stopButton);
const requestStatus=document.createElement('p');requestStatus.className='request-status';requestStatus.setAttribute('role','status');chatForm.append(requestStatus);
const memoria = criarHistorico({
  supabase,
  lista: document.getElementById("history-list"),
  renderizar: { abrir: abrirConversaSalva },
  avisar: texto => mostrarToast(texto, "error")
});

async function abrirConversaSalva(id) {
  if (requisicaoEmAndamento || carregandoConversa) return;
  workspace.navigate("conversas");
  attachments.clear();
  document.body.classList.add("chat-active");
  const ctx = memoria.contexto();
  carregandoConversa = true;
  atualizarBotaoEnviar();
  try {
    const mensagens = await memoria.abrir(id);
    if (!mensagens) return;
    chatMessages.replaceChildren();
    for (const mensagem of mensagens) {
      criarMensagem(mensagem.role === "user" ? "Você" : "ITKs AI",
        mensagem.content, mensagem.role === "user" ? "user-message" : "ai-message");
    }
    historicoDaConversa = limitarHistorico(mensagens.map(({ role, content }) => ({ role, content })));
    if (!mensagens.length) mostrarMensagemInicial();
    userInput.value = "";
    fecharSidebar();
    rolarChatParaFinal(true);
  } catch {
    if (memoria.atual(ctx)) mostrarToast("Não foi possível abrir esta conversa. Tente novamente.", "error");
  } finally {
    carregandoConversa = false;
    atualizarBotaoEnviar();
  }
}

const socialButtons = document.querySelectorAll("[data-social-provider]");
const socialNames = { google: "Google", facebook: "Facebook", apple: "Apple", azure: "Microsoft" };
socialButtons.forEach(button => {
  button.addEventListener("click", async () => {
    if (autenticacaoEmAndamento || requisicaoEmAndamento || !sessaoCarregada) return;
    const provider = button.dataset.socialProvider;
    if (!Object.hasOwn(socialNames, provider)) return;
    const label = button.querySelector(".social-label");
    const normal = label.textContent;
    autenticacaoEmAndamento = true;
    socialButtons.forEach(item => { item.disabled = true; });
    button.setAttribute("aria-busy", "true");
    label.textContent = "Abrindo " + socialNames[provider] + "...";
    try {
      const options = { redirectTo: window.location.origin + window.location.pathname };
      if (provider === "azure") options.scopes = "email";
      const { error } = await supabase.auth.signInWithOAuth({ provider, options });
      if (error) throw error;
    } catch {
      mostrarToast("Não foi possível entrar com " + socialNames[provider] + ". Tente novamente em instantes.", "error");
    } finally {
      autenticacaoEmAndamento = false;
      socialButtons.forEach(item => { item.disabled = false; });
      button.removeAttribute("aria-busy");
      label.textContent = normal;
    }
  });
});

// =========================================================
// VERIFICAÇÃO DA INTERFACE
// =========================================================

if (
  !chatForm ||
  !userInput ||
  !chatMessages ||
  !sendButton
) {
  throw new Error(
    "A interface da ITKs AI não foi carregada corretamente."
  );
}

// =========================================================
// FUNÇÕES UTILITÁRIAS
// =========================================================

function obterInicial(texto) {
  if (typeof texto !== "string") {
    return "U";
  }

  const textoLimpo = texto.trim();

  if (!textoLimpo) {
    return "U";
  }

  return textoLimpo.charAt(0).toUpperCase();
}

function obterNomeUsuario(user) {
  const nomeMetadata =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name;

  if (
    typeof nomeMetadata === "string" &&
    nomeMetadata.trim()
  ) {
    return nomeMetadata.trim().slice(0, 80);
  }

  const email = user?.email;

  if (typeof email === "string" && email.includes("@")) {
    return email.split("@")[0].slice(0, 80);
  }

  return "Usuário";
}

function limparMensagemStatus(elemento) {
  if (!elemento) return;

  elemento.textContent = "";
  elemento.classList.remove("success");
}

function mostrarMensagemStatus(
  elemento,
  texto,
  tipo = "error"
) {
  if (!elemento) return;

  elemento.textContent = texto;
  elemento.classList.toggle(
    "success",
    tipo === "success"
  );
}

function mostrarToast(texto, tipo = "") {
  if (!toastContainer || !texto) return;

  const toast = document.createElement("div");

  toast.className = "toast";

  if (tipo === "success" || tipo === "error") {
    toast.classList.add(tipo);
  }

  toast.textContent = texto;

  toastContainer.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4500);
}

function traduzirErroAutenticacao(error) {
  const mensagem =
    typeof error?.message === "string"
      ? error.message.toLowerCase()
      : "";

  if (
    mensagem.includes("invalid login credentials") ||
    mensagem.includes("invalid credentials")
  ) {
    return "E-mail ou senha incorretos.";
  }

  if (mensagem.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (mensagem.includes("user already registered")) {
    return "Já existe uma conta cadastrada com este e-mail.";
  }

  if (mensagem.includes("password should be")) {
    return "A senha precisa ter pelo menos 8 caracteres.";
  }

  if (mensagem.includes("rate limit")) {
    return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  }

  if (mensagem.includes("network")) {
    return "Não foi possível conectar ao serviço de autenticação.";
  }

  return "Não foi possível concluir a operação. Tente novamente.";
}

function definirBotaoCarregando(
  botao,
  carregando,
  textoNormal,
  textoCarregando
) {
  if (!botao) return;

  botao.disabled = carregando;
  botao.textContent = carregando
    ? textoCarregando
    : textoNormal;
}

// =========================================================
// SIDEBAR
// =========================================================

function abrirSidebar() {
  if (!sidebar || !sidebarOverlay) return;

  sidebar.classList.add("open");
  sidebarOverlay.classList.add("active");

  document.body.style.overflow = "hidden";
}

function fecharSidebar() {
  if (!sidebar || !sidebarOverlay) return;

  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("active");

  if (!authModal || authModal.hidden) {
    document.body.style.overflow = "";
  }
}

menuButton?.addEventListener("click", abrirSidebar);
menuClose?.addEventListener("click", fecharSidebar);
sidebarOverlay?.addEventListener("click", fecharSidebar);

// =========================================================
// MODAL DE AUTENTICAÇÃO
// =========================================================

function mostrarTelaPrincipalAutenticacao() {
  if (authMainView) {
    authMainView.hidden = false;
  }

  if (passwordResetView) {
    passwordResetView.hidden = true;
  }
}

function mostrarTelaRecuperacaoSenha() {
  if (authMainView) {
    authMainView.hidden = true;
  }

  if (passwordResetView) {
    passwordResetView.hidden = false;
  }

  limparMensagemStatus(passwordResetMessage);

  if (
    passwordResetEmail &&
    loginEmail?.value.trim()
  ) {
    passwordResetEmail.value =
      loginEmail.value.trim();
  }
}

const loginPasswordStep = document.getElementById("login-password-step");
let etapaSenha = false;

function atualizarEtapaLogin() {
  if (loginPasswordStep) loginPasswordStep.hidden = !etapaSenha;
  if (loginPassword) loginPassword.disabled = !etapaSenha;
  if (loginSubmit) {
    loginSubmit.textContent = etapaSenha ? "Entrar" : "Continuar";
    loginSubmit.disabled = autenticacaoEmAndamento || !loginEmail?.validity.valid;
  }
}

function reiniciarEtapaLogin() {
  etapaSenha = false;
  if (loginPassword) { loginPassword.value = ""; loginPassword.type = "password"; }
  document.querySelector('[data-password-toggle="login-password"]')?.setAttribute("aria-label", "Mostrar senha");
  atualizarEtapaLogin();
}

loginEmail?.addEventListener("input", () => {
  reiniciarEtapaLogin();
  limparMensagemStatus(loginMessage);
});

function mostrarLogin() {
  reiniciarEtapaLogin();
  loginTab?.classList.add("active");
  registerTab?.classList.remove("active");

  loginTab?.setAttribute("aria-selected", "true");
  registerTab?.setAttribute("aria-selected", "false");

  if (loginPanel) {
    loginPanel.hidden = false;
  }

  if (registerPanel) {
    registerPanel.hidden = true;
  }

  limparMensagemStatus(loginMessage);
  limparMensagemStatus(registerMessage);
}

function mostrarCadastro() {
  registerTab?.classList.add("active");
  loginTab?.classList.remove("active");

  registerTab?.setAttribute("aria-selected", "true");
  loginTab?.setAttribute("aria-selected", "false");

  if (registerPanel) {
    registerPanel.hidden = false;
  }

  if (loginPanel) {
    loginPanel.hidden = true;
  }

  limparMensagemStatus(loginMessage);
  limparMensagemStatus(registerMessage);
}

function abrirModalAutenticacao() {
  if (!authModal) return;

  mostrarTelaPrincipalAutenticacao();
  mostrarLogin();

  authModal.hidden = false;
  document.body.classList.add("modal-open");
}

function fecharModalAutenticacao() {
  if (!authModal || autenticacaoEmAndamento) return;

  authModal.hidden = true;
  document.body.classList.remove("modal-open");

  if (!sidebar?.classList.contains("open")) {
    document.body.style.overflow = "";
  }

  limparMensagemStatus(loginMessage);
  limparMensagemStatus(registerMessage);
  limparMensagemStatus(passwordResetMessage);
}

headerLoginButton?.addEventListener(
  "click",
  abrirModalAutenticacao
);

sidebarLoginButton?.addEventListener(
  "click",
  abrirModalAutenticacao
);

authClose?.addEventListener(
  "click",
  fecharModalAutenticacao
);

authBackdrop?.addEventListener(
  "click",
  fecharModalAutenticacao
);

loginTab?.addEventListener("click", mostrarLogin);
registerTab?.addEventListener("click", mostrarCadastro);

forgotPasswordButton?.addEventListener(
  "click",
  mostrarTelaRecuperacaoSenha
);

passwordResetBack?.addEventListener(
  "click",
  mostrarTelaPrincipalAutenticacao
);

// =========================================================
// MOSTRAR E OCULTAR SENHA
// =========================================================

passwordToggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const inputId = button.dataset.passwordToggle;

    if (!inputId) return;

    const input = document.getElementById(inputId);

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const senhaVisivel = input.type === "text";

    input.type = senhaVisivel
      ? "password"
      : "text";

    button.setAttribute(
      "aria-label",
      senhaVisivel
        ? "Mostrar senha"
        : "Ocultar senha"
    );
  });
});

// =========================================================
// INTERFACE DO USUÁRIO CONECTADO
// =========================================================

function fecharMenuConta() {
  if (!accountMenu || !accountMenuButton) return;

  accountMenu.hidden = true;

  accountMenuButton.setAttribute(
    "aria-expanded",
    "false"
  );
}

function alternarMenuConta() {
  if (!accountMenu || !accountMenuButton) return;

  const vaiAbrir = accountMenu.hidden;

  accountMenu.hidden = !vaiAbrir;

  accountMenuButton.setAttribute(
    "aria-expanded",
    String(vaiAbrir)
  );
}

function atualizarInterfaceAutenticacao(user) {
  trial.sessionChanged(user);
  if(user?.is_anonymous)user=null;
  const changedAccount = usuarioAtual?.id !== user?.id;
  if (changedAccount) { activeController?.abort(); attachments.clear(); }
  usuarioAtual = user || null;
  workspace.setUser(usuarioAtual);
  sessaoCarregada = true;
  if (memoria.trocarUsuario(usuarioAtual?.id || null)) {
    historicoDaConversa = [];
    chatMessages.replaceChildren();
    mostrarMensagemInicial();
    userInput.value = "";
  }
  atualizarBotaoEnviar();

  const conectado = Boolean(usuarioAtual);

  if (headerLoginButton) {
    headerLoginButton.hidden = conectado;
  }

  if (headerUserButton) {
    headerUserButton.hidden = !conectado;
  }

  if (sidebarLoginButton) {
    sidebarLoginButton.hidden = conectado;
  }

  if (sidebarUser) {
    sidebarUser.hidden = !conectado;
  }

  if (!conectado) {
    fecharMenuConta();
    return;
  }

  const nome = obterNomeUsuario(usuarioAtual);
  const email =
    typeof usuarioAtual.email === "string"
      ? usuarioAtual.email
      : "Conta conectada";

  const inicial = obterInicial(nome);

  if (headerUserInitial) {
    headerUserInitial.textContent = inicial;
  }

  if (accountAvatar) {
    accountAvatar.textContent = inicial;
  }

  if (accountName) {
    accountName.textContent = nome;
  }

  if (accountEmail) {
    accountEmail.textContent = email;
  }
}

accountMenuButton?.addEventListener(
  "click",
  alternarMenuConta
);

headerUserButton?.addEventListener("click", () => {
  abrirSidebar();

  if (accountMenu && accountMenuButton) {
    accountMenu.hidden = false;

    accountMenuButton.setAttribute(
      "aria-expanded",
      "true"
    );
  }
});

document.addEventListener("click", (event) => {
  if (!accountMenu || accountMenu.hidden) return;

  const alvo = event.target;

  if (!(alvo instanceof Node)) return;

  if (
    accountMenu.contains(alvo) ||
    accountMenuButton?.contains(alvo) ||
    headerUserButton?.contains(alvo)
  ) {
    return;
  }

  fecharMenuConta();
});

// =========================================================
// LOGIN
// =========================================================

loginForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (autenticacaoEmAndamento) return;

    limparMensagemStatus(loginMessage);

    const email = loginEmail?.value.trim() || "";
    if (loginEmail) loginEmail.value = email;
    if (!email || !loginEmail.validity.valid) {
      mostrarMensagemStatus(loginMessage, "Digite um e-mail válido.");
      loginEmail?.focus();
      return;
    }
    if (!etapaSenha) {
      etapaSenha = true;
      atualizarEtapaLogin();
      loginPassword?.focus();
      return;
    }
    const password = loginPassword?.value || "";

    if (!email || !password) {
      mostrarMensagemStatus(
        loginMessage,
        "Preencha o e-mail e a senha."
      );

      return;
    }

    if (password.length < 8) {
      mostrarMensagemStatus(
        loginMessage,
        "A senha precisa ter pelo menos 8 caracteres."
      );

      return;
    }

    autenticacaoEmAndamento = true;

    definirBotaoCarregando(
      loginSubmit,
      true,
      "Entrar",
      "Entrando..."
    );

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password
        });

      if (error) {
        throw error;
      }

      if (!data?.session || !data?.user) {
        throw new Error(
          "A sessão não foi criada."
        );
      }

      atualizarInterfaceAutenticacao(data.user);

      loginForm.reset();
      autenticacaoEmAndamento = false;
      fecharModalAutenticacao();

      mostrarToast(
        "Você entrou na sua conta.",
        "success"
      );
    } catch (error) {
      mostrarMensagemStatus(
        loginMessage,
        traduzirErroAutenticacao(error)
      );
    } finally {
      autenticacaoEmAndamento = false;

      definirBotaoCarregando(
        loginSubmit,
        false,
        "Entrar",
        "Entrando..."
      );
      atualizarEtapaLogin();
    }
  }
);

// =========================================================
// CADASTRO
// =========================================================

registerForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (autenticacaoEmAndamento) return;

    limparMensagemStatus(registerMessage);

    const nome = registerName?.value.trim() || "";
    const email = registerEmail?.value.trim() || "";
    const password = registerPassword?.value || "";
    const aceitouTermos =
      registerTerms?.checked === true;

    if (nome.length < 2) {
      mostrarMensagemStatus(
        registerMessage,
        "Digite um nome com pelo menos 2 caracteres."
      );

      return;
    }

    if (!email) {
      mostrarMensagemStatus(
        registerMessage,
        "Digite um endereço de e-mail válido."
      );

      return;
    }

    if (password.length < 8) {
      mostrarMensagemStatus(
        registerMessage,
        "A senha precisa ter pelo menos 8 caracteres."
      );

      return;
    }

    if (!aceitouTermos) {
      mostrarMensagemStatus(
        registerMessage,
        "Você precisa aceitar a Política de Privacidade."
      );

      return;
    }

    autenticacaoEmAndamento = true;

    definirBotaoCarregando(
      registerSubmit,
      true,
      "Criar conta",
      "Criando conta..."
    );

    try {
      const redirectTo =
        window.location.origin + window.location.pathname + "?confirmado=1";

      const { data, error } =
        await supabase.auth.signUp({
          email,
          password,

          options: {
            emailRedirectTo: redirectTo,

            data: {
              display_name: nome
            }
          }
        });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error(
          "O cadastro não retornou um usuário."
        );
      }

      registerForm.reset();

      if (data.session) {
        atualizarInterfaceAutenticacao(data.user);
        autenticacaoEmAndamento = false;
        fecharModalAutenticacao();

        mostrarToast(
          "Sua conta foi criada.",
          "success"
        );

        return;
      }

      mostrarMensagemStatus(
        registerMessage,
        "Conta criada. Verifique seu e-mail para confirmar o cadastro.",
        "success"
      );
    } catch (error) {
      mostrarMensagemStatus(
        registerMessage,
        traduzirErroAutenticacao(error)
      );
    } finally {
      autenticacaoEmAndamento = false;

      definirBotaoCarregando(
        registerSubmit,
        false,
        "Criar conta",
        "Criando conta..."
      );
    }
  }
);

// =========================================================
// RECUPERAÇÃO DE SENHA
// =========================================================

passwordResetForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (autenticacaoEmAndamento) return;

    limparMensagemStatus(passwordResetMessage);

    const email =
      passwordResetEmail?.value.trim() || "";

    if (!email) {
      mostrarMensagemStatus(
        passwordResetMessage,
        "Digite o e-mail da sua conta."
      );

      return;
    }

    autenticacaoEmAndamento = true;

    definirBotaoCarregando(
      passwordResetSubmit,
      true,
      "Enviar link",
      "Enviando..."
    );

    try {
      const redirectTo =
        `${window.location.origin}${window.location.pathname}`;

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo
          }
        );

      if (error) {
        throw error;
      }

      mostrarMensagemStatus(
        passwordResetMessage,
        "Se existir uma conta com este e-mail, você receberá o link de recuperação.",
        "success"
      );
    } catch (error) {
      mostrarMensagemStatus(
        passwordResetMessage,
        traduzirErroAutenticacao(error)
      );
    } finally {
      autenticacaoEmAndamento = false;

      definirBotaoCarregando(
        passwordResetSubmit,
        false,
        "Enviar link",
        "Enviando..."
      );
    }
  }
);

// =========================================================
// LOGOUT
// =========================================================

logoutButton?.addEventListener(
  "click",
  async () => {
    if (autenticacaoEmAndamento) return;

    autenticacaoEmAndamento = true;
    logoutButton.disabled = true;

    try {
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      atualizarInterfaceAutenticacao(null);
      fecharMenuConta();
      fecharSidebar();

      mostrarToast(
        "Você saiu da sua conta.",
        "success"
      );
    } catch {
      mostrarToast(
        "Não foi possível sair da conta.",
        "error"
      );
    } finally {
      autenticacaoEmAndamento = false;
      logoutButton.disabled = false;
    }
  }
);

// =========================================================
// LEITURA DA SESSÃO
// =========================================================

async function carregarSessaoInicial() {
  try {
    const { data, error } =
      await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    atualizarInterfaceAutenticacao(
      data?.session?.user || null
    );
  } catch {
    atualizarInterfaceAutenticacao(null);

    console.error(
      "Não foi possível carregar a sessão da conta."
    );
  }
}

supabase.auth.onAuthStateChange(
  (_event, session) => {
    atualizarInterfaceAutenticacao(
      session?.user || null
    );
  }
);

// =========================================================
// CONTADOR E ALTURA DO CAMPO
// =========================================================

function atualizarContador() {
  const quantidade = userInput.value.length;

  if (characterCounter) {
    characterCounter.textContent =
      `${quantidade} / ${LIMITE_PERGUNTA}`;
  }
}

function ajustarAlturaTextarea() {
  userInput.style.height = "auto";

  const novaAltura = Math.min(
    userInput.scrollHeight,
    190
  );

  userInput.style.height =
    `${Math.max(novaAltura, 38)}px`;
}

function atualizarBotaoEnviar() {
  if(userInput.value.trim())document.body.classList.add("chat-drafting");
  const pergunta = userInput.value.trim();

  sendButton.disabled =
    (pergunta.length === 0 && attachments.count === 0) ||
    pergunta.length > LIMITE_PERGUNTA ||
    requisicaoEmAndamento || carregandoConversa || !sessaoCarregada || attachments.busy;
  attachments.setDisabled(requisicaoEmAndamento);

  atualizarContador();
  ajustarAlturaTextarea();
}

userInput.addEventListener(
  "input",
  atualizarBotaoEnviar
);

userInput.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey && document.documentElement.dataset.enterSend !== "false" &&
      !requisicaoEmAndamento && !event.isComposing
    ) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  }
);

// =========================================================
// MARKDOWN SEGURO
// =========================================================

function criarHtmlSeguro(texto) {
  const markedDisponivel =
    typeof window.marked !== "undefined" &&
    typeof window.marked.parse === "function";

  const domPurifyDisponivel =
    typeof window.DOMPurify !== "undefined" &&
    typeof window.DOMPurify.sanitize === "function";

  if (!markedDisponivel || !domPurifyDisponivel) {
    return null;
  }

  const htmlGerado = window.marked.parse(texto, {
    gfm: true,
    breaks: true
  });

  return window.DOMPurify.sanitize(htmlGerado, {
    USE_PROFILES: {
      html: true
    },

    FORBID_TAGS: [
      "img",
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "option",
      "video",
      "audio"
    ],

    FORBID_ATTR: [
      "style",
      "srcdoc",
      "formaction",
      "onerror",
      "onclick",
      "onload"
    ]
  });
}

function destacarBlocosDeCodigo(elemento) {
  const highlightDisponivel =
    typeof window.hljs !== "undefined" &&
    typeof window.hljs.highlightElement ===
      "function";

  if (!highlightDisponivel) return;

  elemento
    .querySelectorAll("pre code")
    .forEach((bloco) => {
      window.hljs.highlightElement(bloco);
    });
}

// =========================================================
// ROLAGEM DO CHAT
// =========================================================

function estaPertoDoFinalDoChat() {
  const distanciaDoFinal =
    chatMessages.scrollHeight -
    chatMessages.scrollTop -
    chatMessages.clientHeight;

  return distanciaDoFinal < 120;
}

function rolarChatParaFinal(forcar = false) {
  if (!forcar && !estaPertoDoFinalDoChat()) {
    return;
  }

  window.requestAnimationFrame(() => {
    chatMessages.scrollTop =
      chatMessages.scrollHeight;
  });
}

// =========================================================
// CRIAÇÃO DAS MENSAGENS
// =========================================================

function criarMensagem(nome, texto, tipo) {
  const estavaPertoDoFinal =
    estaPertoDoFinalDoChat();

  const message = document.createElement("div");
  message.classList.add("message");

  const mensagemUsuario =
    tipo === "user-message";

  if (mensagemUsuario) {
    message.classList.add("user-message");
  } else {
    message.classList.add("ai-message");

    if (tipo === "loading-message") {
      message.classList.add("loading-message");
    }
  }



  const content = document.createElement("div");
  content.classList.add("message-content");

  message.setAttribute("aria-label", mensagemUsuario ? "Sua mensagem" : "Resposta");

  const messageBody = document.createElement("div");
  messageBody.classList.add("message-body");

  const textoSeguro =
    typeof texto === "string"
      ? texto
      : "Não foi possível exibir esta mensagem.";

  if (!mensagemUsuario && tipo !== "loading-message") {
    const htmlSeguro =
      criarHtmlSeguro(textoSeguro);

    if (htmlSeguro !== null) {
      messageBody.innerHTML = htmlSeguro;
      destacarBlocosDeCodigo(messageBody);
    } else {
      const paragraph =
        document.createElement("p");

      paragraph.textContent = textoSeguro;
      messageBody.appendChild(paragraph);
    }
  } else {
    const paragraph =
      document.createElement("p");

    paragraph.textContent = textoSeguro;
    messageBody.appendChild(paragraph);
  }


  content.appendChild(messageBody);

  message.appendChild(content);

  chatMessages.appendChild(message);
  if (!mensagemUsuario && tipo !== "loading-message") workspace.decorate(message, textoSeguro);

  if (estavaPertoDoFinal) {
    rolarChatParaFinal(true);
  }

  return message;
}

// =========================================================
// MENSAGEM INICIAL
// =========================================================

function mostrarMensagemInicial() { document.body.classList.remove("chat-active", "chat-drafting"); }

// =========================================================
// HISTÓRICO LOCAL
// =========================================================

function calcularTotalCaracteres(historico) {
  return historico.reduce(
    (total, mensagem) => {
      return total + mensagem.content.length;
    },
    0
  );
}

function limitarHistorico(historico) {
  const historicoLimitado =
    historico.slice(
      -LIMITE_MENSAGENS_HISTORICO
    );

  while (
    calcularTotalCaracteres(
      historicoLimitado
    ) > LIMITE_TOTAL_HISTORICO &&
    historicoLimitado.length >= 2
  ) {
    historicoLimitado.splice(0, 2);
  }

  return historicoLimitado;
}

function registrarInteracao(pergunta, resposta) {
  historicoDaConversa.push(
    {
      role: "user",
      content: pergunta
    },
    {
      role: "assistant",
      content: resposta
    }
  );

  historicoDaConversa =
    limitarHistorico(
      historicoDaConversa
    );
}

// =========================================================
// NOVA CONVERSA
// =========================================================

function iniciarNovaConversa() {
  if (requisicaoEmAndamento || carregandoConversa) return;
  workspace.navigate("conversas");
  attachments.clear();
  memoria.nova();

  historicoDaConversa = [];

  chatMessages.replaceChildren();

  userInput.value = "";
  userInput.style.height = "auto";

  atualizarBotaoEnviar();
  mostrarMensagemInicial();
  fecharSidebar();

  chatMessages.scrollTop = 0;
}

newChatButton?.addEventListener(
  "click",
  iniciarNovaConversa
);

// =========================================================
// RESPOSTA DE CARREGAMENTO
// =========================================================

function mostrarAnalise() {
  return criarMensagem(
    "ITKs AI",
    "Analisando",
    "loading-message"
  );
}

// =========================================================
// CONSULTA À API
// =========================================================

async function buscarRespostaNaIA(pergunta, historico, anexos, projeto, onText) {
  const controller = new AbortController(); activeController=controller;
  const timer=setTimeout(()=>controller.abort(),TEMPO_MAXIMO_REQUISICAO);
  try {
    const token=await trial.token();
    if(controller.signal.aborted)throw new Error('Resposta interrompida.');
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({pergunta,historico,anexos,projeto,stream:true}),signal:controller.signal,credentials:'same-origin'});
    trial.readResponse(response);
    const type=response.headers.get('content-type')||'';
    if(type.includes('application/json')){const data=await response.json();if(!response.ok){if(data.loginRequired)abrirModalAutenticacao();throw new Error(data.erro||'Erro ao obter resposta.');}if(typeof data.resposta!=='string')throw new Error('Resposta inválida.');return data.resposta;}
    if(!response.ok||!type.includes('application/x-ndjson'))throw new Error('Resposta inválida do servidor.');
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',text='',final=null;
    function line(raw){if(!raw.trim())return;const event=JSON.parse(raw);if(event.type==='status')requestStatus.textContent=event.text;if(event.type==='delta'){text+=event.text;onText(text);}if(event.type==='error')throw new Error(event.text);if(event.type==='done')final=event.text;}
    try{while(true){const {value,done}=await reader.read();buffer+=done?decoder.decode():decoder.decode(value,{stream:true});let idx;while((idx=buffer.indexOf('\n'))>=0){line(buffer.slice(0,idx));buffer=buffer.slice(idx+1);}if(done)break;}if(buffer.trim())line(buffer);}finally{reader.releaseLock();}
    if(typeof final!=='string'||!final.trim())throw new Error('A resposta foi interrompida. Tente novamente.');return final;
  } finally {clearTimeout(timer);if(activeController===controller)activeController=null;}
}

// =========================================================
// SUGESTÕES
// =========================================================

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (requisicaoEmAndamento) return;

    const perguntaSugerida =
      button.dataset.question?.trim();

    if (!perguntaSugerida) return;

    userInput.value =
      perguntaSugerida.slice(
        0,
        LIMITE_PERGUNTA
      );

    atualizarBotaoEnviar();
    chatForm.requestSubmit();
  });
});

// =========================================================
// ENVIO DO CHAT
// =========================================================

chatForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (requisicaoEmAndamento || carregandoConversa || !sessaoCarregada) return;

    const pergunta =
      userInput.value.trim() || (attachments.count ? "Analise os anexos e explique o que você observa, com foco em programação e estudos." : "");

    if (!pergunta) return;

    if (
      pergunta.length >
      LIMITE_PERGUNTA
    ) {
      criarMensagem(
        "ITKs AI",
        `A pergunta pode ter no máximo ${LIMITE_PERGUNTA} caracteres.`,
        "ai-message"
      );

      return;
    }

    if (attachments.busy || !trial.canSend()) return;
    document.body.classList.add("chat-active");
    const files = attachments.snapshot();
    const projectContext = workspace.context();
    const contextoEnvio = memoria.contexto();
    stopButton.hidden=false;
    requisicaoEmAndamento = true;
    atualizarBotaoEnviar();

    criarMensagem(
      "Você",
      pergunta + (files.length ? "\n\nAnexos: " + files.map(f=>f.name).join(", ") : ""),
      "user-message"
    );

    userInput.value = "";
    userInput.style.height = "auto";

    atualizarContador();

    const mensagemDeAnalise =
      mostrarAnalise();

    try {
      const resposta =
        await buscarRespostaNaIA(
          pergunta,
          historicoDaConversa, files, projectContext, text => {
            if (!memoria.atual(contextoEnvio)) return;
            mensagemDeAnalise.querySelector(".message-body").textContent=text;
            rolarChatParaFinal();
          }
        );

      if (!memoria.atual(contextoEnvio)) return;
      mensagemDeAnalise.remove();

      criarMensagem(
        "ITKs AI",
        resposta,
        "ai-message"
      );

      attachments.clear();
      const perguntaSalva = pergunta + (files.length ? "\n\n[Arquivos analisados: " + files.map(f=>f.name).join(", ") + ". O conteúdo dos anexos não é armazenado no histórico; reanexe se necessário.]" : "");
      registrarInteracao(
        perguntaSalva,
        resposta
      );
      await memoria.salvar(contextoEnvio, perguntaSalva, resposta);
    } catch (error) {
      if (!memoria.atual(contextoEnvio)) return;
      mensagemDeAnalise.remove();

      const requisicaoExpirou =
        error instanceof DOMException &&
        error.name === "AbortError";

      const mensagem =
        requisicaoExpirou
          ? "Resposta interrompida. Você pode reenviar a pergunta."
          : (error.message || "Não foi possível responder. Tente novamente.");
      userInput.value = pergunta;

      criarMensagem(
        "ITKs AI",
        mensagem,
        "ai-message"
      );

      console.error(
        "Falha ao obter resposta da ITKs AI."
      );
    } finally {
      stopButton.hidden=true; requestStatus.textContent="";
      requisicaoEmAndamento = false;
      atualizarBotaoEnviar();
    }
  }
);

// =========================================================
// TECLA ESCAPE
// =========================================================

document.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Escape") return;

    if (
      authModal &&
      !authModal.hidden
    ) {
      fecharModalAutenticacao();
      return;
    }

    fecharMenuConta();
    fecharSidebar();
  }
);

// =========================================================
// ESTADO INICIAL
// =========================================================

atualizarBotaoEnviar();
carregarSessaoInicial().then(()=>{
 const url=new URL(window.location.href);const question=url.searchParams.get('pergunta');
 if(question?.trim()){workspace.navigate('conversas');userInput.value=question.trim().slice(0,1000);atualizarBotaoEnviar();userInput.focus();url.searchParams.delete('pergunta');url.hash='conversas';history.replaceState(null,'',url.pathname+url.search+url.hash);}
});
const retornoOAuth = new URLSearchParams(window.location.hash.slice(1));
if (retornoOAuth.has("error")) {
  mostrarToast("O login não foi concluído. Tente entrar novamente.", "error");
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

reiniciarEtapaLogin();
