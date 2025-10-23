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

// Login Mentor - PERMITIR ACESSO SEM CREDENCIAIS
document.getElementById('formLoginMentor')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('emailMentor').value.trim();
    const senha = document.getElementById('senhaMentor').value.trim();
    
    // Se email e senha estiverem vazios, permitir acesso direto
    if (email === '' && senha === '') {
        localStorage.setItem('mentor_acesso_direto', 'true');
        window.location.href = 'mentor-dashboard.html';
        return;
    }
    
    // Se preencheu credenciais, tentar login normal
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
            localStorage.removeItem('mentor_acesso_direto');
            window.location.href = 'mentor-dashboard.html';
        } else {
            mostrarAlerta('Acesso negado. Use o login de cliente.', 'danger');
            await supabase.auth.signOut();
        }
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
});

// Toggle entre Login e Criar Conta Cliente
document.getElementById('linkCriarConta')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('areaLoginCliente').style.display = 'none';
    document.getElementById('areaCriarConta').style.display = 'block';
});

document.getElementById('linkVoltarLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('areaLoginCliente').style.display = 'block';
    document.getElementById('areaCriarConta').style.display = 'none';
});

// Login Cliente
document.getElementById('formLoginCliente')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('emailClienteLogin').value.trim();
    const senha = document.getElementById('senhaClienteLogin').value.trim();
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: senha
        });
        
        if (error) throw error;
        
        // Verificar se é cliente
        const { data: usuario } = await supabase
            .from('appgi_mentoria_usuarios')
            .select('tipo')
            .eq('auth_id', data.user.id)
            .single();
        
        if (usuario && usuario.tipo === 'cliente') {
            window.location.href = 'cliente-dashboard.html';
        } else {
            mostrarAlerta('Usuário não encontrado como cliente.', 'danger');
            await supabase.auth.signOut();
        }
        
    } catch (error) {
        mostrarAlerta('Email ou senha incorretos', 'danger');
    }
});

// Criar Conta Cliente
document.getElementById('formCriarConta')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('emailClienteCadastro').value.trim();
    const senha = document.getElementById('senhaClienteCadastro').value.trim();
    const confirmarSenha = document.getElementById('confirmarSenha').value.trim();
    
    // Validar senhas
    if (senha !== confirmarSenha) {
        mostrarAlerta('As senhas não coincidem', 'danger');
        return;
    }
    
    try {
        // 1. Verificar se o email existe na tabela (cadastrado pelo mentor)
        const { data: usuarioExistente, error: erroVerificar } = await supabase
            .from('appgi_mentoria_usuarios')
            .select('id, auth_id, tipo')
            .eq('email', email)
            .eq('tipo', 'cliente')
            .maybeSingle(); // Usar maybeSingle ao invés de single
        
        if (erroVerificar) {
            console.error('Erro ao verificar:', erroVerificar);
            throw erroVerificar;
        }
        
        if (!usuarioExistente) {
            mostrarAlerta('Email não encontrado. Verifique com seu mentor.', 'danger');
            return;
        }
        
        // 2. Verificar se já tem auth_id (já criou conta)
        if (usuarioExistente.auth_id) {
            mostrarAlerta('Conta já existe. Use o login normal.', 'warning');
            document.getElementById('linkVoltarLogin').click();
            return;
        }
        
        // 3. Criar usuário no Supabase Auth COM autoConfirm
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: senha,
            options: {
                emailRedirectTo: `${window.location.origin}/cliente-dashboard.html`,
                data: {
                    tipo: 'cliente'
                }
            }
        });
        
        if (authError) {
            console.error('Erro auth:', authError);
            throw authError;
        }
        
        console.log('Usuário Auth criado:', authData);
        
        // 4. Verificar se precisa atualizar (pode já ter sido feito pelo trigger)
        if (authData.user && !usuarioExistente.auth_id) {
            const { error: updateError } = await supabase
                .from('appgi_mentoria_usuarios')
                .update({ auth_id: authData.user.id })
                .eq('id', usuarioExistente.id);
            
            if (updateError) {
                console.error('Erro ao atualizar:', updateError);
                // Não lançar erro aqui, pois o trigger pode ter feito
            }
        }
        
        mostrarAlerta('Conta criada com sucesso! Redirecionando...', 'success');
        
        // 5. Fazer login automático e redirecionar
        setTimeout(async () => {
            // Tentar login
            const { error: loginError } = await supabase.auth.signInWithPassword({
                email: email,
                password: senha
            });
            
            if (loginError) {
                console.error('Erro no login:', loginError);
                mostrarAlerta('Conta criada! Faça login manualmente.', 'info');
                document.getElementById('linkVoltarLogin').click();
            } else {
                window.location.href = 'cliente-dashboard.html';
            }
        }, 1500);
        
    } catch (error) {
        console.error('Erro ao criar conta:', error);
        mostrarAlerta(`Erro: ${error.message}`, 'danger');
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
