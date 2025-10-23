// Verificar se usuário já está logado
async function verificarSessao() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        // Buscar tipo de usuário
        const { data: usuario } = await supabase
            .from('appgi_mentoria_usuarios')
            .select('tipo')
            .eq('auth_id', session.user.id)
            .single();
        
        if (usuario) {
            if (usuario.tipo === 'mentor') {
                window.location.href = 'mentor-dashboard.html';
            } else {
                window.location.href = 'cliente-dashboard.html';
            }
        }
    }
}

// Login Mentor
document.getElementById('formLoginMentor')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('emailMentor').value;
    const senha = document.getElementById('senhaMentor').value;
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: senha
        });
        
        if (error) throw error;
        
        // Verificar se é mentor
        const { data: usuario } = await supabase
            .from('appgi_mentoria_usuarios')
            .select('tipo')
            .eq('auth_id', data.user.id)
            .single();
        
        if (usuario.tipo === 'mentor') {
            window.location.href = 'mentor-dashboard.html';
        } else {
            mostrarAlerta('Acesso negado. Use o login de cliente.', 'danger');
            await supabase.auth.signOut();
        }
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
});

// Magic Link Cliente
document.getElementById('formLoginCliente')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('emailCliente').value;
    
    try {
        const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                emailRedirectTo: `${window.location.origin}/cliente-dashboard.html`
            }
        });
        
        if (error) throw error;
        
        mostrarAlerta('Link de acesso enviado para seu e-mail!', 'success');
        document.getElementById('formLoginCliente').reset();
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
});

// Função para mostrar alertas
function mostrarAlerta(mensagem, tipo) {
    const alertDiv = document.getElementById('alertMessage');
    alertDiv.className = `alert alert-${tipo}`;
    alertDiv.textContent = mensagem;
    alertDiv.classList.remove('d-none');
    
    setTimeout(() => {
        alertDiv.classList.add('d-none');
    }, 5000);
}

// Verificar sessão ao carregar página
verificarSessao();
