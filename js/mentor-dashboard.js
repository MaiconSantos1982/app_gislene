let usuarioLogado = null;

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
            document.getElementById('nomeUsuario').textContent = mentor.nome;
            carregarDashboard();
        } else {
            alert('Nenhum mentor cadastrado no sistema. Por favor, cadastre um mentor primeiro.');
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
    document.getElementById('nomeUsuario').textContent = usuario.nome;
    
    // Carregar dados do dashboard
    carregarDashboard();
}

// Carregar dados do dashboard
async function carregarDashboard() {
    try {
        // Buscar estatísticas da view
        const { data: stats, error: statsError } = await supabase
            .from('appgi_dashboard_mentor')
            .select('*')
            .eq('mentor_id', usuarioLogado.id)
            .single();
        
        if (statsError) {
            // Se não houver dados, mostrar zeros
            document.getElementById('totalClientes').textContent = 0;
            document.getElementById('tarefasPendentes').textContent = 0;
            document.getElementById('tarefasAtrasadas').textContent = 0;
            document.getElementById('taxaConclusao').textContent = '0%';
        } else {
            // Atualizar cards de estatísticas
            document.getElementById('totalClientes').textContent = stats.total_clientes || 0;
            document.getElementById('tarefasPendentes').textContent = stats.tarefas_pendentes || 0;
            document.getElementById('tarefasAtrasadas').textContent = stats.tarefas_atrasadas || 0;
            document.getElementById('taxaConclusao').textContent = `${stats.taxa_conclusao || 0}%`;
        }
        
        // Carregar últimos clientes
        await carregarUltimosClientes();
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

// Carregar últimos 5 clientes cadastrados
async function carregarUltimosClientes() {
    try {
        const { data: clientes, error } = await supabase
            .from('appgi_mentoria_clientes')
            .select(`
                id,
                nicho_atuacao,
                empresa,
                created_at,
                usuario:usuario_id (
                    nome,
                    email
                )
            `)
            .eq('mentor_id', usuarioLogado.id)
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        const tbody = document.getElementById('tabelaUltimosClientes');
        
        if (clientes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted">
                        Nenhum cliente cadastrado ainda
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = clientes.map(cliente => `
            <tr>
                <td>${cliente.usuario.nome}</td>
                <td>${cliente.usuario.email}</td>
                <td>${cliente.empresa || '-'}</td>
                <td>${formatarData(cliente.created_at)}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        document.getElementById('tabelaUltimosClientes').innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-danger">
                    Erro ao carregar clientes
                </td>
            </tr>
        `;
    }
}

// Formatar data
function formatarData(dataString) {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Logout
document.getElementById('btnLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    localStorage.removeItem('mentor_acesso_direto');
    await supabase.auth.signOut();
    window.location.href = 'index.html';
});

// Inicializar ao carregar página
verificarAutenticacao();
