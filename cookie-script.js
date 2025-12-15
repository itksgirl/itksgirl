document.addEventListener('DOMContentLoaded', (event) => {
    const banner = document.getElementById('cookie-banner');
    const aceitarBtn = document.getElementById('aceitar-cookies');
    const semCookiesBtn = document.getElementById('continuar-sem-cookies');
    const COOKIE_NAME = 'user_cookie_consent_itks'; // Nome único para evitar conflitos

    // 1. Função para buscar o cookie
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null; // Retorna null se não encontrar
    }

    // 2. Função para definir o cookie (salva a escolha)
    function setCookie(value) {
        // Define a validade do cookie (por exemplo, 365 dias)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 365);
        // O path=/ garante que o cookie seja válido em todo o site
        document.cookie = `${COOKIE_NAME}=${value}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax; Secure`;
        banner.style.display = 'none';
        
        // Se 'accepted', você pode carregar scripts de terceiros aqui
        if (value === 'accepted') {
             // Exemplo: console.log('Cookies aceitos! Pode carregar Google Analytics, Facebook Pixel, etc.');
        } else {
             // Exemplo: console.log('Cookies rejeitados. Apenas funcionalidades essenciais devem rodar.');
        }
    }

    // 3. Verifica e mostra o banner se o usuário ainda não consentiu
    if (getCookie(COOKIE_NAME) === null) {
        // Usa setTimeout para garantir que o DOM esteja totalmente carregado e dar um pequeno delay
        setTimeout(() => {
            banner.style.display = 'block';
        }, 500); 
    }

    // 4. Adiciona eventos aos botões
    aceitarBtn.addEventListener('click', () => {
        setCookie('accepted');
    });

    semCookiesBtn.addEventListener('click', () => {
        setCookie('rejected');
    });
});