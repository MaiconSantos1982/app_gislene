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
        
        if (usuario && usuario.tipo === 'cliente') {
            window.location.href = 'cliente-dashboard.html';
        }
    }
}

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
    
    if (senha.length < 6) {
        mostrarAlerta('A senha deve ter no mínimo 6 caracteres', 'danger');
        return;
    }
    
    try {
        // 1. Verificar se o email existe na tabela (cadastrado pelo mentor)
        const { data: usuarioExistente, error: erroVerificar } = await supabase
            .from('appgi_mentoria_usuarios')
            .select('id, auth_id, tipo, nome')
            .eq('email', email)
            .eq('tipo', 'cliente')
            .maybeSingle();
        
        if (erroVerificar) {
            console.error('Erro ao verificar:', erroVerificar);
            throw erroVerificar;
        }
        
        if (!usuarioExistente) {
            mostrarAlerta('Email não encontrado. Verifique com seu mentor se você foi cadastrado.', 'danger');
            return;
        }
        
        // 2. Verificar se já tem auth_id (já criou conta)
        if (usuarioExistente.auth_id) {
            mostrarAlerta('Você já possui uma conta! Use o login normal.', 'warning');
            setTimeout(() => {
                document.getElementById('linkVoltarLogin').click();
                document.getElementById('emailClienteLogin').value = email;
            }, 1000);
            return;
        }
        
        console.log('Criando conta para:', usuarioExistente);
        
        // 3. Tentar criar usuário no Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: senha
        });
        
        if (authError) {
            console.error('Erro no signUp:', authError);
            
            // Se o erro é "user already exists", tentar fazer login
            if (authError.message.includes('already registered')) {
                mostrarAlerta('Email já registrado. Tentando fazer login...', 'info');
                
                const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: senha
                });
                
                if (loginError) {
                    throw new Error('Email já cadastrado mas senha incorreta.');
                }
                
                // Login bem-sucedido, atualizar auth_id
                if (loginData.user) {
                    await supabase
                        .from('appgi_mentoria_usuarios')
                        .update({ auth_id: loginData.user.id })
                        .eq('id', usuarioExistente.id);
                    
                    mostrarAlerta('Login realizado! Redirecionando...', 'success');
                    setTimeout(() => {
                        window.location.href = 'cliente-dashboard.html';
                    }, 1000);
                }
                return;
            }
            
            throw authError;
        }
        
        console.log('Auth criado:', authData);
        
        // 4. Atualizar o registro com o auth_id
        if (authData.user) {
            const { error: updateError } = await supabase
                .from('appgi_mentoria_usuarios')
                .update({ auth_id: authData.user.id })
                .eq('id', usuarioExistente.id);
            
            if (updateError) {
                console.error('Erro ao vincular:', updateError);
            }
            
            mostrarAlerta('Conta criada com sucesso! Redirecionando...', 'success');
            
            // 5. Redirecionar
            setTimeout(() => {
                window.location.href = 'cliente-dashboard.html';
            }, 1500);
        }
        
    } catch (error) {
        console.error('Erro completo:', error);
        mostrarAlerta(`Erro: ${error.message || 'Tente novamente mais tarde'}`, 'danger');
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
