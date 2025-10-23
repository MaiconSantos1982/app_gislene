// ID FIXO DO MENTOR (cole aqui o UUID do mentor)
const MENTOR_ID_FIXO = '85de5f16-1f9e-4d0d-82c0-a2e639baae86'; // ← SEU ID

let usuarioLogado = null;

// Verificar autenticação
async function verificarAutenticacao() {
    // Verificar se tem acesso direto (sem autenticação)
    const acessoDireto = localStorage.getItem('mentor_acesso_direto');
    
    if (acessoDireto === 'true') {
        // Buscar mentor pelo ID fixo
        const { data: mentor, error } = await supabase
            .from('appgi_mentoria_usuarios')
            .select('*')
            .eq('id', MENTOR_ID_FIXO)
            .single();
        
        if (mentor) {
            usuarioLogado = mentor;
            document.getElementById('nomeUsuario').textContent = mentor.nome;
            console.log('Mentor carregado:', mentor);
            carregarDashboard();
        } else {
            alert('Mentor não encontrado. Verifique o ID fixo no código.');
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
    carregarDashboard();
}

// Carregar dados do dashboard
async function carregarDashboard() {
    try {
        console.log('Carregando dashboard para mentor:', usuarioLogado.id);
        
        // Buscar dados manualmente sem usar a view
        const mentorId = usuarioLogado.id;
        
        // Total de clientes
        const { data: clientes, error: clientesError } = await supabase
            .from('appgi_mentoria_clientes')
            .select('id, appgi_mentoria_processos(status)')
            .eq('mentor_id', mentorId);
        
        if (clientesError) {
            console.error('Erro ao buscar clientes:', clientesError);
            throw clientesError;
        }
        
        console.log('Clientes encontrados:', clientes);
        
        const totalClientes = clientes.length;
        const clientesAtivos = clientes.filter(c => 
            c.appgi_mentoria_processos?.[0]?.status === 'ativo'
        ).length;
        
        // Total de tarefas
        const { data: tarefas, error: tarefasError } = await supabase
            .from('appgi_mentoria_tarefas')
            .select('status, data_prazo')
            .eq('mentor_id', mentorId);
        
        if (tarefasError) {
            console.error('Erro ao buscar tarefas:', tarefasError);
            throw tarefasError;
        }
        
        console.log('Tarefas encontradas:', tarefas);
        
        const hoje = new Date().toISOString().split('T')[0];
        
        const totalTarefas = tarefas.length;
        const tarefasConcluidas = tarefas.filter(t => t.status === 'concluido').length;
        const tarefasPendentes = tarefas.filter(t => 
            t.status === 'a_iniciar' || t.status === 'em_andamento'
        ).length;
        const tarefasAtrasadas = tarefas.filter(t => 
            t.data_prazo < hoje && t.status !== 'concluido'
        ).length;
        
        const taxaConclusao = totalTarefas > 0 
            ? Math.round((tarefasConcluidas / totalTarefas) * 100) 
            : 0;
        
        // Atualizar interface
        document.getElementById('totalClientes').textContent = totalClientes;
        document.getElementById('tarefasPendentes').textContent = tarefasPendentes;
        document.getElementById('tarefasAtrasadas').textContent = tarefasAtrasadas;
        document.getElementById('taxaConclusao').textContent = `${taxaConclusao}%`;
        
        // Carregar últimos clientes
        await carregarUltimosClientes();
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        // Mostrar zeros em caso de erro
        document.getElementById('totalClientes').textContent = 0;
        document.getElementById('tarefasPendentes').textContent = 0;
        document.getElementById('tarefasAtrasadas').textContent = 0;
        document.getElementById('taxaConclusao').textContent = '0%';
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
        
        console.log('Últimos clientes:', clientes);
        
        const tbody = document.getElementById('tabelaUltimosClientes');
        
        if (!clientes || clientes.length === 0) {
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
                <td>${cliente.usuario?.nome || '-'}</td>
                <td>${cliente.usuario?.email || '-'}</td>
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
    window.location.href = 'mentor.html';
});

// Inicializar ao carregar página
verificarAutenticacao();
