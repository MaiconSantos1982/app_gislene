let usuarioLogado = null;
let clienteAtual = null;

// Verificar autenticação
async function verificarAutenticacao() {
    // Verificar se tem acesso direto (sem autenticação)
    const acessoDireto = localStorage.getItem('mentor_acesso_direto');
    
    if (acessoDireto === 'true') {
        // Buscar primeiro mentor do sistema
        const { data: mentor, error } = await supabase
            .from('appgi_mentoria_usuarios')
            .select('*')
            .eq('tipo', 'mentor')
            .limit(1)
            .single();
        
        if (mentor) {
            usuarioLogado = mentor;
            carregarClientes();
        } else {
            alert('Nenhum mentor cadastrado no sistema.');
            window.location.href = 'index.html';
        }
        return;
    }
    
    // Fluxo normal de autenticação
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    // Buscar dados do usuário
    const { data: usuario, error } = await supabase
        .from('appgi_mentoria_usuarios')
        .select('*')
        .eq('auth_id', session.user.id)
        .single();
    
    if (error || !usuario || usuario.tipo !== 'mentor') {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
        return;
    }
    
    usuarioLogado = usuario;
    carregarClientes();
}

// ... resto do código permanece igual
